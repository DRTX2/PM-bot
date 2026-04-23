# 💬 Workflow 2 — Chat “Discord” PetSafe (n8n)

Este documento explica **a detalle** el flujo definido en `workflow2_chat_discord.json`.

> Nota importante de arquitectura: aunque el nombre dice “Discord”, este workflow **NO** escucha Discord directamente. Su entrada es un **Webhook HTTP** (`POST /webhook/discord-chat`). En tu setup actual, quien escucha Discord es `bot-bridge` (Node.js), que reenvía mensajes al webhook y devuelve la respuesta al canal.

## 1) Objetivo del workflow
Actuar como **router de comandos** y **asistente conversacional** para el proyecto PetSafe, respondiendo a preguntas del equipo con contexto real de:

- Trello (tarjetas/listas/miembros)
- GitHub (commits y PRs de backend y frontend)
- Postgres (KPIs, historial, hitos y Q&A previos)
- Gemini (generación de respuestas basadas en el contexto)

Además, permite disparar el **Workflow 4 (reporte PDF)** bajo demanda.

## 2) Entrada: Webhook HTTP
**Nodo:** `Discord Webhook` (`webhook`)

- Método: `POST`
- Path: `discord-chat`
- Modo de respuesta: `responseNode` (la respuesta la produce un `Respond to Webhook`).

### Payload esperado
Este workflow lee:
- `body.content`: texto del usuario (si falta, usa “Dame un resumen”)
- `body.user`: nombre/usuario (si falta, “desconocido”)

Ejemplo (lo que normalmente envía `bot-bridge`):
```json
{
  "content": "!kpis",
  "user": "david"
}
```

## 3) Configuración central (Set)
**Nodo:** `Config` (`set`)

Construye un objeto con variables de entorno y los campos normalizados del mensaje:

### Variables de entorno requeridas (env)
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

**IA**
- `GEMINI_API_KEY`

### Campos derivados del request
- `pregunta_usuario = {{$json.body.content || 'Dame un resumen'}}`
- `usuario_discord = {{$json.body.user || 'desconocido'}}`

## 4) Router de comandos
**Nodo:** `Router Comandos` (`code`)

Este nodo interpreta el texto y decide el “tipo” de acción:

- `tipo = 'reporte'` si empieza con `!reporte`
- `tipo = 'kpis'` si empieza con `!kpis`
- `tipo = 'chat'` para cualquier otro texto

También calcula:
- `necesita_diff`: booleano si detecta palabras como `codigo`, `commit`, `diff`, `revisa`, `calidad`, `pull request`, `pr`, `merge`.

Salida:
```json
{ "pregunta": "...", "tipo": "chat|kpis|reporte", "necesita_diff": true|false, "usuario": "..." }
```

## 5) Switch por tipo
**Nodo:** `Switch Tipo` (`switch`)

Rutas:

### A) `reporte` → dispara Workflow 4
**Nodo:** `Trigger Reporte PDF` (`executeWorkflow`)
- `workflowId.value = "WORKFLOW4_ID"` (placeholder)

**Nodo:** `Resp Reporte` (`respondToWebhook`)
- Responde texto fijo: `Reporte PDF generado y enviado al canal + email.`

#### Bloqueo de publish (lo que te pasó)
El `workflowId` está como `WORKFLOW4_ID` (texto), no como un ID real de n8n.
- Para publicar, n8n valida referencias: si ese workflow no existe/publicado, **no te deja publicar**.
- Fix en UI: publica primero el Workflow 4 y luego en este nodo selecciona el workflow real (o pega el ID real) en vez de `WORKFLOW4_ID`.

### B) `kpis` → lee KPIs del último análisis
**Nodo:** `Postgres Ultimo KPI` (`postgres`)
- Query: `SELECT fecha_ejecucion, progreso_pct, tareas_vencidas, kpis_json FROM analisis_proyecto ORDER BY fecha_ejecucion DESC LIMIT 1;`

**Credencial:** placeholder `POSTGRES_CREDENTIAL_ID`.

**Nodo:** `Formatear KPIs` (`code`)
- Convierte la fila en texto multilínea.
- Ojo: el código asume que `kpis_json` ya es objeto (si viene como string, podría requerir `JSON.parse`).
- En el JSON actual hay caracteres mal codificados (por ejemplo “tareas/día” aparece como `tareas/dÃƒÆ’Ã‚Â­a`). No rompe la lógica, pero sí ensucia el texto de salida.

**Nodo:** `Resp KPIs` (`respondToWebhook`)
- Devuelve el texto.

### C) `chat` → recolección de contexto + Gemini
Esta es la ruta “larga” que construye contexto real, opcionalmente agrega diff de commits, y consulta Gemini para responder.

## 6) Recolección de datos para chat (10 fuentes en paralelo)
Al entrar en `chat`, el workflow dispara 10 nodos y luego los une con `Merge Chat`:

### 6.1 Trello (3 requests)
**Nodo:** `Trello Cards`
- `GET /1/boards/{boardId}/cards`
- Campos: `name,desc,due,dueComplete,idMembers,idList,dateLastActivity,labels`

**Nodo:** `Trello Lists`
- `GET /1/boards/{boardId}/lists`

**Nodo:** `Trello Members`
- `GET /1/boards/{boardId}/members`
- Campos: `fullName,username`

### 6.2 GitHub (4 requests)
**Nodo:** `GH Back Commits`
- `GET /repos/{owner_back}/{repo_back}/commits?per_page=15`

**Nodo:** `GH Front Commits`
- `GET /repos/{owner_front}/{repo_front}/commits?per_page=15`

**Nodo:** `GH Back PRs`
- `GET /repos/{owner_back}/{repo_back}/pulls?state=all&per_page=15`

**Nodo:** `GH Front PRs`
- `GET /repos/{owner_front}/{repo_front}/pulls?state=all&per_page=15`

### 6.3 Postgres (3 queries)
**Nodo:** `PG Historial`
- Últimos 5 análisis del proyecto.

**Nodo:** `PG Recomendaciones`
- Últimas 5 recomendaciones con `pregunta IS NOT NULL`.

**Nodo:** `PG Hitos`
- Hitos recientes/próximos (últimos 7 días hacia atrás, hasta 10 filas).

## 7) Unión de datos (Merge)
**Nodo:** `Merge Chat` (`merge`, modo `append`, `numberInputs: 10`)

Concatena todas las fuentes en un solo stream.

## 8) IF “Necesita Diff” (control de costo)
**Nodo:** `IF Necesita Diff` (`if`)

- Si `necesita_diff` es `true`, hace 2 requests extra:
  - `Diff Backend`: detalle del commit más reciente (`/commits/{sha}`)
  - `Diff Frontend`: detalle del commit más reciente

- Si `necesita_diff` es `false`, salta directo a construir el contexto.

## 9) Construcción del contexto y prompt
**Nodo:** `Construir Contexto` (`code`)

Aquí se arma el “cerebro” del chat:

1) Lee la pregunta y el usuario del `Router Comandos`.
2) Convierte Trello en estructura útil:
   - Mapea listas por `idList`.
   - Mapea miembros por `idMembers`.
   - Deriva:
     - tareas vencidas
     - tareas por vencer en ≤ 3 días
     - distribución por lista

3) Resume GitHub:
   - Lista commits recientes (back/front)
   - Lista PRs abiertos y PRs “stale” (> 7 días abiertos)

4) Incorpora Postgres:
   - `historial_resumen`
   - `kpis_ultimo_analisis`
   - `recomendaciones_previas`
   - `hitos_proximos`

5) Si hay diff, lo “recorta” para no explotar tokens:
   - deja `patch` truncado a 1200 caracteres por archivo.

6) Construye un `prompt` con reglas estrictas:
   - Solo responde sobre el proyecto; si no, responde EXACTAMENTE: `No es una pregunta relacionada con el proyecto.`
   - Español, texto plano, sin markdown, sin emojis, máx ~1800 caracteres.
   - Si falta dato, lo dice.
   - Para decisiones: `DIAGNOSTICO / RIESGOS / ACCIONES RECOMENDADAS`.

Salida:
- `prompt`
- `gemini_key`
- `pregunta`, `usuario`

## 10) Llamada a Gemini
**Nodo:** `Gemini Chat` (`httpRequest`)

- `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={{gemini_key}}`
- `temperature: 0.3`, `maxOutputTokens: 2048`

La respuesta esperada se lee como:
- `candidates[0].content.parts[0].text`

## 11) Persistencia del Q&A en Postgres
**Nodo:** `Guardar Q&A` (`postgres`)

Inserta en `recomendaciones`:
- `tipo = 'chat'`
- `pregunta` (desde `Construir Contexto`)
- `respuesta` (desde `Gemini Chat`)
- `usuario`
- `aplicada = false`

Detalles:
- Usa SQL armado por string con escape de comillas simples.
- Tiene `continueOnFail: true` para que si falla el insert, igual responda al webhook.

## 12) Respuesta al webhook
**Nodo:** `Resp Chat` (`respondToWebhook`)

Devuelve al caller el texto de Gemini:
- `{{$node['Gemini Chat'].json.candidates[0].content.parts[0].text}}`

Este texto es lo que `bot-bridge` devuelve de vuelta al canal de Discord.

## 13) Dependencias requeridas
Para que el workflow 2 funcione en servidor:

- Variables de entorno Trello/GitHub/Gemini cargadas en el contenedor/instancia de n8n.
- Credencial Postgres real creada en n8n (reemplazar `POSTGRES_CREDENTIAL_ID`).
- Workflow 4 publicado y referenciado por ID real (reemplazar `WORKFLOW4_ID`).

## 14) Puntos de falla típicos
- Publish bloqueado por `WORKFLOW4_ID`.
- `TRELLO_*` o `GITHUB_*` faltantes → HTTP 401/404/400.
- `GEMINI_API_KEY` faltante/incorrecta → HTTP 401/403.
- Postgres credencial inexistente → error en nodos `PG *`.
- Mensajes de salida con caracteres raros → el JSON tiene texto con encoding roto en algunos `jsCode`/`name`.

## 15) Comandos que soporta (tal cual)
- `!reporte` → dispara reporte PDF (Workflow 4)
- `!kpis` → muestra KPIs del último análisis
- Cualquier otro texto → chat contextual

Si quieres, el siguiente paso lógico es:
- corregir `WORKFLOW4_ID` en el nodo `Trigger Reporte PDF`,
- y (opcional) limpiar el encoding del nombre/strings para que en UI y respuestas se vean bien.
