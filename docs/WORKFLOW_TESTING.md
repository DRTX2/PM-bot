# PetSafe PM AI - Guia de pruebas completa

## Objetivo
Validar todo el sistema: 30 workflows, entradas/salidas, DB, dashboards, colas y bot-bridge.

## Pre-requisitos
- Ver [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md) para env y seguridad.
- n8n arriba y healthy (readiness OK).
- Credenciales en n8n: Postgres, Redis, GitHub, Trello, Gemini, Discord y SMTP (si aplica).
- Variables minimas: `WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, `PM_APPROVAL_SECRET`.
- Si usas bot-bridge, `N8N_WEBHOOK` debe apuntar a `/webhook/discord-chat-v2` (ver [bot-bridge/index.js](bot-bridge/index.js)).

## Convenciones de prueba
- Webhook: usar `GET/POST $WEBHOOK_URL/webhook/<path>`.
- Schedule: ejecutar manualmente para validar sin esperar el cron.
- ExecuteWorkflowTrigger: usar un workflow de prueba con `Manual Trigger -> Set -> Execute Workflow`, o ejecutar desde el workflow padre.
- Validacion DB: usar como referencia [init.sql](init.sql).

## Payloads base
### ExecuteWorkflowTrigger
```json
{
  "event": {
    "source": "github",
    "event_type": "pull_request",
    "repo": "org/repo",
    "actor": "user",
    "payload": {
      "id": "evt-123",
      "title": "PR de prueba"
    }
  }
}
```

### Chat webhook
```bash
curl -sS -X POST "$WEBHOOK_URL/webhook/discord-chat-v2" \
  -H 'Content-Type: application/json' \
  -d '{"body":{"content":"!estado","user":"david"}}'
```

### PMO meeting webhook
```json
{
  "title": "Sync PM semanal",
  "objective": "Revisar riesgos y avances",
  "requested_by": "david",
  "requested_for": "2026-05-20T10:00:00-05:00",
  "duration_minutes": 30,
  "priority": "high"
}
```

### Trello fases webhook
```json
{
  "body": {
    "content": "!fase sync",
    "user": "david"
  }
}
```

### PM approve
```bash
curl -sS -X POST "$WEBHOOK_URL/webhook/pm-approve" \
  -H "X-PM-Token: $PM_APPROVAL_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"decision_id":"<uuid>","action":"approve"}'
```

## Pruebas funcionales (todo)
### Chat Discord y comandos
- Comandos: `!ayuda`, `!kpis`, `!reporte [dias]`, `!riesgos`, `!hitos`, `!revisar backend`, `!revisar frontend`, `!estado`, `!vencidas`, `!miembros`, `!commits`, `!ci`, `!progreso`, `!acciones`, `!raid`, `!logs`, `!agenda`, `!reunion [tema]`, `!fase sync`, `!fase listar`, `!doc <card_id>`.
- Esperado: respuesta en Discord, registro en `recomendaciones`, lectura de Trello/GitHub/DB y, si aplica, ejecucion de subworkflow (reporte o meeting).

### bot-bridge (Discord -> n8n)
- Enviar mensaje en Discord y verificar que llega al webhook y devuelve respuesta.
- Esperado: job en cola BullMQ y respuesta con reply; si falla, mensaje de error.

### Ingestion GitHub y Trello
- GitHub: crear `push` o `pull_request` y verificar insercion en `events_inbox` y `eventos_detectados`.
- Trello: mover una tarjeta y verificar insercion en `events_inbox` y `eventos_detectados`.

### Router + Orchestrator + agentes
- Insertar un evento `pending` en `events_inbox` y ejecutar [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/Router - Project Events.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/Router%20-%20Project%20Events.json).
- Esperado: `events_outbox` con payload, `ai_decisions` con decision del agente y alerta en Discord via outbox.

### Monitor y alertas IA
- Ejecutar [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor PetSafe.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20PetSafe.json) manualmente.
- Esperado: `analisis_proyecto` con KPIs, snapshots de tareas y, si hay problemas, ejecucion de [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor PetSafe - Alertas IA.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20PetSafe%20-%20Alertas%20IA.json).

### Reporte PDF semanal
- Ejecutar on-demand en [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Reporte PDF Semanal.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Reporte%20PDF%20Semanal.json).
- Esperado: PDF en Discord y registro en `reportes_generados`.

### Dashboards PMO (aprobaciones y logs)
- Abrir `/webhook/pm-approvals` con header `X-PM-Token`.
- Aprobar con POST `/webhook/pm-approve`.
- Abrir `/webhook/pm-logs` con header `X-PM-Token`.
- Esperado: cambios en `ai_decisions` y HTML renderizado.

### Calendario y reuniones
- GET `/webhook/pm-calendar` y POST `/webhook/pm-calendar-action`.
- POST `/webhook/pm-meeting` con payload base.
- Esperado: filas en `pmo_meetings`, `pmo_meeting_invitees`, `pmo_meeting_logs`, `pmo_meeting_reminders` y outbox de notificacion.

### Fases Trello y adjuntos
- POST `/webhook/trello-fases` con `!fase sync` y `!fase listar`.
- Ejecutar [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Trello - Sync Attachments.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Trello%20-%20Sync%20Attachments.json).
- Usar `!doc <card_id>` para resumen de PDF.

### DLQ y tolerancia a fallos
- Configurar `DISCORD_WEBHOOK_URL` a un endpoint invalido y ejecutar outbox.
- Esperado: `events_outbox` pasa a `dead` y [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor - Outbox DLQ.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20-%20Outbox%20DLQ.json) alerta via error handler.

### Error handler global
- Forzar error en cualquier workflow y validar que [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/Monitor PetSafe - Error Handler.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/Monitor%20PetSafe%20-%20Error%20Handler.json) inserte en `workflow_runs_audit` y notifique.

## Checklist por workflow (30/30)
### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Code Review Scout.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Code%20Review%20Scout.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: N/A

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Context Guardian.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Context%20Guardian.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: estado_conocido

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - PM Orchestrator.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20PM%20Orchestrator.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: N/A

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Release Guard.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Release%20Guard.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: analisis_proyecto, estado_tareas, events_outbox

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Risk Analyst & Workload Balancer.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Risk%20Analyst%20&%20Workload%20Balancer.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: estado_tareas

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Sync Bidireccional Activa.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Sync%20Bidireccional%20Activa.json)
Paso minimo: Ejecutar manual desde n8n
Validar: DB: events_outbox

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/Construir Contexto Robusto.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/Construir%20Contexto%20Robusto.json)
Paso minimo: Ejecutar manual desde n8n (schedule)
Validar: DB: estado_conocido, eventos_detectados, events_outbox

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/Monitor PetSafe - Error Handler.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/Monitor%20PetSafe%20-%20Error%20Handler.json)
Paso minimo: Ejecutar manual desde n8n
Validar: DB: workflow_runs_audit

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/Router - Project Events.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/Router%20-%20Project%20Events.json)
Paso minimo: Ejecutar manual desde n8n (schedule)
Validar: DB: events_inbox, events_outbox

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - AI Decision Logger.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20AI%20Decision%20Logger.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: ai_decisions, events_outbox

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - Audit Logger.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20Audit%20Logger.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: workflow_runs_audit

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - Config Resolver.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20Config%20Resolver.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: N/A

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - DB Seeder (estado_conocido).json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20DB%20Seeder%20(estado_conocido).json)
Paso minimo: Ejecutar manual desde n8n
Validar: DB: N/A

### [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Chat Discord PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Chat%20Discord%20PetSafe.json)
Paso minimo: Enviar POST a /webhook/discord-chat-v2
Validar: DB: ai_decisions, analisis_proyecto, events_inbox, events_outbox, hitos_proyecto, pmo_action_items, pmo_health_snapshots, pmo_meeting_invitees, pmo_meetings, pmo_raid_items, recomendaciones, workflow_runs_audit

### [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Discord Eventos GitHub PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Discord%20Eventos%20GitHub%20PetSafe.json)
Paso minimo: Ejecutar manual desde n8n
Validar: DB: eventos_detectados, events_inbox, workflow_runs_audit

### [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Discord Eventos Trello PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Discord%20Eventos%20Trello%20PetSafe.json)
Paso minimo: Ejecutar manual desde n8n
Validar: DB: eventos_detectados, events_inbox, workflow_runs_audit

### [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Executor - Discord Outbox.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Executor%20-%20Discord%20Outbox.json)
Paso minimo: Ejecutar manual desde n8n (schedule)
Validar: DB: events_outbox

### [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/DLQ - Outbox Replay.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/DLQ%20-%20Outbox%20Replay.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: events_outbox

### [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor - Outbox DLQ.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20-%20Outbox%20DLQ.json)
Paso minimo: Ejecutar manual desde n8n (schedule)
Validar: DB: events_outbox

### [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor PetSafe - Alertas IA.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20PetSafe%20-%20Alertas%20IA.json)
Paso minimo: Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: ai_decisions, analisis_proyecto, workflow_runs_audit
Validar Discord: debe enviar varias partes cortas (resumen/KPIs, fases, commits interpretados, entregables/CI/hitos, diagnostico IA) en lugar de un solo mensaje largo.

### [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor PetSafe.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20PetSafe.json)
Paso minimo: Ejecutar manual desde n8n (schedule)
Validar: DB: ai_decisions, analisis_proyecto, hitos_proyecto, workflow_runs_audit

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Dashboard - PM Approval Hub.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Dashboard%20-%20PM%20Approval%20Hub.json)
Paso minimo: Enviar GET a /webhook/pm-approvals; Enviar POST a /webhook/pm-approve
Validar: DB: ai_decisions, card_attachments, estado_tareas, events_inbox, events_outbox, project_phases, reportes_generados, workflow_runs_audit

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Dashboard - PM Logs Hub.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Dashboard%20-%20PM%20Logs%20Hub.json)
Paso minimo: Enviar GET a /webhook/pm-logs
Validar: DB: events_inbox, events_outbox, pmo_action_items, pmo_health_snapshots, pmo_meeting_logs, pmo_meetings, pmo_raid_items, workflow_runs_audit

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Calendar Hub.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Calendar%20Hub.json)
Paso minimo: Enviar GET a /webhook/pm-calendar; Enviar POST a /webhook/pm-calendar-action
Validar: DB: events_outbox, pmo_meeting_invitees, pmo_meeting_logs, pmo_meeting_reminders, pmo_meetings

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Governance Engine.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Governance%20Engine.json)
Paso minimo: Ejecutar manual desde n8n (schedule); Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: ai_decisions, card_attachments, estado_tareas, events_inbox, events_outbox, pmo_action_items, pmo_health_snapshots, pmo_meetings, pmo_raid_items

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Meeting Coordinator.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Meeting%20Coordinator.json)
Paso minimo: Enviar POST a /webhook/pm-meeting; Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: events_outbox, pmo_calendar_members, pmo_meeting_invitees, pmo_meeting_logs, pmo_meeting_reminders, pmo_meetings

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Meeting Reminder Executor.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Meeting%20Reminder%20Executor.json)
Paso minimo: Ejecutar manual desde n8n (schedule)
Validar: DB: events_outbox, pmo_meeting_invitees, pmo_meeting_reminders, pmo_meetings

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Reporte PDF Semanal.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Reporte%20PDF%20Semanal.json)
Paso minimo: Ejecutar manual desde n8n (schedule); Ejecutar desde workflow padre o manual con Execute Workflow
Validar: DB: ai_decisions, analisis_proyecto, destinatarios_reporte, estado_tareas, eventos_detectados, hitos_proyecto, recomendaciones, reportes_generados, workflow_runs_audit

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Trello - Gestion de Fases.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Trello%20-%20Gestion%20de%20Fases.json)
Paso minimo: Enviar POST a /webhook/trello-fases
Validar: DB: card_attachments, estado_tareas, project_phases

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Trello - Sync Attachments.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Trello%20-%20Sync%20Attachments.json)
Paso minimo: Ejecutar manual desde n8n (schedule)
Validar: DB: card_attachments, estado_tareas

## Post-checks
- Workflows con webhook/schedule deben quedar activos y sin errores recientes.
- Confirmar que los workflows criticos tengan `errorWorkflow` apuntando al handler.
