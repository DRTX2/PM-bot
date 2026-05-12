# PetSafe: Funcionalidades Y Pruebas

Este documento resume qué hace hoy el sistema de `bot/` y cómo probarlo en n8n sin adivinar.

## 1. Workflows actuales

### `Chat Discord PetSafe.json`
- Recibe mensajes por webhook `POST /webhook/discord-chat`.
- Hace deduplicación corta en Redis.
- Interpreta comandos Discord:
  - `!ayuda`
  - `!kpis`
  - `!reporte [dias]`
  - `!riesgos`
  - `!hitos`
  - `!revisar backend`
  - `!revisar frontend`
  - `!estado`
  - `!vencidas`
  - `!miembros`
  - `!commits`
  - `!ci`
  - `!progreso`
- Para consultas generales arma contexto con Trello, GitHub, Postgres y responde con Gemini.
- Guarda preguntas y respuestas en la tabla `recomendaciones`.

### `Monitor PetSafe.json`
- Ejecuta monitoreo programado del proyecto.
- Lee Trello, GitHub, Postgres y Redis.
- Calcula KPIs, tendencias y severidad.
- Guarda snapshots/estado consolidado.
- Cuando detecta problemas dispara `Monitor PetSafe - Alertas IA`.

### `Monitor PetSafe - Alertas IA.json`
- Recibe el payload del monitor principal.
- Construye un prompt PM.
- Genera diagnóstico con Gemini.
- Publica alerta rica en Discord.
- Guarda el texto IA en `analisis_proyecto.recomendaciones_ia`.

### `Monitor PetSafe - Error Handler.json`
- Recibe errores de otros workflows.
- Envía aviso de fallo a Discord.

### `Discord Eventos GitHub PetSafe.json`
- Recibe eventos por `GitHub Trigger` nativo.
- Normaliza eventos GitHub importantes.
- Envía mensaje a Discord.
- Guarda evento en base de datos.

### `Discord Eventos Trello PetSafe.json`
- Recibe eventos por `Trello Trigger` nativo.
- Normaliza eventos Trello.
- Envía mensaje a Discord.
- Guarda evento en base de datos.

### `Construir Contexto Robusto.json`
- Polling programado para detectar deltas en Trello/GitHub.
- Analiza eventos relevantes con Gemini.
- Publica eventos resumidos en Discord.

### `Reporte PDF Semanal.json`
- Genera reporte semanal / on-demand.
- Usa `Gemini Executive Summary` sobre `chainLlm` + `lmChatGoogleGemini`.
- Consulta GitHub con credenciales predefinidas.
- Produce salida PDF y envíos asociados.

## 2. Pruebas recomendadas

## A. Probar chat Discord

Ejecuta `Chat Discord PetSafe` con un payload manual al webhook:

```json
{
  "body": {
    "content": "!estado",
    "user": "david"
  }
}
```

Pruebas mínimas:
- `!ayuda`: debe responder lista de comandos.
- `!kpis`: debe responder desde cache o calcular KPIs.
- `!estado`: debe devolver resumen rápido.
- `!ci`: debe leer CI backend/frontend.
- `!revisar backend`: debe pedir contexto GitHub y diff.
- mensaje libre como `como vamos con el proyecto`: debe pasar por Gemini.

## B. Probar monitor principal

Ejecuta manualmente `Monitor PetSafe`.

Verifica:
- `Configuración` carga variables esperadas.
- nodos Trello responden sin 401.
- nodos GitHub backend/frontend responden sin 401/403.
- `Analisis + KPIs` produce:
  - `progreso_pct`
  - `tareas_vencidas_count`
  - `problemas_detectados`
  - `severidad_max`
- si hay problemas, debe llamar a `Monitor PetSafe - Alertas IA`.

## C. Probar alertas IA

Ejecuta `Monitor PetSafe - Alertas IA` usando un payload real del monitor o con `Execute workflow` desde `Monitor PetSafe`.

Verifica:
- `Preparar Prompt` genera texto largo coherente.
- `Google Gemini Model` responde sin 429.
- `Build Discord Payload` produce:
  - `discord_payload`
  - `ia_text`
- `Guardar Recomendación IA` actualiza `analisis_proyecto.recomendaciones_ia`.
- `Discord Alerta` devuelve 2xx.

## D. Probar webhooks GitHub/Trello

### GitHub
Prueba el workflow con `Listen for event` en el trigger nativo o generando un evento real (`push` o `pull_request`) en el repo configurado.

Debe:
- clasificar el repo como backend o frontend
- marcar algunos eventos como ignorados
- generar `discord_content`

### Trello
Prueba el workflow con `Listen for event` en el trigger nativo o generando una acción real sobre el board configurado.

Debe:
- mapear tipo de evento
- construir mensaje legible para Discord

## 3. Checks rápidos después de importar

- Las credenciales `postgres`, `redis`, `googlePalmApi`, `githubApi` y `trelloApi` deben quedar asignadas.
- Confirmar que los workflows que aún requieren token manual por flexibilidad de tool-calls (`Chat Discord PetSafe`) vean los valores correctos dentro del contenedor n8n.
- Confirmar que `DISCORD_WEBHOOK_URL` responde.
- Confirmar que los workflows con triggers/webhooks estén `active`.
- Confirmar que los workflows críticos tengan `settings.errorWorkflow = monitor-petsafe-error-handler`.

## 4. Fallos típicos

- `Authorization failed` en GitHub:
  - token incorrecto en contenedor
  - contenedor recreado pendiente
  - token sin acceso al repo frontend/backend

- `429 Too Many Requests` en Gemini:
  - cuota agotada
  - credencial free tier muy limitada

- `there is no parameter $1` en Postgres:
  - query parametrizada mal configurada en n8n

- respuestas vacías en chat:
  - credencial Gemini inválida
  - rutas de contexto sin datos
  - nodos GitHub/Trello previos fallando

## 5. Estado de la revisión

En esta pasada quedaron corregidos:
- referencias rotas a nodos dentro de `Chat Discord PetSafe`
- guardado de Q&A en Postgres
- condición booleana de `IF Datos Rapidos1`
- tool de búsqueda Trello usando variable correcta
- tool de CI con owner/token correctos
- rama de chat conectada también a `GH Back CI Runs` y `GH Front CI Runs`
- guardado de recomendación IA y parseo de Gemini en `Monitor PetSafe - Alertas IA`
- migración de `Reporte PDF Semanal` a Gemini nativo (`chainLlm` + `lmChatGoogleGemini`)
- consolidación de autenticación GitHub/Trello en nodos `HTTP Request` estáticos con credenciales predefinidas
- activación de `errorWorkflow` global en workflows críticos
