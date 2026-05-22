# Workflows PetSafe

Mapa rápido de los workflows actuales en `bot/`, organizados igual que en n8n.

Para la revision senior completa y roadmap de produccion, ver `ARQUITECTURA_PM_AI_PETSAFE.md`.
Para operar o validar infraestructura de produccion, ver `../docs/PRODUCTION_RUNBOOK.md`.

## 1. AI Intelligence (Agentes Especializados)

Ruta: `bot/1. 🧠 AI Intelligence (Agentes Especializados)/`

- `AI - Code Review Scout.json`: revisa señales tecnicas de PRs/cambios y propone comentarios o alertas.
- `AI - Context Guardian.json`: cuida coherencia de arquitectura, reglas y decisiones de producto.
- `AI - PM Orchestrator.json`: decide que subagente debe atender un evento.
- `AI - Release Guard.json`: evalua señales de release, riesgo y preparacion de entrega.
- `AI - Risk Analyst & Workload Balancer.json`: analiza riesgos, carga, bloqueos y prioridades.
- `AI - Sync Bidireccional Activa.json`: sincroniza PRs mergeados con Trello y registra acciones.
- `Construir Contexto Robusto.json`: detector programado de deltas/eventos y contexto PM.

## 2. Core System (Infraestructura y Ruteo)

Ruta: `bot/2. ⚙️ Core System (Infraestructura y Ruteo)/`

- `Router - Project Events.json`: distribuye eventos del inbox hacia orquestador/outbox y marca procesamiento.
- `System - AI Decision Logger.json`: registra decisiones IA, deduplica y alimenta Approval Hub.
- `System - Audit Logger.json`: centraliza auditoria de ejecuciones y acciones.
- `System - Config Resolver.json`: resuelve configuracion operativa desde env/DB.
- `System - DB Seeder (estado_conocido).json`: seed inicial de estado conocido.
- `Monitor PetSafe - Error Handler.json`: error workflow global para fallos de ejecucion.
- `WF_PM_Router_Intenciones.json`: router del bot Project Manager para Discord; clasifica `/pm` y lenguaje natural.
- `System - PM Schema Manager.json`: crea/valida tablas PM en Postgres.
- `WF_PM_Error_Handler.json`: captura errores de workflows PM, guarda trazas y notifica al canal admin/log.

## 3. Communication & Events (Canales de Entrada o Salida)

Ruta: `bot/3. 💬 Communication & Events (Canales de Entrada o Salida)/`

- `Chat Discord PetSafe.json`: entrada principal `POST /webhook/discord-chat-v2`, comandos rapidos, contexto para chat y agente Gemini nativo.
- `WF_PM_Discord_Entrada.json`: entrada rapida `POST /webhook/pm-discord-entrada` para comandos `/pm` y canales PM; evita el flujo conversacional pesado.
- `Discord Eventos GitHub PetSafe.json`: trigger nativo de GitHub, normaliza eventos relevantes y guarda el evento.
- `Discord Eventos Trello PetSafe.json`: trigger nativo de Trello, normaliza eventos relevantes y guarda el evento.
- `Executor - Discord Outbox.json`: envia mensajes pendientes a Discord con control de estado/retries.

La entrada PM puede usar dos rutas. La rapida recomendada es `bot-bridge -> /webhook/pm-discord-entrada -> WF_PM_Router_Intenciones`. La ruta compatible sigue disponible en `discord-chat-v2`, donde `Chat Discord PetSafe` detecta `/pm` y reenvia al router.

Comandos PMO disponibles desde Discord:

- `!acciones`: lista acciones PMO abiertas con owner, prioridad y deadline.
- `!raid`: lista riesgos, issues, assumptions y dependencias abiertas.
- `!logs`: muestra salud del bot, errores recientes, inbox/outbox y ruta del panel de logs.
- `!agenda`: muestra las proximas reuniones del calendario PMO interno.
- `!reunion [tema]`: agenda reunion PMO sin Google/Outlook, sugiere invitados, evita choques y registra logs.

## 4. Monitoring & Reliability (Salud del Sistema)

Ruta: `bot/4. 🛠️ Monitoring & Reliability (Salud del Sistema)/`

- `Monitor PetSafe.json`: schedule principal, cache, recoleccion Trello/GitHub/Postgres, calculo de KPIs, snapshots y decision de alerta.
- `Monitor PetSafe - Alertas IA.json`: diagnostico IA cuando el monitor detecta problemas.
- `Monitor - Outbox DLQ.json`: vigila mensajes muertos o fallidos del outbox.
- `DLQ - Outbox Replay.json`: replay controlado de mensajes del outbox.

## 5. PMO & Reporting (Gestion y Seguimiento)

Ruta: `bot/5. 📊 PMO & Reporting (Gestion y Seguimiento)/`

- `Reporte PDF Semanal.json`: reporte semanal y on-demand desde Discord.
- `Dashboard - PM Approval Hub.json`: panel seguro de aprobaciones humanas `GET /webhook/pm-approvals?token=...`.
- `Dashboard - PM Logs Hub.json`: panel seguro de auditoria `GET /webhook/pm-logs?token=...`.
- `PMO - Governance Engine.json`: motor diario de gobierno PMO, RAID, acciones y health score.
- `PMO - Calendar Hub.json`: calendario PMO interno `GET /webhook/pm-calendar?token=...`, con confirmar/cancelar/finalizar.
- `PMO - Meeting Coordinator.json`: agenda reuniones, determina invitados, evita traslapes y crea recordatorios.
- `PMO - Meeting Reminder Executor.json`: ejecutor programado de recordatorios de reuniones por Discord outbox.
- `Trello - Gestion de Fases.json`: soporte PMO para fases del tablero Trello.
- `Trello - Sync Attachments.json`: sincroniza adjuntos/PDFs de Trello para evidencia y reporting.
- `WF_PM_Tareas.json`: crea, lista, asigna, actualiza y detecta atrasos de tareas PM.
- `WF_PM_Avances.json`: registra avances diarios o por tarea y resume avances del dia.
- `WF_PM_Bloqueos_Riesgos.json`: registra bloqueos y riesgos con severidad/prioridad calculada.
- `WF_PM_Reportes.json`: genera estado general, reporte diario y semanal con tareas, bloqueos, riesgos, entregables y decisiones.
- `WF_PM_Reuniones.json`: prepara agenda de seguimiento y guarda registro de reunion.
- `WF_PM_Entregables.json`: registra y consulta entregables del proyecto.
- `WF_PM_Decisiones.json`: registra y lista decisiones para trazabilidad.
- `WF_PM_Retrospectiva.json`: registra elementos de retrospectiva y acciones de mejora.
- `WF_PM_Recordatorios.json`: recordatorio programado de atrasos y entregables proximos.
- `WF_PM_Admin.json`: estado del bot, storage, outbox, variables y ultimos comandos.

## Bot Project Manager Discord

Este bot no es asistente clinico ni soporte a clientes. Su rol es Project Manager automatizado para el equipo PetSafe.

### Canales

- `#tareas-petsafe` (`DISCORD_CHANNEL_TAREAS`): tareas, asignaciones y actualizaciones.
- `#avances-diarios` (`DISCORD_CHANNEL_AVANCES`): check-ins y progreso.
- `#bloqueos` (`DISCORD_CHANNEL_BLOQUEOS`): impedimentos y problemas urgentes.
- `#riesgos` (`DISCORD_CHANNEL_RIESGOS`): riesgos, impacto y mitigacion.
- `#reportes-pm` (`DISCORD_CHANNEL_REPORTES`): reportes diarios/semanales y estado general.
- `#reuniones` (`DISCORD_CHANNEL_REUNIONES`): agendas, actas, acuerdos y decisiones.
- `#entregables` (`DISCORD_CHANNEL_ENTREGABLES`): documentos, versiones y fechas limite.
- `#bot-log` (`DISCORD_CHANNEL_BOT_LOG`): logs operativos.
- `#admin-bot` (`DISCORD_CHANNEL_ADMIN`): comandos administrativos.

### Variables requeridas

Configurar en `.env` y exponer al servicio `n8n`: `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_TAREAS`, `DISCORD_CHANNEL_AVANCES`, `DISCORD_CHANNEL_BLOQUEOS`, `DISCORD_CHANNEL_REPORTES`, `DISCORD_CHANNEL_REUNIONES`, `DISCORD_CHANNEL_ENTREGABLES`, `DISCORD_CHANNEL_RIESGOS`, `DISCORD_CHANNEL_BOT_LOG`, `DISCORD_CHANNEL_ADMIN`, `PM_STORAGE_TYPE=postgres`, `PM_TIMEZONE=America/Guayaquil`.

Para respuestas mas rapidas desde `bot-bridge`: `N8N_PM_WEBHOOK=http://localhost:5678/webhook/pm-discord-entrada`, `PM_FAST_PATH_ENABLED=true`, `PM_FAST_TIMEOUT_MS=10000`, `PM_CHANNEL_IDS` con los IDs de canales PM separados por coma.

### Comandos principales

- `/pm ayuda`
- `/pm estado`
- `/pm tarea crear ...`, `/pm tarea listar`, `/pm tarea actualizar #id estado: en_progreso`, `/pm tarea asignar #id responsable: Nombre`
- `/pm avance registrar #id 40% ...`
- `/pm bloqueo registrar ...`
- `/pm riesgo registrar ... probabilidad: alta impacto: critico`
- `/pm reporte diario`, `/pm reporte semanal`
- `/pm reunion preparar ...`
- `/pm decision registrar ...`
- `/pm entregable registrar ...`
- `/pm pendientes`, `/pm atrasos`, `/pm sprint estado`
- `/pm retrospectiva bien|mejorar|accion ...`
- `/pm admin estado`

Tambien entiende frases como "crea una tarea para revisar el Project Charter", "tengo un bloqueo con la integracion del bot" o "genera un reporte semanal del proyecto".

### Storage

La persistencia PM usa Postgres con la credencial n8n existente `Postgres account`. Ejecutar/importar primero `System - PM Schema Manager.json` para crear o validar `pm_tareas`, `pm_avances`, `pm_bloqueos`, `pm_riesgos`, `pm_decisiones`, `pm_entregables`, `pm_retrospectivas`, `pm_reuniones`, `pm_command_log`, `pm_bot_errors` y `events_outbox`.

### Pruebas rapidas

1. Importar los workflows `WF_PM_*` y ejecutar manualmente `System - PM Schema Manager`.
2. Activar `WF_PM_Discord_Entrada`, `Chat Discord PetSafe`, `Executor - Discord Outbox`, `WF_PM_Recordatorios` y `WF_PM_Error_Handler`.
3. Enviar en Discord: `/pm ayuda`.
4. Probar tarea: `/pm tarea crear Revisar Project Charter responsable: David limite: 2026-05-30 prioridad: alta`.
5. Probar avance: `/pm avance registrar #1 40% complete la revision inicial`.
6. Probar bloqueo: `/pm bloqueo registrar #1 no tengo acceso al repositorio prioridad: alta`.
7. Probar reporte: `/pm reporte diario`.
8. Probar admin desde `#admin-bot`: `/pm admin estado`.

### Approval Hub

El dashboard de aprobaciones sigue siendo una pagina servida por n8n: `GET /webhook/pm-approvals?token=PM_APPROVAL_SECRET`. Mantenerlo dentro de n8n es la opcion recomendada mientras la necesidad sea revisar, aprobar, rechazar y dejar trazabilidad sin login complejo.

Mejoras incluidas:

- Aprobacion con nota de contexto.
- Rechazo con motivo obligatorio por prompt.
- Boton `Aprobar + tarea` para crear automaticamente una tarea PM en `pm_tareas` con fecha para el dia siguiente.
- Playbook PM por severidad para guiar la decision.
- Registro de `approval_note`, `rejected_reason` y `approval_metadata` en `ai_decisions`.
- Notificacion a Discord con nota y tarea creada cuando aplique.

Conviene separar a una app web externa solo si se requiere autenticacion por usuario/rol, sesiones, edicion avanzada, historiales navegables o UI con estado complejo. Para el alcance actual, el webhook HTML mantiene menos piezas moviles.

## Notas de importacion

1. Importar primero workflows hijos/soporte: error handler, alertas IA, loggers, config resolver y workflows PMO auxiliares.
2. Importar despues los principales: `Chat Discord PetSafe`, `Monitor PetSafe`, `Router - Project Events` y dashboards.
3. Activar explicitamente los workflows con webhooks/schedules que correspondan en n8n.
4. Si importas por carpetas en n8n, replica estas cinco categorias para mantener el mapa operativo.

## Cambios recientes

- Los workflows quedan organizados fisicamente en cinco carpetas dentro de `bot/`.
- El bot tiene calendario PMO interno sin Google/Outlook: agenda prudente, evita choques por invitado y genera recordatorios.
- `Reporte PDF Semanal` usa `chainLlm` + `lmChatGoogleGemini` para el resumen ejecutivo.
- Los workflows criticos enlazan al error handler global.
