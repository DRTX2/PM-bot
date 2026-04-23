# ⚡ Workflow 3 — Delta Detector (cada 5 min)

Este documento explica **a detalle** el flujo definido en `workflow3_delta_detector (1).json`.

## 1) Objetivo del workflow
Detectar **cambios (deltas)** relevantes en el proyecto PetSafe cada 5 minutos y generar eventos cuando ocurra algo nuevo:

- Una tarjeta de Trello pasa a “completada” (`dueComplete = true`).
- Se sube un **PDF** nuevo como adjunto a una tarjeta.
- Aparece un **nuevo commit en `main`** (backend o frontend).

Cuando detecta un delta:
- Genera un evento estructurado.
- Pide a **Gemini** un análisis breve del evento.
- Notifica a **Discord** por webhook.
- Inserta el evento en Postgres (`eventos_detectados`).

Además, mantiene un “estado conocido” (snapshot) en Postgres para comparar en la siguiente ejecución.

## 2) Trigger
**Nodo:** `Schedule Trigger` (`scheduleTrigger`)

- Intervalo: cada **5 minutos**.

## 3) Configuración central
**Nodo:** `Configuración` (`set`)

Variables de entorno requeridas:

**Trello**
- `TRELLO_API_KEY`
- `TRELLO_TOKEN`
- `TRELLO_BOARD_ID`

**GitHub**
- `GITHUB_TOKEN`
- `GITHUB_TOKEN_BACKEND` (opcional; fallback a `GITHUB_TOKEN`)
- `GITHUB_TOKEN_FRONTEND` (opcional; fallback a `GITHUB_TOKEN`)
- `GITHUB_OWNER_BACKEND`
- `GITHUB_OWNER_FRONTEND` (fallback: `GITHUB_OWNER` → `GITHUB_OWNER_BACKEND`)
- `GITHUB_REPO_BACKEND`
- `GITHUB_REPO_FRONTEND`

**IA + alertas**
- `GEMINI_API_KEY`
- `DISCORD_WEBHOOK_URL`

## 4) Fuentes de datos (4 ramas en paralelo)
Desde `Configuración` salen 4 nodos, que luego se unen en `Merge Delta`.

### 4.1 Trello (tarjetas + adjuntos)
**Nodo:** `Trello Cards Delta` (`httpRequest`)
- `GET /1/boards/{boardId}/cards`
- fields: `name,dueComplete,due,idList,dateLastActivity`
- `attachments=true`
- `attachment_fields=name,url,mimeType,date`

El detector usa:
- `dueComplete`
- lista de `attachments` y si hay PDFs

### 4.2 GitHub (últimos commits en main)
**Nodo:** `GitHub Back Main`
- `GET /repos/{owner_back}/{repo_back}/commits`
- Query: `sha=main`, `per_page=5`

**Nodo:** `GitHub Front Main`
- `GET /repos/{owner_front}/{repo_front}/commits`
- Query: `sha=main`, `per_page=5`

El detector solo compara el **SHA del commit más reciente** (`[0]`) contra el último guardado en snapshot.

### 4.3 Estado conocido (snapshot) desde Postgres
**Nodo:** `PG Estado Conocido` (`postgres`)
- Query: `SELECT snapshot FROM estado_conocido WHERE id = 1;`

**Credencial Postgres:** placeholder `POSTGRES_CREDENTIAL_ID`.

Este `snapshot` es lo que permite saber “qué ya se notificó” vs “qué es nuevo”.

## 5) Unión de datos
**Nodo:** `Merge Delta` (`merge`, modo `append`, `numberInputs: 4`)

Une las 4 entradas (Trello, commits back, commits front, snapshot previo) en un stream.

## 6) Detección de deltas (cálculo principal)
**Nodo:** `Delta Detector` (`code`)

Este nodo:

### 6.1 Reconstruye las 4 piezas de entrada
Intenta extraer desde el merge:
- `cards`: arreglo de tarjetas
- `backCommits`: arreglo de commits backend
- `frontCommits`: arreglo de commits frontend
- `prevSnapshot`: snapshot previo desde Postgres

Luego normaliza el “previo”:
- `prev.main_commit_back_sha`
- `prev.main_commit_front_sha`
- `prev.card_states` (por card_id)

### 6.2 Construye el nuevo estado de tarjetas
Por cada tarjeta de Trello:
- cuenta adjuntos (`attCount`)
- cuenta PDFs (`pdfCount`)
- guarda `dueComplete`

Estructura guardada por tarjeta:
```json
{
  "dueComplete": true,
  "attCount": 3,
  "pdfCount": 1
}
```

### 6.3 Genera eventos
Para cada tarjeta, si ya existía en el snapshot previo (`prev.card_states[c.id]`):

1) **Tarea completada**
- Condición: `prev.dueComplete == false` y `c.dueComplete == true`

2) **Nuevo PDF subido**
- Condición: `prev.pdfCount < pdfAtts.length`
- Guarda metadata de PDFs nuevos (nombre + URL)

Para commits en `main`:

3) **Nuevo commit backend**
- Condición: `latestBack.sha != prev.main_commit_back_sha`
- Pero solo genera evento si `prev.main_commit_back_sha` **ya existía**.
  - Esto evita spamear en la primera ejecución.

4) **Nuevo commit frontend**
- Igual lógica que backend.

Cada evento tiene forma:
```json
{
  "tipo": "tarea_completada|entregable_subido|commit_main_backend|commit_main_frontend",
  "emoji": "✅|📎|🔀",
  "titulo": "...",
  "descripcion": "...",
  "detalle": { ... }
}
```

### 6.4 Construye el nuevo snapshot
Guarda:
- SHAs actuales de commits main back/front
- `card_states` actual de todas las tarjetas

Y devuelve:
- `events`
- `event_count`
- `new_snapshot`
- `new_snapshot_json` (string)

## 7) Persistencia del nuevo estado
**Nodo:** `PG Update Estado` (`postgres`)

Actualiza `estado_conocido`:
- `snapshot = $1::jsonb` (usa `new_snapshot_json`)
- `actualizado = NOW()`

Esto se ejecuta **siempre**, haya eventos o no.

## 8) Rama de notificación: solo si hay eventos
**Nodo:** `IF Hay Eventos` (`if`)

- Condición: `event_count > 0`

Si no hay eventos: termina.

Si hay eventos:

### 8.1 “Split” por evento
**Nodo:** `Split Events` (`code`)

Convierte el arreglo `events[]` en N items (uno por evento) para procesarlos individualmente.

### 8.2 Análisis por evento con Gemini
**Nodo:** `Gemini Event Analysis` (`httpRequest`)

- POST a: `.../models/gemini-2.5-flash:generateContent?key={{GEMINI_API_KEY}}`
- Prompt: “Analiza brevemente (máx 3 frases) y da recomendación si aplica”
- `temperature: 0.3`, `maxOutputTokens: 300`

### 8.3 Construcción del mensaje final para Discord
**Nodo:** `Build Discord Msg` (`code`)

- Junta:
  - emoji + título
  - descripción
  - links extra (commit URL o links a PDFs)
  - análisis de Gemini

Genera:
- `content` (texto)
- `detalle_json` (string JSON)

### 8.4 Envío a Discord
**Nodo:** `Discord Event` (`httpRequest`)

- POST a `DISCORD_WEBHOOK_URL`
- Body JSON: `{ content: ..., username: 'PetSafe Delta' }`
- Trunca a 1900 caracteres.

### 8.5 Inserción en Postgres (log de eventos)
**Nodo:** `PG Insert Evento` (`postgres`)

Inserta en `eventos_detectados`:
- `tipo`
- `descripcion`
- `detalle` (jsonb)
- `notificado = TRUE`

## 9) Tablas de Postgres implicadas
- `estado_conocido` (estado para comparación)
  - esperado: fila `id=1` con columna `snapshot`
- `eventos_detectados` (histórico de eventos)

## 10) Puntos de falla típicos
- No existe la fila `estado_conocido.id = 1` → el detector no tiene “previo” y puede comportarse raro.
- `GEMINI_API_KEY` faltante → no habrá análisis IA (fallará el nodo Gemini).
- `DISCORD_WEBHOOK_URL` inválida → no se notifican eventos.
- GitHub rate limit / token sin permisos → commits no se consultan.

## 11) Observación importante sobre el formato de salida de HTTP Request
El `Delta Detector` intenta reconocer `cards` y `commits` como **arreglos** (`Array.isArray(it)`).

Dependiendo de cómo esté configurado el nodo `httpRequest` en tu versión de n8n, puede pasar que:
- te entregue **un item por elemento** (split automático), o
- te entregue **un único item con un array completo**.

Este workflow está escrito para el segundo caso (un item que contiene el array completo). Si ves que no detecta eventos nunca, normalmente es porque Trello/GitHub se están “spliteando” en items y el code node no los reconstruye.

Si quieres, puedo ayudarte con un patch mínimo para que el detector funcione bien incluso si n8n entrega los arrays “spliteados” (sin cambiar UX/outputs).
