# Workflow: Chat Discord PetSafe (estado actual)

Este documento describe como esta funcionando hoy el workflow `Chat Discord PetSafe.json`.

## 1. Objetivo general

El workflow ahora es **hibrido**:

- Modo chat/comandos via webhook de Discord bridge.
- Modo eventos en tiempo real via webhooks de Trello y GitHub.

Con esto, el sistema responde preguntas bajo demanda y tambien reacciona de forma proactiva a eventos.

## 2. Entradas del workflow

Actualmente hay 3 webhooks de entrada:

1. `POST /webhook/discord-chat`
2. `POST /webhook/trello-event`
3. `POST /webhook/github-event`

## 3. Bloque de configuracion (`Config`)

El nodo `Config` centraliza env vars y datos del request de chat.

Variables principales:

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_BOARD_ID`
- GitHub: `GITHUB_TOKEN`, `GITHUB_TOKEN_BACKEND`, `GITHUB_TOKEN_FRONTEND`, `GITHUB_OWNER_BACKEND`, `GITHUB_OWNER_FRONTEND`, `GITHUB_REPO_BACKEND`, `GITHUB_REPO_FRONTEND`
- IA: `GEMINI_API_KEY`
- Notificaciones: `DISCORD_WEBHOOK_URL`

Campos del chat:

- `pregunta_usuario` desde `body.content`
- `usuario_discord` desde `body.user`

## 4. Rama Discord Chat (`/discord-chat`)

### 4.1 Router de comandos

`Router Comandos` interpreta:

- `!ayuda` / `!help` -> `tipo=ayuda`
- `!kpis` -> `tipo=kpis`
- `!reporte [dias]` -> `tipo=reporte`
- `!riesgos` -> `tipo=chat`
- `!hitos` -> `tipo=chat`
- `!revisar backend|frontend` -> `tipo=chat` y `necesita_diff=true`
- comando invalido -> `tipo=error`
- texto libre -> `tipo=chat` (con heuristica para pedir diff si detecta temas de codigo)

### 4.2 Switch de tipo

`Switch Tipo` ahora tiene 5 salidas activas:

1. `reporte` -> `Trigger Reporte PDF` -> `Resp Reporte`
2. `kpis` -> `Postgres Ultimo KPI` -> `Formatear KPIs` -> `Resp KPIs`
3. `chat` -> rama de contexto completo + Gemini
4. `ayuda` -> `Resp Ayuda`
5. `error` -> `Resp Error`

Nota: `Resp Ayuda` y `Resp Error` ya estan conectados (antes estaban sueltos).

### 4.3 Chat con contexto (tipo `chat`)

Fuentes que consulta en paralelo:

- Trello: cards, lists, members
- GitHub: commits y PRs de backend y frontend
- Postgres: historial, recomendaciones, hitos

Flujo:

1. `Merge Chat` junta las 10 entradas.
2. `IF Necesita Diff` decide si traer diff del ultimo commit (backend/frontend).
3. `Construir Contexto` arma contexto estructurado y prompt robusto.
4. `Gemini Chat` genera respuesta.
5. `Guardar Q&A` guarda en `recomendaciones`.
6. `Resp Chat` responde al webhook.

## 5. Rama realtime Trello (`/trello-event`)

Flujo:

1. `Trello Event Webhook`
2. `Normalizar Evento Trello`
3. `IF Evento Trello Relevante`
4. Si relevante:
   - `Discord Evento Trello`
   - `PG Insert Evento Trello` (tabla `eventos_detectados`)
   - `Resp Trello Procesado`
5. Si no relevante:
   - `Resp Trello Ignorado`

Eventos Trello que se procesan actualmente:

- Movimiento de tarjeta entre listas
- Comentario en tarjeta
- Creacion de tarjeta
- Cambio de fecha limite (`due`)

Eventos ignorados intencionalmente:

- Eventos que pueden duplicar logica del Workflow 3 (delta detector).

## 6. Rama realtime GitHub (`/github-event`)

Flujo:

1. `GitHub Event Webhook`
2. `Normalizar Evento GitHub`
3. `IF Evento GitHub Relevante`
4. Si relevante:
   - `Discord Evento GitHub`
   - `PG Insert Evento GitHub` (tabla `eventos_detectados`)
   - `Resp GitHub Procesado`
5. Si no relevante:
   - `Resp GitHub Ignorado`

Eventos GitHub que se procesan actualmente:

- `pull_request`: `opened`, `reopened`, `ready_for_review`, `synchronize`, `closed`, `merged`
- `push` en ramas de trabajo (no main/master)

Eventos ignorados intencionalmente:

- `push` en `main`/`master` para no duplicar al Workflow 3.
- eventos no contemplados.

## 7. Formato de respuestas

- Respuestas de comandos chat: via `Respond to Webhook` textual.
- Respuestas de webhooks realtime:
  - `ok (trello procesado|ignorado)`
  - `ok (github procesado|ignorado)`
- Notificaciones a Discord realtime: via `DISCORD_WEBHOOK_URL`.

## 8. Persistencia en base de datos

Tablas usadas por este workflow:

- `analisis_proyecto` (lectura para KPIs/historial)
- `hitos_proyecto` (lectura)
- `recomendaciones` (lectura + insercion de Q&A)
- `eventos_detectados` (insercion de eventos realtime)

## 9. Relacion con otros workflows

- Workflow 1 (`monitor`): genera analitica periodica.
- Workflow 3 (`delta detector`): detecta cambios por polling y alerta.
- Workflow 4 (`reporte pdf`): se dispara con `!reporte`.

Este workflow evita duplicar parte de WF3 ignorando ciertos eventos realtime (ej. push a main).

## 10. Puntos operativos importantes

- `DISCORD_WEBHOOK_URL` debe existir para alertas realtime.
- Los webhooks de Trello y GitHub deben apuntar a las URLs de produccion de n8n.
- `Guardar Q&A` sigue con SQL por string interpolation; funciona, pero idealmente puede migrarse a query parametrizada para mayor robustez.

