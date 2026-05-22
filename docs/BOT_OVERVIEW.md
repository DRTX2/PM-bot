# PetSafe PM AI - Overview del bot

## Resumen
Sistema n8n orientado a PM/AI que recibe eventos desde GitHub/Trello/Discord, normaliza en Postgres, ejecuta analisis con agentes Gemini y notifica por Discord. Usa Postgres para estado e inbox/outbox, Redis para cache/memoria conversacional y Gotenberg para PDF. El puente Discord corre en [bot-bridge/index.js](bot-bridge/index.js) y enruta mensajes hacia el webhook de chat.

## Componentes
- n8n: orquestador de workflows, agentes Gemini y dashboards por webhook.
- Postgres: estado operativo, inbox/outbox, auditoria y datos PMO (ver [init.sql](init.sql)).
- Redis: cache de KPIs, deduplicacion y memoria conversacional.
- Gotenberg: render HTML a PDF para reportes.
- bot-bridge: cliente Discord + cola BullMQ que llama `N8N_WEBHOOK` (debe apuntar a `/webhook/discord-chat-v2`).

## Entradas y salidas
- Webhooks: `/webhook/discord-chat-v2`, `/webhook/pm-approvals`, `/webhook/pm-approve`, `/webhook/pm-logs`, `/webhook/pm-calendar`, `/webhook/pm-calendar-action`, `/webhook/pm-meeting`, `/webhook/trello-fases`.
- Triggers nativos: GitHub y Trello (workflows de eventos).
- Schedules: monitor diario, gobernanza PMO, outbox, DLQ, sync de adjuntos y contexto robusto.
- Salidas: Discord (outbox o webhook directo), PDFs (Discord), actualizaciones en Postgres.

## Modelo de datos
- Inbox/outbox y auditoria: `events_inbox`, `events_outbox`, `workflow_runs_audit`.
- Decision IA: `ai_decisions`.
- Monitoreo y estado: `analisis_proyecto`, `estado_tareas`, `hitos_proyecto`, `recomendaciones`.
- PMO: `pmo_meetings`, `pmo_meeting_invitees`, `pmo_meeting_logs`, `pmo_meeting_reminders`, `pmo_action_items`, `pmo_raid_items`, `pmo_health_snapshots`.
- Reporting y archivos: `reportes_generados`, `destinatarios_reporte`, `project_phases`, `card_attachments`.

## Relaciones clave entre workflows
- [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Chat Discord PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Chat%20Discord%20PetSafe.json) -> [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Meeting Coordinator.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Meeting%20Coordinator.json) -> [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Meeting Reminder Executor.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Meeting%20Reminder%20Executor.json) -> [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Executor - Discord Outbox.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Executor%20-%20Discord%20Outbox.json).
- [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Discord Eventos GitHub PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Discord%20Eventos%20GitHub%20PetSafe.json) -> [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/Router - Project Events.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/Router%20-%20Project%20Events.json) -> [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - PM Orchestrator.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20PM%20Orchestrator.json) -> agentes -> outbox.
- [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Discord Eventos Trello PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Discord%20Eventos%20Trello%20PetSafe.json) -> [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/Router - Project Events.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/Router%20-%20Project%20Events.json) -> orquestador -> agentes -> outbox.
- [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor PetSafe.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20PetSafe.json) -> [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor PetSafe - Alertas IA.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20PetSafe%20-%20Alertas%20IA.json).
- [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Reporte PDF Semanal.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Reporte%20PDF%20Semanal.json) -> Discord.
- [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - AI Decision Logger.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20AI%20Decision%20Logger.json) -> approvals/outbox -> dashboards.

## Detalle por workflow (nodos relevantes, tablas, triggers)
### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Code Review Scout.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Code%20Review%20Scout.json)
Entrada: executeWorkflowTrigger
Subworkflows: System - AI Decision Logger
Integraciones: LangChain/Gemini
Tablas: N/A
Nodos relevantes: Execute Workflow Trigger, Extract PR Details, Gemini PR Reviewer, Google Gemini Model Pro, Parse Review JSON, Log AI Decision

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Context Guardian.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Context%20Guardian.json)
Entrada: executeWorkflowTrigger
Subworkflows: System - AI Decision Logger
Integraciones: LangChain/Gemini, Postgres
Tablas: estado_conocido
Nodos relevantes: Execute Workflow Trigger, Fetch Project Rules, Prepare Guardian Context, Gemini Context Guardian, Google Gemini Model Pro, Normalize Guardian Output, Log AI Decision

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - PM Orchestrator.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20PM%20Orchestrator.json)
Entrada: executeWorkflowTrigger
Subworkflows: System - AI Decision Logger, AI - Code Review Scout, AI - Risk Analyst & Workload Balancer, AI - Context Guardian, AI - Release Guard
Integraciones: N/A
Tablas: N/A
Nodos relevantes: Execute Workflow Trigger, Prepare Context, Merge Routing Decision, Prepare Log Payload, Log AI Decision, Route to Sub-Agent, Call Code Review Scout, Call Risk Analyst, Call Context Guardian, No Agent Selected, Call Release Guard, Rule-Based Routing

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Release Guard.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Release%20Guard.json)
Entrada: executeWorkflowTrigger
Subworkflows: System - AI Decision Logger
Integraciones: LangChain/Gemini, Postgres
Tablas: analisis_proyecto, estado_tareas, events_outbox
Nodos relevantes: Execute Workflow Trigger, Fetch Last Analysis, Fetch At-Risk Tasks, Merge Release Context, Gemini Release Guard, Google Gemini Model Pro, Parse Release Decision, Build Release Message, Queue Release Outbox, Prepare Log Payload, Log Release Decision

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Risk Analyst & Workload Balancer.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Risk%20Analyst%20&%20Workload%20Balancer.json)
Entrada: executeWorkflowTrigger
Subworkflows: System - AI Decision Logger
Integraciones: LangChain/Gemini, Postgres
Tablas: estado_tareas
Nodos relevantes: Execute Workflow Trigger, Fetch Current WIP, Prepare Risk Context, Gemini Risk Analyst, Google Gemini Model Pro, Parse Risk JSON, Log AI Decision

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/AI - Sync Bidireccional Activa.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/AI%20-%20Sync%20Bidireccional%20Activa.json)
Entrada: sin trigger
Subworkflows: System - AI Decision Logger
Integraciones: Postgres, Trello
Tablas: events_outbox
Nodos relevantes: Verify Merged & Extract Context, Should Sync?, Has Trello Card ID?, Archive Trello Card, Comment on Trello Card, Mark Trello Done, Build Discord Notification, Queue Discord Outbox, Prepare Log Payload, Log Sync Action

### [bot/1. 🧠 AI Intelligence (Agentes Especializados)/Construir Contexto Robusto.json](bot/1.%20🧠%20AI%20Intelligence%20(Agentes%20Especializados)/Construir%20Contexto%20Robusto.json)
Entrada: schedule
Subworkflows: N/A
Integraciones: HTTP Request, LangChain/Gemini, Postgres
Tablas: estado_conocido, eventos_detectados, events_outbox
Nodos relevantes: Schedule Trigger1, Trello Cards Delta1, GitHub Back Main1, GitHub Front Main1, PG Estado Conocido1, Delta Detector1, PG Update Estado1, IF Hay Eventos1, Split Events1, Preparar Prompt Evento1, Gemini Event Analysis1, Build Discord Msg1, Google Gemini Model1, Queue Discord Outbox1, PG Insert Evento1

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/Monitor PetSafe - Error Handler.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/Monitor%20PetSafe%20-%20Error%20Handler.json)
Entrada: sin trigger
Subworkflows: N/A
Integraciones: HTTP Request, Postgres
Tablas: workflow_runs_audit
Nodos relevantes: Alerta a Discord, Audit Log Error

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/Router - Project Events.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/Router%20-%20Project%20Events.json)
Entrada: schedule
Subworkflows: workflowId jT21FJtXSh2U8D0s (resolver en n8n)
Integraciones: Postgres
Tablas: events_inbox, events_outbox
Nodos relevantes: Schedule Trigger, Fetch Ingested Events, Call Orchestrator, Build Outbox Payload, Insert Outbox, Mark Processed

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - AI Decision Logger.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20AI%20Decision%20Logger.json)
Entrada: executeWorkflowTrigger
Subworkflows: N/A
Integraciones: Postgres
Tablas: ai_decisions, events_outbox
Nodos relevantes: Execute Workflow Trigger, Validate & Format, Insert AI Decision, Requires Approval?, Build Approval Alert, Queue Alert in Outbox

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - Audit Logger.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20Audit%20Logger.json)
Entrada: executeWorkflowTrigger
Subworkflows: N/A
Integraciones: Postgres
Tablas: workflow_runs_audit
Nodos relevantes: Execute Workflow Trigger, Insert Audit Record

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - Config Resolver.json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20Config%20Resolver.json)
Entrada: executeWorkflowTrigger
Subworkflows: N/A
Integraciones: N/A
Tablas: N/A
Nodos relevantes: On Execute

### [bot/2. ⚙️ Core System (Infraestructura y Ruteo)/System - DB Seeder (estado_conocido).json](bot/2.%20⚙️%20Core%20System%20(Infraestructura%20y%20Ruteo)/System%20-%20DB%20Seeder%20(estado_conocido).json)
Entrada: sin trigger
Subworkflows: N/A
Integraciones: Postgres
Tablas: N/A
Nodos relevantes: Define Seed Data, Upsert Estado Conocido

### [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Chat Discord PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Chat%20Discord%20PetSafe.json)
Entrada: webhook /webhook/discord-chat-v2 POST
Subworkflows: Reporte PDF Semanal, PMO - Meeting Coordinator
Integraciones: GitHub, HTTP Request, LangChain/Gemini, Postgres, Redis
Tablas: ai_decisions, analisis_proyecto, events_inbox, events_outbox, hitos_proyecto, pmo_action_items, pmo_health_snapshots, pmo_meeting_invitees, pmo_meetings, pmo_raid_items, recomendaciones, workflow_runs_audit
Nodos relevantes: Discord Webhook1, Router Comandos1, Switch Tipo1, Trigger Reporte PDF1, Postgres Ultimo KPI1, Formatear KPIs1, Trello Cards1, Trello Lists1, Trello Members1, GH Back Commits1, GH Front Commits1, GH Back PRs1, GH Front PRs1, PG Historial1, PG Recomendaciones1, IF Necesita Diff1, Diff Backend1, Diff Frontend1, Construir Contexto1, Gemini Chat1, Guardar Q&A1, PG Hitos1, IF Es Ayuda1, IF Es Error1, IF Es Reporte1, IF Es KPIs1, Google Gemini Chat Model1, Redis Chat Memory1, Calculator1, Redis Dedup Check1, IF Duplicado1, Redis Dedup Set1, Redis Get KPIs Cache1, IF KPIs Cacheados1, Redis Set KPIs Cache1, IF Datos Rapidos1, Switch Formato1, Formatear Estado1, Formatear Vencidas1, Formatear Miembros1, Formatear Commits1, Formatear CI1, Formatear Progreso1, Tool Buscar Trello1, Tool Ver CI Backend, Tool Workflow Crear Tarjeta1, GH Back CI Runs, GH Front CI Runs, Decision Ledger Chat, Audit Success, Tool Ver CI Frontend, PG PMO Command Data, Format PMO Command, Prepare Meeting Command, Execute Meeting Coordinator, Format Meeting Response

### [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Discord Eventos GitHub PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Discord%20Eventos%20GitHub%20PetSafe.json)
Entrada: sin trigger
Subworkflows: N/A
Integraciones: HTTP Request, Postgres
Tablas: eventos_detectados, events_inbox, workflow_runs_audit
Nodos relevantes: Normalizar Evento GitHub1, IF Evento GitHub Relevante1, Discord Evento GitHub1, PG Insert Evento GitHub1, PG Insert Inbox GitHub1, IF Inbox GitHub Nuevo1, Audit Success

### [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Discord Eventos Trello PetSafe.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Discord%20Eventos%20Trello%20PetSafe.json)
Entrada: sin trigger
Subworkflows: N/A
Integraciones: HTTP Request, Postgres
Tablas: eventos_detectados, events_inbox, workflow_runs_audit
Nodos relevantes: Normalizar Evento Trello, IF Evento Trello Relevante, Discord Evento Trello, PG Insert Evento Trello, PG Insert Inbox Trello, IF Inbox Trello Nuevo, Audit Success

### [bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/Executor - Discord Outbox.json](bot/3.%20💬%20Communication%20&%20Events%20(Canales%20de%20Entrada%20o%20Salida)/Executor%20-%20Discord%20Outbox.json)
Entrada: schedule
Subworkflows: N/A
Integraciones: HTTP Request, Postgres
Tablas: events_outbox
Nodos relevantes: Schedule Trigger, Fetch Pending Outbox, Has Outbox?, Send Discord, Success?, Mark Sent, Mark Failed

### [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/DLQ - Outbox Replay.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/DLQ%20-%20Outbox%20Replay.json)
Entrada: executeWorkflowTrigger
Subworkflows: N/A
Integraciones: Postgres
Tablas: events_outbox
Nodos relevantes: Execute Workflow Trigger, Replay Dead Outbox

### [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor - Outbox DLQ.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20-%20Outbox%20DLQ.json)
Entrada: schedule
Subworkflows: N/A
Integraciones: HTTP Request, Postgres
Tablas: events_outbox
Nodos relevantes: Schedule Trigger, Fetch Dead Outbox, Has Dead?, Format DLQ Message, Send DLQ Alert

### [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor PetSafe - Alertas IA.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20PetSafe%20-%20Alertas%20IA.json)
Entrada: executeWorkflowTrigger
Subworkflows: N/A
Integraciones: HTTP Request, LangChain/Gemini, Postgres, Redis
Tablas: ai_decisions, analisis_proyecto, workflow_runs_audit
Nodos relevantes: On-Demand Trigger, Preparar Prompt, Gemini Análisis, Build Discord Payload, Guardar Recomendación IA, Discord Alerta, Google Gemini Model, Redis Store Last Report, Decision Ledger Monitor, Audit Success

### [bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/Monitor PetSafe.json](bot/4.%20🛠️%20Monitoring%20&%20Reliability%20(Salud%20del%20Sistema)/Monitor%20PetSafe.json)
Entrada: schedule
Subworkflows: Monitor PetSafe - Alertas IA
Integraciones: GitHub, HTTP Request, Postgres, Redis
Tablas: ai_decisions, analisis_proyecto, hitos_proyecto, workflow_runs_audit
Nodos relevantes: Schedule Trigger, Trello Cards, Trello Lists, Trello Members, Trello Checklists, GitHub Back Commits, GitHub Front Commits, GitHub Back PRs, GitHub Front PRs, GitHub Back CI Runs, GitHub Front CI Runs, Postgres Historial, Postgres Hitos, Análisis + KPIs, Guardar Análisis, Guardar Snapshot Tareas, Insert Snapshot, IF Hay Problemas, Redis Check Mon Cache, IF Mon Cached, Parse Mon Cache, Redis Store Mon Cache, Generar Alerta IA, Audit Success, Decision Ledger Monitor

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Dashboard - PM Approval Hub.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Dashboard%20-%20PM%20Approval%20Hub.json)
Entrada: webhook /webhook/pm-approvals GET, webhook /webhook/pm-approve POST
Subworkflows: N/A
Integraciones: Postgres
Tablas: ai_decisions, card_attachments, estado_tareas, events_inbox, events_outbox, project_phases, reportes_generados, workflow_runs_audit
Nodos relevantes: Webhook - Dashboard, Fetch Pending Approvals, Build Dashboard HTML, Webhook - Approve Action, Validate Token & Input, Update Decision Status, Build Approval Notification, Queue Discord Approval

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Dashboard - PM Logs Hub.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Dashboard%20-%20PM%20Logs%20Hub.json)
Entrada: webhook /webhook/pm-logs GET
Subworkflows: N/A
Integraciones: Postgres
Tablas: events_inbox, events_outbox, pmo_action_items, pmo_health_snapshots, pmo_meeting_logs, pmo_meetings, pmo_raid_items, workflow_runs_audit
Nodos relevantes: Webhook - Logs, Validate Logs Token, Fetch Logs, Build Logs HTML

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Calendar Hub.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Calendar%20Hub.json)
Entrada: webhook /webhook/pm-calendar GET, webhook /webhook/pm-calendar-action POST
Subworkflows: N/A
Integraciones: Postgres
Tablas: events_outbox, pmo_meeting_invitees, pmo_meeting_logs, pmo_meeting_reminders, pmo_meetings
Nodos relevantes: Webhook - Calendar, Validate Calendar Token, Fetch Calendar, Build Calendar HTML, Webhook - Calendar Action, Validate Action Token, Update Calendar Action

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Governance Engine.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Governance%20Engine.json)
Entrada: schedule, executeWorkflowTrigger
Subworkflows: N/A
Integraciones: Postgres
Tablas: ai_decisions, card_attachments, estado_tareas, events_inbox, events_outbox, pmo_action_items, pmo_health_snapshots, pmo_meetings, pmo_raid_items
Nodos relevantes: Schedule - PMO Governance, Execute Workflow Trigger, Fetch PMO Signals, Analyze Governance Health, Persist PMO Governance, Return Governance Result

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Meeting Coordinator.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Meeting%20Coordinator.json)
Entrada: webhook /webhook/pm-meeting POST, executeWorkflowTrigger
Subworkflows: N/A
Integraciones: Postgres
Tablas: events_outbox, pmo_calendar_members, pmo_meeting_invitees, pmo_meeting_logs, pmo_meeting_reminders, pmo_meetings
Nodos relevantes: Webhook - Meeting Request, Execute Workflow Trigger, Normalize Meeting Request, Normalize Execute Request, Schedule Meeting Safely, Build Meeting Notification, Queue Meeting Notification, Switch Meeting Entry, Return Meeting Result

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/PMO - Meeting Reminder Executor.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/PMO%20-%20Meeting%20Reminder%20Executor.json)
Entrada: schedule
Subworkflows: N/A
Integraciones: Postgres
Tablas: events_outbox, pmo_meeting_invitees, pmo_meeting_reminders, pmo_meetings
Nodos relevantes: Schedule Trigger, Fetch Due Reminders, Split Reminders, Queue Reminder

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Reporte PDF Semanal.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Reporte%20PDF%20Semanal.json)
Entrada: schedule, executeWorkflowTrigger
Subworkflows: N/A
Integraciones: Discord, HTTP Request, Postgres
Tablas: ai_decisions, analisis_proyecto, destinatarios_reporte, estado_tareas, eventos_detectados, hitos_proyecto, recomendaciones, reportes_generados, workflow_runs_audit
Nodos relevantes: Schedule Viernes 18:00, On-Demand Trigger, PG Análisis 7d, PG Último Análisis, PG Tareas Vencidas, PG Hitos Próximos, PG Eventos 7d, PG Recomendaciones, PG Destinatarios, GitHub Back 7d, GitHub Front 7d, Build Report Data, Gemini Deep Analysis, Build HTML + Binary, Gotenberg HTML→PDF, Rename PDF, Discord Upload PDF, PG Log Reporte, Discord Upload PDF2, Audit Success, Decision Ledger Report, GitHub Back PRs, GitHub Front PRs, IF Deuda Técnica, Build PM Request, Discord PM Debt Alert, PG Guardar Solicitud Deuda

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Trello - Gestion de Fases.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Trello%20-%20Gestion%20de%20Fases.json)
Entrada: webhook /webhook/trello-fases POST
Subworkflows: workflowId jT21FJtXSh2U8D0s (resolver en n8n)
Integraciones: HTTP Request, LangChain/Gemini, Postgres
Tablas: card_attachments, estado_tareas, project_phases
Nodos relevantes: Webhook Discord Command, Parse Phase Command, Route Action, PG List Phases, Format Phase List, Trello Get Lists, Prepare Sync Rows, Upsert Phase, PG Add Phase, Build Edit Query, PG Edit Phase, PG Archive Phase, Fetch Card Attachments, Has Attachment?, Already Summarized?, Gemini PDF Summarizer, Google Gemini Flash, Save Summary to DB, Format PDF Response, Build Success Message, Notify Orchestrator

### [bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/Trello - Sync Attachments.json](bot/5.%20📊%20PMO%20&%20Reporting%20(Gestion%20y%20Seguimiento)/Trello%20-%20Sync%20Attachments.json)
Entrada: schedule
Subworkflows: N/A
Integraciones: HTTP Request, Postgres
Tablas: card_attachments, estado_tareas
Nodos relevantes: Schedule Trigger 6h, Fetch Active Card IDs, Fetch Trello Attachments, Extract PDF Attachments, Has PDFs?, Upsert Attachment Metadata

## Por que esta organizado asi
- Separar ingestion, decision IA y ejecucion reduce acoplamiento y facilita reintentos.
- Orquestador central + agentes especializados simplifican el ruteo y la escalabilidad.
- Outbox + DLQ permiten control de envios y tolerancia a fallos.
- Schedules dedicados cubren monitoreo y reporting sin bloquear el chat.
- Dashboards por webhook permiten aprobacion humana y trazabilidad.
- Error handler global centraliza alertas operativas.

## Docs relacionadas
- [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md)
- [docs/WORKFLOW_TESTING.md](docs/WORKFLOW_TESTING.md)
- [bot/README.md](bot/README.md)
- [bot/FUNCIONALIDADES_Y_PRUEBAS.md](bot/FUNCIONALIDADES_Y_PRUEBAS.md)
- [bot/TEST_PLAN_PM_AI.md](bot/TEST_PLAN_PM_AI.md)
