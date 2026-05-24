# Guia de pruebas avanzada - Bot Project Manager AI PetSafe

Este documento sirve para evaluar el bot en funcionamiento real, no solo para comprobar que "responde". La idea es validar calidad operativa: canal correcto, comando correcto, workflow involucrado, persistencia, manejo de estados, trazabilidad, casos borde y comportamiento ante errores.

## 1. Alcance de la prueba

El bot PetSafe PM AI opera sobre:

- Discord como interfaz principal.
- `bot-bridge` como puente Discord -> n8n.
- n8n como motor de workflows.
- Postgres como persistencia operacional.
- Redis para deduplicacion/cache/memoria.
- GitHub y Trello como fuentes de datos del proyecto.
- Gemini como motor de analisis IA.
- Gotenberg para generar PDFs.

Las pruebas cubren:

- Comandos PM modernos `/pm`.
- Comandos legacy `!`.
- Eventos externos GitHub/Trello.
- Reportes, dashboards, calendario, aprobaciones y DLQ.
- Casos borde, entradas invalidas, duplicados, permisos y errores externos.

## 2. Mapa de canales Discord real

Canales visibles actualmente en Discord:

```text
#general
#alertas-proyecto
#chat-agente
#📋-tareas
#🚧-bloqueos
#📊-reportes
#📅-reuniones
#📦-entregables
#⚠️-riesgos
#📈-avances
#🤖-bot-log
#🔐-admin-bot
```

La guia anterior usaba nombres mas largos como `#tareas-petsafe` o `#reportes-pm`. Para probar tu servidor real, usa esta alineacion:

| Canal esperado | Variable | Uso principal | Tipo de prueba |
|---|---|---|---|
| `#general` | Sin variable obligatoria | Conversacion humana del servidor. No deberia ser canal principal del bot | Prueba negativa: el bot no debe contaminarlo salvo mencion directa o configuracion explicita |
| `#alertas-proyecto` | `DISCORD_WEBHOOK_URL` | Alertas automaticas, reportes PDF, monitor, DLQ, decisiones IA y notificaciones generales del sistema | Salidas automaticas; no es ideal para comandos manuales |
| `#chat-agente` | `DISCORD_CHANNEL_PM` y/o incluido en `PM_CHANNEL_IDS` | Canal general del bot para consultas PM, lenguaje natural, `/pm ayuda`, `/pm estado` y comandos legacy generales | `/pm ...`, `/estado`, `/ayuda`, consultas libres |
| `#📋-tareas` | `DISCORD_CHANNEL_TAREAS` | Crear, listar, asignar y actualizar tareas | `/pm tarea ...` |
| `#📈-avances` | `DISCORD_CHANNEL_AVANCES` | Registrar avances diarios o por tarea | `/pm avance ...` |
| `#🚧-bloqueos` | `DISCORD_CHANNEL_BLOQUEOS` | Registrar impedimentos, issues urgentes | `/pm bloqueo ...` |
| `#⚠️-riesgos` | `DISCORD_CHANNEL_RIESGOS` | Registrar y consultar riesgos | `/pm riesgo ...`, `/raid`, `/riesgos` |
| `#📊-reportes` | `DISCORD_CHANNEL_REPORTES` | Reportes diarios/semanales, estado general, KPIs | `/pm reporte ...`, `/reporte`, `/kpis`, `/estado` |
| `#📅-reuniones` | `DISCORD_CHANNEL_REUNIONES` | Agendas, reuniones, decisiones, actas | `/pm reunion ...`, `/pm decision ...`, `/agenda`, `/reunion` |
| `#📦-entregables` | `DISCORD_CHANNEL_ENTREGABLES` | Entregables, fechas limite, versiones | `/pm entregable ...` |
| `#🤖-bot-log` | `DISCORD_CHANNEL_BOT_LOG` | Logs operativos y alertas tecnicas internas | `/logs`, error handler, DLQ |
| `#🔐-admin-bot` | `DISCORD_CHANNEL_ADMIN` | Diagnostico, salud, comandos administrativos | `/pm admin estado` |

Regla importante: si el mensaje empieza con `/pm` o se escribe en un canal incluido en `PM_CHANNEL_IDS`, `bot-bridge` debe usar el fast path hacia `N8N_PM_WEBHOOK`. Los comandos legacy `!` deben ir por `N8N_WEBHOOK`.

Recomendacion de alineacion:

- No uses `#general` como canal operativo del bot. Dejalo para comunicacion humana.
- Usa `#chat-agente` como canal principal de conversacion con el bot. Configuralo en `DISCORD_CHANNEL_PM` y agregalo a `PM_CHANNEL_IDS`.
- Usa `#alertas-proyecto` como canal de salida automatica. El webhook `DISCORD_WEBHOOK_URL` deberia apuntar a este canal.
- Mantén `#🤖-bot-log` para logs tecnicos y `#🔐-admin-bot` para acciones administrativas.
- Si `DISCORD_WEBHOOK_URL_CHAT` se usa en tu entorno, deberia apuntar a `#chat-agente`; si no se usa, no es obligatorio.

Configuracion esperada en `.env`, reemplazando cada valor por el ID real del canal:

```env
# Webhook creado desde Discord dentro de #alertas-proyecto
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Opcional: webhook creado dentro de #chat-agente, solo si tus workflows lo usan
DISCORD_WEBHOOK_URL_CHAT=https://discord.com/api/webhooks/...

# Canal conversacional principal del bot
DISCORD_CHANNEL_PM=ID_DE_CHAT_AGENTE

# Canales PM especificos
DISCORD_CHANNEL_TAREAS=ID_DE_TAREAS
DISCORD_CHANNEL_BLOQUEOS=ID_DE_BLOQUEOS
DISCORD_CHANNEL_REPORTES=ID_DE_REPORTES
DISCORD_CHANNEL_REUNIONES=ID_DE_REUNIONES
DISCORD_CHANNEL_ENTREGABLES=ID_DE_ENTREGABLES
DISCORD_CHANNEL_RIESGOS=ID_DE_RIESGOS
DISCORD_CHANNEL_AVANCES=ID_DE_AVANCES
DISCORD_CHANNEL_BOT_LOG=ID_DE_BOT_LOG
DISCORD_CHANNEL_ADMIN=ID_DE_ADMIN_BOT

# Debe incluir chat-agente y los canales PM donde quieres fast path.
# No incluir #general. Incluir #alertas-proyecto solo si de verdad quieres aceptar comandos ahi.
PM_CHANNEL_IDS=ID_DE_CHAT_AGENTE,ID_DE_TAREAS,ID_DE_BLOQUEOS,ID_DE_REPORTES,ID_DE_REUNIONES,ID_DE_ENTREGABLES,ID_DE_RIESGOS,ID_DE_AVANCES,ID_DE_BOT_LOG,ID_DE_ADMIN_BOT
```

## 3. Componentes involucrados por flujo

| Flujo | Entrada | Workflows principales | Tablas esperadas |
|---|---|---|---|
| Chat PM rapido | Discord `/pm` | `WF_PM_Discord_Entrada`, `WF_PM_Router_Intenciones`, workflows `WF_PM_*` | `pm_command_log`, tablas `pm_*`, `events_outbox` |
| Chat legacy | Discord `!` o consulta libre | `Chat Discord PetSafe` | `recomendaciones`, `workflow_runs_audit`, `events_outbox` |
| Tareas PM | `/pm tarea ...` | `WF_PM_Tareas` | `pm_tareas`, `pm_command_log` |
| Avances | `/pm avance ...` | `WF_PM_Avances` | `pm_avances`, `pm_tareas` |
| Bloqueos y riesgos | `/pm bloqueo ...`, `/pm riesgo ...` | `WF_PM_Bloqueos_Riesgos` | `pm_bloqueos`, `pm_riesgos` |
| Reportes PM | `/pm reporte ...` | `WF_PM_Reportes`, `Reporte PDF Semanal` | `reportes_generados`, `analisis_proyecto` |
| Reuniones | `/pm reunion ...`, `/reunion` | `WF_PM_Reuniones`, `PMO - Meeting Coordinator` | `pm_reuniones`, `pmo_meetings`, `pmo_meeting_reminders` |
| Decisiones | `/pm decision ...` | `WF_PM_Decisiones` | `pm_decisiones` |
| Entregables | `/pm entregable ...` | `WF_PM_Entregables` | `pm_entregables` |
| Admin | `/pm admin estado`, `/logs` | `WF_PM_Admin`, `Dashboard - PM Logs Hub` | `pm_bot_errors`, `workflow_runs_audit`, `events_outbox` |
| Eventos GitHub | Trigger GitHub | `Discord Eventos GitHub PetSafe`, `Router - Project Events`, `AI - PM Orchestrator` | `events_inbox`, `eventos_detectados`, `ai_decisions` |
| Eventos Trello | Trigger Trello | `Discord Eventos Trello PetSafe`, `Router - Project Events`, agentes IA | `events_inbox`, `eventos_detectados`, `estado_tareas` |
| Outbox | Schedule | `Executor - Discord Outbox`, `Monitor - Outbox DLQ` | `events_outbox` |

## 4. Preparacion del entorno

### 4.1 Validacion de servicios

Ejecutar:

```bash
docker compose ps
curl -fsS http://127.0.0.1:5678/healthz/readiness
```

Resultado esperado:

- `n8n`, `postgres`, `redis`, `gotenberg` y `bot-bridge` estan arriba.
- n8n responde readiness correctamente.
- No hay contenedores reiniciandose continuamente.

### 4.2 Validacion de variables criticas

Revisar en `.env`:

```text
DISCORD_BOT_TOKEN
DISCORD_WEBHOOK_URL
DISCORD_CHANNEL_TAREAS
DISCORD_CHANNEL_AVANCES
DISCORD_CHANNEL_BLOQUEOS
DISCORD_CHANNEL_RIESGOS
DISCORD_CHANNEL_REPORTES
DISCORD_CHANNEL_REUNIONES
DISCORD_CHANNEL_ENTREGABLES
DISCORD_CHANNEL_BOT_LOG
DISCORD_CHANNEL_ADMIN
DISCORD_CHANNEL_PM
DISCORD_WEBHOOK_URL_CHAT
N8N_WEBHOOK
N8N_PM_WEBHOOK
PM_FAST_PATH_ENABLED
PM_CHANNEL_IDS
PM_APPROVAL_SECRET
GITHUB_TOKEN
TRELLO_API_KEY
TRELLO_TOKEN
GEMINI_API_KEY
```

Resultado esperado:

- No hay placeholders.
- `N8N_PM_WEBHOOK` apunta a `/webhook/pm-discord-entrada`.
- `N8N_WEBHOOK` apunta a `/webhook/discord-chat-v2`.
- `DISCORD_CHANNEL_PM`, si se usa, apunta a `#chat-agente`.
- `DISCORD_WEBHOOK_URL` apunta a `#alertas-proyecto`.
- `DISCORD_WEBHOOK_URL_CHAT`, si se usa, apunta a `#chat-agente`.
- `PM_FAST_PATH_ENABLED=true` si se quiere evaluar la ruta rapida.
- `PM_CHANNEL_IDS` incluye los IDs de `#chat-agente` y de los canales PM especificos, pero no necesariamente `#general` ni `#alertas-proyecto`.

### 4.3 Canales que no deben mezclarse

| Canal | Debe usarse para | No debe usarse para | Prueba de alineacion |
|---|---|---|---|
| `#general` | Comunicacion humana del servidor | Logs, spam del bot, alertas automaticas, pruebas masivas | Enviar una consulta sin `/pm`; el bot no deberia intervenir salvo que lo tengas configurado explicitamente |
| `#alertas-proyecto` | Alertas automaticas del monitor, reportes PDF, decisiones IA, DLQ, eventos importantes | Conversacion normal con el bot o comandos de prueba repetitivos | Ejecutar reporte/monitor y verificar que la salida automatica aparece aqui |
| `#chat-agente` | Conversacion con el bot, preguntas generales, `/pm ayuda`, `/pm estado`, comandos legacy generales | Alertas tecnicas internas permanentes | Enviar `/pm estado` y una consulta libre; ambas deben responder sin contaminar otros canales |

### 4.4 Consultas SQL utiles

Usar estas consultas durante la validacion:

```sql
select id, titulo, estado, responsable, prioridad, deadline, created_at
from pm_tareas
order by created_at desc
limit 10;

select id, command_text, intent, status, created_at
from pm_command_log
order by created_at desc
limit 20;

select id, status, channel, retry_count, created_at, last_error
from events_outbox
order by created_at desc
limit 20;

select id, source, event_type, status, correlation_id, created_at
from events_inbox
order by created_at desc
limit 20;

select id, agent_name, decision_type, requires_human_approval, status, created_at
from ai_decisions
order by created_at desc
limit 20;

select id, workflow_name, status, error_message, created_at
from workflow_runs_audit
order by created_at desc
limit 20;
```

## 5. Matriz de pruebas por canal

### 5.1 Canal `#📋-tareas`

| ID | Opcion/comando | Pasos | Validar en bot | Validar en DB | Casos borde |
|---|---|---|---|---|---|
| TAR-01 | `/pm tarea crear` | Enviar `/pm tarea crear Revisar login responsable: David limite: 2026-05-30 prioridad: alta` | Responde con tarea creada e ID | Fila en `pm_tareas` con responsable, deadline y prioridad | Fecha pasada, responsable vacio, prioridad desconocida |
| TAR-02 | `/pm tarea listar` | Enviar `/pm tarea listar` | Lista tareas abiertas con IDs | No debe modificar datos | Sin tareas abiertas, muchas tareas, tareas vencidas |
| TAR-03 | `/pm tarea asignar` | Enviar `/pm tarea asignar #1 responsable: Joel` | Confirma reasignacion | `pm_tareas.responsable` cambia | ID inexistente, responsable con espacios, doble asignacion |
| TAR-04 | `/pm tarea actualizar` | Enviar `/pm tarea actualizar #1 estado: en_progreso` | Confirma cambio de estado | `pm_tareas.estado='en_progreso'` | Estado invalido, transicion de `hecho` a `pendiente` |
| TAR-05 | Lenguaje natural | Enviar `crea una tarea para revisar el modulo de reportes y asignala a Josue` | Debe clasificar como tarea | Registro en `pm_tareas` y log de comando | Frase ambigua, sin responsable, sin fecha |

Criterio de aprobacion:

- El canal no debe recibir respuestas de riesgo, avance o admin salvo que el usuario lo pida explicitamente.
- Cada modificacion debe quedar trazada en `pm_command_log`.
- La respuesta debe incluir el ID de tarea cuando crea o modifica.

### 5.2 Canal `#📈-avances`

| ID | Opcion/comando | Pasos | Validar en bot | Validar en DB | Casos borde |
|---|---|---|---|---|---|
| AVA-01 | `/pm avance registrar` | Enviar `/pm avance registrar #1 40% complete revision inicial` | Confirma avance y porcentaje | Fila en `pm_avances`; tarea relacionada | 0%, 100%, 101%, texto sin porcentaje |
| AVA-02 | Avance sin tarea | Enviar `/pm avance registrar termine pruebas de login` | Debe pedir o inferir contexto sin inventar ID | No debe crear avance con tarea falsa | Mensaje muy corto, tarea no encontrada |
| AVA-03 | Avance diario general | Enviar `/pm avance registrar hoy avance con reportes y validaciones` | Registra avance general o pide asociarlo | Registro consistente en `pm_avances` | Varias tareas en un mensaje |
| AVA-04 | Resumen del dia | Enviar `/pm reporte diario` desde este canal | Resume avances del dia | Consulta `pm_avances` | Sin avances del dia |

Criterio de aprobacion:

- El bot no debe aceptar porcentajes fuera de 0 a 100.
- Si el avance menciona un ID inexistente, debe responder con error claro.
- Si actualiza tarea a completada al 100%, debe hacerlo de forma consistente o explicitar que solo registro avance.

### 5.3 Canal `#🚧-bloqueos`

| ID | Opcion/comando | Pasos | Validar en bot | Validar en DB | Casos borde |
|---|---|---|---|---|---|
| BLO-01 | `/pm bloqueo registrar` | Enviar `/pm bloqueo registrar #1 no tengo acceso al repositorio prioridad: alta` | Confirma bloqueo y severidad | Fila en `pm_bloqueos` | Sin prioridad, sin tarea, texto ambiguo |
| BLO-02 | Bloqueo critico | Enviar `/pm bloqueo registrar produccion caida prioridad: critica` | Debe marcar urgencia y sugerir accion | Bloqueo con prioridad critica | Palabras alarmantes sin contexto |
| BLO-03 | Listar pendientes | Enviar `/pm pendientes` | Incluye bloqueos abiertos | Consulta `pm_bloqueos` | Sin pendientes |
| BLO-04 | Resolver bloqueo | Enviar comando de actualizacion si existe o actualizar tarea asociada | Debe cambiar estado o indicar comando correcto | Estado del bloqueo/tarea cambia | ID inexistente |

Criterio de aprobacion:

- Los bloqueos de prioridad alta/critica deben quedar visibles en reportes.
- El bot debe distinguir bloqueo de riesgo: bloqueo ya esta ocurriendo; riesgo podria ocurrir.

### 5.4 Canal `#⚠️-riesgos`

| ID | Opcion/comando | Pasos | Validar en bot | Validar en DB | Casos borde |
|---|---|---|---|---|---|
| RIE-01 | `/pm riesgo registrar` | Enviar `/pm riesgo registrar retraso por API externa probabilidad: alta impacto: critico` | Confirma riesgo con prioridad calculada | Fila en `pm_riesgos` | Falta probabilidad, falta impacto |
| RIE-02 | Riesgo en lenguaje natural | Enviar `hay riesgo de que el reporte PDF no salga por problemas con Gotenberg` | Clasifica como riesgo | Registro en `pm_riesgos` | Confundir con bloqueo |
| RIE-03 | RAID legacy | Enviar `/raid` | Lista riesgos/issues/actions/dependencies | No modifica datos | Sin datos RAID |
| RIE-04 | Riesgo duplicado | Enviar dos veces el mismo riesgo | Debe evitar duplicado o indicar posible duplicado | No deberia crear dos registros identicos | Mensajes iguales con segundos de diferencia |

Criterio de aprobacion:

- Probabilidad e impacto deben quedar normalizados.
- Riesgos altos deben aparecer en reporte diario/semanal.
- El bot no debe inventar mitigaciones como si ya estuvieran aprobadas; debe sugerirlas.

### 5.5 Canal `#📊-reportes`

| ID | Opcion/comando | Pasos | Validar en bot | Validar en DB | Casos borde |
|---|---|---|---|---|---|
| REP-01 | `/pm reporte diario` | Enviar `/pm reporte diario` | Resume tareas, avances, bloqueos, riesgos y decisiones | Consulta multiples tablas PM | Sin datos recientes |
| REP-02 | `/pm reporte semanal` | Enviar `/pm reporte semanal` | Genera resumen semanal o dispara PDF segun flujo | `reportes_generados` si aplica | Semana sin eventos |
| REP-03 | `/kpis` | Enviar `/kpis` | Devuelve progreso, vencidas, severidad | `analisis_proyecto`/cache Redis | Cache vacio o viejo |
| REP-04 | `/reporte 7` | Enviar `/reporte 7` | Genera o solicita PDF de 7 dias | `reportes_generados` | Dias negativo, texto no numerico |
| REP-05 | `/estado` | Enviar `/estado` | Estado compacto del proyecto | No debe crear datos innecesarios | Proyecto sin tareas |

Criterio de aprobacion:

- El reporte no debe mezclar datos inventados con datos reales.
- Debe indicar cuando no hay informacion suficiente.
- El PDF no debe contener HTML crudo, JSON crudo ni errores de plantilla.

### 5.6 Canal `#📅-reuniones`

| ID | Opcion/comando | Pasos | Validar en bot | Validar en DB | Casos borde |
|---|---|---|---|---|---|
| REU-01 | `/pm reunion preparar` | Enviar `/pm reunion preparar seguimiento sprint mañana 10am` | Propone agenda, invitados o registra reunion | `pm_reuniones` o `pmo_meetings` | Fecha ambigua, hora pasada |
| REU-02 | `/agenda` | Enviar `/agenda` | Lista proximas reuniones | Consulta `pmo_meetings` | Sin reuniones |
| REU-03 | `/reunion [tema]` | Enviar `/reunion revision de riesgos` | Agenda reunion PMO | `pmo_meetings`, invitees, reminders | Choque de horario |
| REU-04 | `/pm decision registrar` | Enviar `/pm decision registrar usar Gotenberg para PDF porque mantiene HTML estable` | Registra decision trazable | `pm_decisiones` | Decision sin motivo |
| REU-05 | Accion de calendario | Usar dashboard `/webhook/pm-calendar` y confirmar/cancelar | Cambia estado de reunion | `pmo_meeting_logs` | Token invalido, accion repetida |

Criterio de aprobacion:

- Reuniones no deben solaparse para los mismos invitados.
- El bot debe registrar tema, fecha/hora, responsable/solicitante y estado.
- Las decisiones deben quedar trazables con contexto, no solo texto suelto.

### 5.7 Canal `#📦-entregables`

| ID | Opcion/comando | Pasos | Validar en bot | Validar en DB | Casos borde |
|---|---|---|---|---|---|
| ENT-01 | `/pm entregable registrar` | Enviar `/pm entregable registrar Documento de arquitectura limite: 2026-06-01 responsable: David` | Confirma entregable | `pm_entregables` | Sin fecha limite, responsable vacio |
| ENT-02 | Consultar entregables | Enviar `/pm pendientes` o comando de consulta disponible | Incluye entregables abiertos | Consulta `pm_entregables` | Entregables vencidos |
| ENT-03 | Entregable duplicado | Registrar el mismo entregable dos veces | Advierte posible duplicado o crea version controlada | No debe duplicar sin control | Diferencia minima en nombre |
| ENT-04 | Entregable vencido | Crear con fecha pasada en entorno de prueba | Debe marcarlo como vencido o rechazar fecha | Estado/alerta consistente | Fecha formato invalido |

Criterio de aprobacion:

- Los entregables deben aparecer en reportes.
- Debe manejar fechas con zona horaria `America/Guayaquil`.

### 5.8 Canal `#🔐-admin-bot`

| ID | Opcion/comando | Pasos | Validar en bot | Validar en DB | Casos borde |
|---|---|---|---|---|---|
| ADM-01 | `/pm admin estado` | Enviar desde canal admin | Muestra salud de storage, outbox, variables y ultimos comandos | Consulta `pm_command_log`, `events_outbox`, errores | Ejecutar desde canal no admin |
| ADM-02 | `/logs` | Enviar `/logs` | Muestra ruta/logs principales | Consulta logs/auditoria | Sin permisos |
| ADM-03 | Dashboard logs | Abrir `/webhook/pm-logs?token=<token>` | Render HTML con logs | Consulta multiples tablas | Token invalido |
| ADM-04 | Error reciente | Forzar comando invalido complejo | Debe registrar error si rompe workflow | `pm_bot_errors` o `workflow_runs_audit` | Error silencioso |

Criterio de aprobacion:

- Informacion sensible no debe exponerse a canales no admin.
- Nunca debe mostrar tokens, secretos ni variables completas.

## 6. Pruebas de opciones PM completas

Esta matriz sirve como checklist rapido de comandos modernos.

| Modulo | Opciones minimas | Canal recomendado | Resultado esperado |
|---|---|---|---|
| Ayuda | `/pm ayuda` | #chat-agente | Lista comandos y ejemplos |
| Estado | `/pm estado`, `/pm sprint estado` | #chat-agente o #📊-reportes | Estado del proyecto y sprint |
| Tareas | `/pm tarea crear`, `listar`, `asignar`, `actualizar` | `#📋-tareas` | CRUD consistente en `pm_tareas` |
| Avances | `/pm avance registrar` | `#📈-avances` | Avance persistido |
| Bloqueos | `/pm bloqueo registrar` | `#🚧-bloqueos` | Bloqueo persistido y visible |
| Riesgos | `/pm riesgo registrar` | `#⚠️-riesgos` | Riesgo persistido con severidad |
| Reportes | `/pm reporte diario`, `/pm reporte semanal` | `#📊-reportes` | Resumen/PDF correcto |
| Reuniones | `/pm reunion preparar` | `#📅-reuniones` | Agenda/acta generada |
| Decisiones | `/pm decision registrar` | `#📅-reuniones` | Decision trazable |
| Entregables | `/pm entregable registrar` | `#📦-entregables` | Entregable persistido |
| Retrospectiva | `/pm retrospectiva bien`, `mejorar`, `accion` | #chat-agente o #📅-reuniones | Registro de mejora |
| Recordatorios | Workflow schedule `WF_PM_Recordatorios` | outbox/reportes | Alertas de atrasos |
| Admin | `/pm admin estado` | `#🔐-admin-bot` | Diagnostico seguro |

## 7. Pruebas legacy completas

| Comando | Canal recomendado | Valida | Casos borde |
|---|---|---|---|
| `/ayuda` | #chat-agente | Lista comandos legacy | No debe listar comandos rotos |
| `/estado` | `#📊-reportes` | Resumen general | DB sin datos |
| `/kpis` | `#📊-reportes` | KPIs/cache | Cache expirado |
| `/reporte [dias]` | `#📊-reportes` | Reporte periodo | `/reporte abc`, `/reporte -1`, `/reporte 365` |
| `/riesgos` | `#⚠️-riesgos` | Riesgos activos | Sin riesgos |
| `/hitos` | `#📊-reportes` | Hitos proximos | Hitos vencidos |
| `/revisar backend` | `#chat-agente` | Diff/revision GitHub backend | Repo sin PRs, token 403 |
| `/revisar frontend` | `#chat-agente` | Diff/revision GitHub frontend | Repo sin cambios |
| `/vencidas` | `#📋-tareas` | Tareas vencidas | Ninguna vencida |
| `/miembros` | #chat-agente | Miembros Trello/equipo | Miembro sin rol |
| `/commits` | `#chat-agente` o `#📊-reportes` | Commits recientes | Sin commits recientes |
| `/ci` | `#chat-agente` o `#📊-reportes` | GitHub Actions | Runs fallidos/cancelados |
| `/progreso` | `#📊-reportes` | Progreso global | Progreso nulo |
| `/acciones` | #chat-agente | PMO actions | Sin acciones |
| `/raid` | `#⚠️-riesgos` | RAID completo | Datos parciales |
| `/logs` | `#🔐-admin-bot` | Salud/logs | Canal no admin |
| `/agenda` | `#📅-reuniones` | Calendario | Sin reuniones |
| `/reunion tema` | `#📅-reuniones` | Meeting coordinator | Tema vacio |
| `/fase sync` | `#chat-agente` | Trello phases | Trello 401 |
| `/fase listar` | `#chat-agente` | Fases y completitud | Sin fases |
| `/doc <card_id>` | `#chat-agente` | Adjuntos/PDF Trello | Card sin PDF, PDF grande |

## 8. Casos borde transversales

### 8.1 Entradas raras

| Caso | Mensaje de prueba | Resultado esperado |
|---|---|---|
| Mensaje vacio | `/pm` | Pide una opcion o muestra ayuda corta |
| Espacios excesivos | `/pm    tarea    listar` | Interpreta correctamente |
| Mayusculas | `/PM TAREA LISTAR` | No falla por mayusculas |
| Acentos | `/pm tarea crear revisión clínica` | Conserva texto |
| Caracteres especiales | `/pm tarea crear validar login <script>alert(1)</script>` | No ejecuta HTML, guarda o sanitiza texto |
| Mensaje largo | Texto de mas de 2000 caracteres | Resume, corta o pide dividir; no rompe Discord |
| Multicomando | `/pm tarea crear X y /pm riesgo registrar Y` | Ejecuta una accion clara o pide separar |
| Idioma mixto | `create task revisar API deadline tomorrow` | Clasifica si es razonable o pide aclaracion |

### 8.2 Fechas y zona horaria

| Caso | Prueba | Resultado esperado |
|---|---|---|
| Fecha pasada | `limite: 2020-01-01` | Rechaza o marca como vencida explicitamente |
| Fecha relativa | `mañana 10am` | Convierte usando `America/Guayaquil` |
| Fecha ambigua | `05/06` | Pide aclarar dia/mes o usa formato documentado |
| Sin fecha | Crear tarea/entregable sin limite | Usa default documentado o pide fecha |
| Cambio de dia | Probar cerca de medianoche | No desplaza fecha por timezone |

### 8.3 Permisos y canales

| Caso | Prueba | Resultado esperado |
|---|---|---|
| Admin fuera de canal admin | `/pm admin estado` en canal publico | Rechaza o oculta detalles sensibles |
| Comando de tareas en riesgos | `/pm tarea listar` en `#⚠️-riesgos` | Puede responder, pero sin mezclar categoria |
| Usuario desconocido | Mensaje de usuario no mapeado | Registra `user_id` y no falla |
| DM al bot | Enviar `/pm ayuda` por DM | Responde si soportado; si no, indica canal requerido |

### 8.4 Duplicados e idempotencia

| Caso | Prueba | Resultado esperado |
|---|---|---|
| Doble click/envio | Mandar el mismo comando dos veces en menos de 5 segundos | No debe crear duplicados criticos |
| Retry de webhook | Reenviar mismo payload con mismo `message_id` | Dedup por Redis/correlation si aplica |
| Evento GitHub repetido | Mismo PR event dos veces | Un solo registro efectivo en `events_inbox` |
| Outbox retry | Forzar fallo y reintento | `retry_count` aumenta; no envia multiples mensajes si ya marco `sent` |

## 9. Pruebas de integracion externas

### 9.1 GitHub

| ID | Accion | Resultado esperado |
|---|---|---|
| GIT-01 | Crear Pull Request de prueba | Evento en `events_inbox`, analisis por `Code Review Scout`, decision en `ai_decisions` |
| GIT-02 | Cerrar PR sin merge | Evento registrado sin sincronizar Trello como terminado |
| GIT-03 | Merge PR asociado a tarjeta Trello | `AI - Sync Bidireccional Activa` actualiza/avisa |
| GIT-04 | Consultar `/ci` con ultimo run fallido | Respuesta indica fallo, rama y workflow si esta disponible |
| GIT-05 | Token sin permiso | Error auditado, respuesta no tecnica al usuario |

### 9.2 Trello

| ID | Accion | Resultado esperado |
|---|---|---|
| TRE-01 | Mover tarjeta a `En Progreso` | Evento normalizado, inbox/outbox si aplica |
| TRE-02 | Mover tarjeta a `Hecho` | Estado actualizado o evento notificado |
| TRE-03 | Ejecutar `/fase sync` | `project_phases` actualizado |
| TRE-04 | Ejecutar `/fase listar` | Lista fases con completitud |
| TRE-05 | Adjuntar PDF y ejecutar sync | `card_attachments` registra PDF |
| TRE-06 | Ejecutar `/doc <card_id>` | Resumen del PDF o mensaje claro si no hay PDF |

### 9.3 Gemini

| ID | Accion | Resultado esperado |
|---|---|---|
| GEM-01 | Consulta libre sobre estado del proyecto | Respuesta usa contexto real y no inventa |
| GEM-02 | Prompt ambiguo | Pide aclaracion o responde con limites |
| GEM-03 | Respuesta IA no JSON en agente | Parser maneja error y registra fallo |
| GEM-04 | Cuota agotada/429 | Error auditado; usuario recibe mensaje entendible |

### 9.4 PDF/Gotenberg

| ID | Accion | Resultado esperado |
|---|---|---|
| PDF-01 | Ejecutar reporte semanal on-demand | PDF generado y enviado a Discord |
| PDF-02 | Datos vacios | PDF indica falta de datos, no falla |
| PDF-03 | HTML con caracteres especiales | PDF renderiza sin HTML crudo |
| PDF-04 | Gotenberg caido | Error registrado, sin falsa confirmacion |

## 10. Pruebas de dashboards

| Dashboard | Ruta | Prueba | Resultado esperado |
|---|---|---|---|
| Approval Hub | `/webhook/pm-approvals?token=<PM_APPROVAL_SECRET>` | Abrir con token valido | Muestra decisiones pendientes |
| Approval Hub | `/webhook/pm-approvals?token=mal` | Abrir con token invalido | Rechaza acceso |
| Approve action | `/webhook/pm-approve` | Aprobar decision | `ai_decisions.status='approved'` y notificacion outbox |
| Reject action | `/webhook/pm-approve` | Rechazar con motivo | `status='rejected'`, motivo persistido |
| Logs Hub | `/webhook/pm-logs?token=<PM_APPROVAL_SECRET>` | Abrir logs | HTML con auditoria, inbox/outbox, errores |
| Calendar Hub | `/webhook/pm-calendar?token=<PM_APPROVAL_SECRET>` | Abrir calendario | Lista reuniones |
| Calendar action | `/webhook/pm-calendar-action` | Confirmar/cancelar/finalizar | Cambia estado y registra log |

Casos borde:

- Token vacio.
- Decision inexistente.
- Aprobar dos veces la misma decision.
- Rechazar sin motivo.
- Calendario con muchas reuniones.

## 11. Pruebas de confiabilidad y DLQ

| ID | Prueba | Pasos | Resultado esperado |
|---|---|---|---|
| REL-01 | Outbox exitoso | Crear mensaje pendiente y ejecutar `Executor - Discord Outbox` | `status='sent'` |
| REL-02 | Discord caido | Usar webhook invalido temporalmente | `retry_count` aumenta y luego `status='dead'` |
| REL-03 | Monitor DLQ | Ejecutar `Monitor - Outbox DLQ` con mensajes dead | Alerta a canal admin/log |
| REL-04 | Replay DLQ | Ejecutar `DLQ - Outbox Replay` luego de reparar webhook | Mensajes vuelven a pending o se reenvian |
| REL-05 | Error handler | Forzar error en workflow de prueba | Registro en `workflow_runs_audit` y alerta |

Criterio de aprobacion:

- Ningun error debe quedar silencioso.
- No debe haber mensajes `pending` antiguos sin razon.
- Los reintentos deben tener limite.

## 12. Evidencia requerida por prueba

Para cada caso probado, registrar:

| Campo | Descripcion |
|---|---|
| ID de prueba | Ejemplo: `TAR-01` |
| Fecha/hora | En timezone `America/Guayaquil` |
| Canal Discord | Canal exacto donde se probo |
| Usuario | Usuario que ejecuto |
| Comando/mensaje | Texto enviado |
| Respuesta del bot | Captura o texto |
| Workflow n8n | Nombre del workflow ejecutado |
| Tablas afectadas | Tablas y filas relevantes |
| Resultado | Aprobado / Fallido / Parcial |
| Observaciones | Bugs, latencia, datos incorrectos |

## 13. Criterios de calidad global

El bot puede considerarse estable si cumple:

- Responde en el canal correcto.
- Usa el workflow correcto segun comando/canal.
- Persiste los datos importantes.
- Registra auditoria de comandos, eventos y errores.
- Maneja entradas invalidas sin romperse.
- No duplica tareas, riesgos o eventos por reintentos.
- No inventa datos cuando faltan fuentes.
- No expone secretos ni detalles internos en canales publicos.
- Los reportes reflejan datos reales y recientes.
- El outbox, DLQ y error handler permiten recuperacion.

Debe corregirse si ocurre alguno de estos problemas:

- Responde "ok" pero no guarda nada.
- Guarda datos en la tabla equivocada.
- Un comando de un canal dispara un modulo no relacionado.
- El bot inventa IDs, responsables, fechas o estados.
- Los errores de GitHub/Trello/Gemini aparecen como respuestas vacias.
- El dashboard permite acciones sin token valido.
- El PDF contiene HTML/JSON crudo.
- El mismo evento crea duplicados.
- Los mensajes fallidos quedan eternamente en `pending`.

## 14. Ruta recomendada de ejecucion

1. Validar infraestructura y variables.
2. Probar `/pm ayuda` y `/pm estado` en canal #chat-agente.
3. Probar canales PM uno por uno: tareas, avances, bloqueos, riesgos, reportes, reuniones, entregables.
4. Probar comandos legacy `!`.
5. Validar tablas Postgres despues de cada modulo.
6. Probar GitHub, Trello y Gemini.
7. Probar dashboards con token valido e invalido.
8. Probar reporte PDF.
9. Probar outbox, DLQ y error handler.
10. Consolidar evidencia y marcar casos fallidos para correccion.

## 15. Plantilla de resultado

| ID | Canal | Comando | Estado | Evidencia | Correccion requerida |
|---|---|---|---|---|---|
| TAR-01 | `#📋-tareas` | `/pm tarea crear ...` | Pendiente |  |  |
| AVA-01 | `#📈-avances` | `/pm avance registrar ...` | Pendiente |  |  |
| BLO-01 | `#🚧-bloqueos` | `/pm bloqueo registrar ...` | Pendiente |  |  |
| RIE-01 | `#⚠️-riesgos` | `/pm riesgo registrar ...` | Pendiente |  |  |
| REP-01 | `#📊-reportes` | `/pm reporte diario` | Pendiente |  |  |
| REU-01 | `#📅-reuniones` | `/pm reunion preparar ...` | Pendiente |  |  |
| ENT-01 | `#📦-entregables` | `/pm entregable registrar ...` | Pendiente |  |  |
| ADM-01 | `#🔐-admin-bot` | `/pm admin estado` | Pendiente |  |  |
