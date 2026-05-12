# Arquitectura profesional para Project Manager AI PetSafe

Fecha de revision: 2026-05-10  
Scope revisado: workflows n8n en `bot/`, `bot-bridge`, `docker-compose.yml` y documentacion oficial actual de n8n para GitHub, Trello, manejo de errores, log streaming y secretos externos.

## Resumen ejecutivo

El sistema actual ya tiene una base valiosa: monitoreo programado, calculo de KPIs, snapshots de tareas, memoria Redis para chat, persistencia Postgres, reportes PDF, alertas Discord y agentes Gemini nativos en el flujo principal de chat/monitor. Sin embargo, aun se comporta mas como una automatizacion integrada por scripts que como una plataforma de AI orchestration lista para operacion profesional.

Los riesgos principales son:

- GitHub y Trello aun se consumen mayormente por `httpRequest` en la capa de snapshot/enriquecimiento, aunque el ingreso de eventos ya migro a `GitHub Trigger` y `Trello Trigger`.
- La configuracion se replica en varios nodos `Set`, mezclando credenciales, IDs de tableros/repositorios y parametros operativos.
- Los workflows mezclan ingestion, normalizacion, analisis, decisiones AI, persistencia y notificacion en los mismos flujos.
- Ya existe una primera capa canonica de eventos para GitHub/Trello con `events_inbox` e idempotencia y un `events_outbox` operativo, pero aun falta replay y DLQ formal.
- La observabilidad ya mejoro con `errorWorkflow` y `correlation_id` en ingress externos, pero aun no hay `workflow_runs_audit` operativo, metricas, trazas ni dashboard.
- Algunas consultas SQL interpolan texto manualmente; eso es fragil y debe migrarse a parametros.
- El repo refleja una base de endurecimiento importante, pero todavia hay que revalidar que el despliegue activo coincida con `docker-compose.yml`, `init.sql` y las credenciales montadas en runtime.

Conclusion: la proxima evolucion debe convertir el sistema en una arquitectura event-driven con conectores nativos, adaptadores por dominio, modelo canonico de eventos completo, metricas DORA/flow, agentes especializados y controles operativos.

## Estado actual al 2026-05-11

Leyenda:

- `DONE`: implementado y visible en repo/workflows.
- `PARTIAL`: existe base operativa, pero falta cobertura completa o endurecimiento.
- `PENDING`: aun no implementado.
- `REVIEW`: hay cambios o claims que conviene revalidar en entorno real.

| Modulo / capacidad | Estado | Nota |
|---|---|---|
| Triggers nativos GitHub/Trello | DONE | `Discord Eventos GitHub PetSafe` y `Discord Eventos Trello PetSafe` ya usan `GitHub Trigger` y `Trello Trigger`. |
| Gemini nativo en chat/monitor/reporte | DONE | Chat, alertas IA y reporte semanal ya usan stack nativo LangChain + Gemini. |
| `events_inbox` en schema | DONE | `init.sql` ya contiene `events_inbox`, indices y tablas asociadas. |
| Ingestion canonica GitHub/Trello con idempotencia | DONE | Ambos workflows de eventos insertan en `events_inbox` con `ON CONFLICT (event_id) DO NOTHING`. |
| `correlation_id` al ingreso de eventos | DONE | GitHub y Trello generan y persisten `correlation_id` canonico. |
| `events_outbox` / replay / DLQ | PARTIAL | `Router - Project Events` rutea hacia `AI - PM Orchestrator` y `Executor - Discord Outbox`. Falta DLQ formal y replay. |
| Observabilidad estructurada (`workflow_runs_audit`, `ai_decisions`) | DONE | `Error Handler` usa `workflow_runs_audit` y `System - AI Decision Logger` guarda todo rastro de IA en `ai_decisions`. |
| Agentes IA Especializados | DONE | Implementados `PM Orchestrator`, `Code Review Scout`, `Context Guardian` y `Risk Analyst`. |
| Sincronizacion bidireccional PR→Trello→Discord | DONE | `AI - Sync Bidireccional Activa` archiva tarjeta Trello al merge del PR y notifica Discord. |
| Release Gate con IA | DONE | `AI - Release Guard` evalua estado del proyecto con Gemini y bloquea/aprueba deploys. |
| Dashboard de aprobacion humana | DONE | `Dashboard - PM Approval Hub` expone HTML interactivo via webhook n8n para aprobar/rechazar decisiones de IA. |
| Error workflow global en workflows criticos | DONE | Los workflows principales ya apuntan a `monitor-petsafe-error-handler`. |
| SQL parametrizado en escrituras | PARTIAL | Varias inserciones ya usan `queryReplacement`, pero todavia queda deuda en algunos nodos heredados. |
| GitHub/Trello con credenciales predefinidas donde aplica | PARTIAL | Ya se consolidaron varios nodos estaticos, pero aun quedan endpoints HTTP por migrar y revisar. |
| Config resolver central / bloqueo de `$env` en code nodes | PARTIAL | Existe `System - Config Resolver`, pero el stack aun depende de `$env` en varios workflows. |
| Seguridad de produccion y endurecimiento total | REVIEW | El repo refleja mejoras fuertes en compose e init, pero conviene revalidar despliegue real antes de marcar cerrado. |

## Fuentes verificadas

- n8n GitHub Trigger: soporta eventos como `Push`, `Pull request`, `Pull request review`, `Check suite`, `Status`, `Deployment` y `Deployment status`.
- n8n GitHub node: soporta operaciones de repositorio como `Get Pull Requests`, ademas de issues, reviews, releases, files, repositorios y workflows.
- n8n Trello Trigger: dispara eventos desde modelos Trello usando `Model ID`.
- n8n Trello node: soporta Board, Board Member, Card, Card Comment, Checklist y Label, entre otras operaciones.
- n8n recomienda usar `HTTP Request` solo cuando la operacion no esta soportada por el nodo de la app, idealmente con credencial predefinida.
- n8n Error Workflow debe arrancar con `Error Trigger` y configurarse en los workflows que quiere proteger.
- n8n Log Streaming permite enviar eventos de workflow, nodos, auditoria, AI node logs y queue a destinos externos.
- n8n External Secrets permite centralizar secretos en vaults como 1Password, AWS Secrets Manager, Azure Key Vault, GCP Secrets Manager y HashiCorp Vault en planes soportados.

## 1. Revision arquitectonica completa

### Inventario actual

Workflows principales:

- `Chat Discord PetSafe`: entrada conversacional, comandos rapidos, agente Gemini, memoria Redis, consultas Trello/GitHub/Postgres y respuestas Discord.
- `Monitor PetSafe`: schedule principal, recoleccion Trello/GitHub/Postgres, KPIs, snapshots, cache Redis y decision de alerta.
- `Monitor PetSafe - Alertas IA`: subworkflow para diagnostico IA y alerta Discord.
- `Monitor PetSafe - Error Handler`: workflow de error separado.
- `Discord Eventos GitHub PetSafe`: trigger nativo GitHub con normalizacion, idempotencia y notificacion.
- `Discord Eventos Trello PetSafe`: trigger nativo Trello con normalizacion, idempotencia y notificacion.
- `Construir Contexto Robusto`: detector de deltas por polling.
- `Reporte PDF Semanal`: reporte semanal y on-demand.
- `System - DB Seeder`: seed manual de estado conocido.

Infraestructura:

- n8n self-hosted.
- Postgres/pgvector como base operacional.
- Redis para cache, deduplicacion y memoria conversacional.
- Gotenberg para PDF.
- `bot-bridge` Node.js como puente Discord -> n8n webhook.

### Problemas actuales

#### 1. Integraciones GitHub/Trello no son de primer nivel [PARTIAL]

El sistema usa `httpRequest` para obtener:

- Trello board cards, lists, members, checklists.
- GitHub commits, PRs, commits con diff y Actions runs.
- Gemini por HTTP en `Construir Contexto Robusto` y `Reporte PDF Semanal`.
- Discord webhooks para varias notificaciones.

En eventos GitHub/Trello ya existe un primer paso nativo de ingestion, pero el resto del dominio todavia depende de varias consultas HTTP manuales y nombres historicos de nodos.

Riesgo:

- Mayor superficie de errores manuales.
- Headers y tokens repetidos.
- Dificultad para rotar credenciales.
- Falta de tipado semantico en operaciones.
- Validacion y retries menos consistentes.
- Persisten huecos de contrato/observabilidad fuera del trigger nativo, especialmente en enrichment, replay y correlacion aguas abajo.

Mejora:

- Sustituir webhooks manuales por `GitHub Trigger` y `Trello Trigger`.
- Sustituir HTTP Trello por `Trello` node para Board, Board Member, Card y Checklist cuando la operacion exista.
- Sustituir HTTP GitHub por `GitHub` node para PRs, issues, reviews, repositorios y workflow metadata cuando la operacion exista.
- Mantener HTTP solo para GitHub commits con diff y GitHub Actions runs si el nodo nativo de la version instalada no cubre el endpoint requerido, pero usando credenciales predefinidas GitHub y no tokens manuales.

#### 2. Configuracion duplicada [PARTIAL]

Los nodos `Config1`, `Configuracion`, `Configuracion1` y `Configuracion` del reporte repiten variables:

- Tokens GitHub/Trello.
- Owners/repos backend/frontend.
- Board ID.
- Gemini key.
- Discord webhook.
- URLs de servicios.

Riesgo:

- Drift entre workflows.
- Cambios incompletos.
- Dificil separar dev/staging/prod.
- Credenciales tratadas como datos de workflow.

Mejora:

- Crear un workflow hijo `System - Config Resolver` que emita configuracion no sensible normalizada.
- Mover secretos a credenciales n8n o external secrets.
- Mantener solo IDs funcionales no secretos en variables de entorno o tabla `project_config`.
- Versionar un `config.schema.md` con nombres, owners, repos, board/list IDs, SLAs y calendarios.

#### 3. Falta un modelo canonico de eventos [PARTIAL]

Hoy los eventos se almacenan en `eventos_detectados`, pero cada origen produce shape propio y los eventos de polling/delta conviven con webhooks directos.

Riesgo:

- Duplicados.
- Dificil correlacion PR-card-commit-deploy.
- Poca trazabilidad de decisiones AI.
- Reprocesamiento inseguro.

Mejora:

Introducir tabla `events_inbox` canonica:

```sql
event_id text primary key,
source text not null,
event_type text not null,
external_id text not null,
occurred_at timestamptz not null,
received_at timestamptz not null default now(),
correlation_id text,
actor text,
entity_type text,
entity_id text,
repo text,
trello_card_id text,
pull_request_number integer,
commit_sha text,
payload jsonb not null,
normalized jsonb,
processing_status text not null default 'pending',
retry_count integer not null default 0,
last_error text
```

Y tabla `events_outbox`:

```sql
outbox_id bigserial primary key,
event_id text references events_inbox(event_id),
target text not null,
action text not null,
payload jsonb not null,
status text not null default 'pending',
retry_count integer not null default 0,
scheduled_at timestamptz not null default now(),
sent_at timestamptz,
last_error text
```

#### 4. Observabilidad insuficiente [PARTIAL]

Hay alertas a Discord, pero falta:

- Logs estructurados por workflow.
- Correlation ID.
- Metricas de ejecucion.
- Auditoria de decisiones AI.
- Trazabilidad de tool calls.
- DLQ para eventos fallidos.
- Dashboard operativo.

Mejora:

- Configurar error workflow global real en settings de cada workflow.
- Activar log streaming si el plan lo permite.
- Crear tabla `workflow_runs_audit`.
- Registrar cada decision AI en `ai_decisions`.
- Emitir metricas de health score, throughput, lead time, MTTR, defect rate y deployment frequency.

#### 5. SQL fragil por interpolacion [PARTIAL]

Ejemplos actuales interpolan texto en queries:

- `Guardar Q&A1`
- `PG Insert Evento GitHub1`
- `PG Insert Evento Trello`
- `Guardar Recomendacion IA`
- `Guardar Analisis`

Riesgo:

- Errores por comillas/caracteres especiales.
- Potencial SQL injection si algun dato externo se cuela.
- Dificil auditar cambios.

Mejora:

- Migrar toda escritura a `queryReplacement`.
- Validar y truncar campos antes de insertar.
- Guardar payloads grandes como JSONB.
- Usar constraints e indices unicos para idempotencia.

#### 6. AI orchestration sin gobierno suficiente [PARTIAL]

El agente actual puede responder y consultar herramientas, pero aun no tiene:

- Politicas explicitas de decision.
- Matriz de autoridad.
- Escalamiento humano.
- Gating de acciones peligrosas.
- Evaluacion de calidad de respuestas.
- Separacion fuerte entre diagnostico, decision y ejecucion.

Mejora:

- Separar agentes por rol.
- Introducir `Decision Ledger`.
- Usar un `Action Executor` que aplique cambios solo si la decision cumple politicas.
- Requerir aprobacion humana para cambios de estado criticos, asignaciones masivas, cierre de PRs, stop deploy o cambios de prioridad altos.

#### 7. Punto unico de fallo en el puente Discord [PARTIAL]

`bot-bridge` hace polling/event listening de Discord y llama al webhook n8n.

Riesgo:

- Si el proceso cae, se pierde la interaccion de chat.
- No hay retry/backoff persistente.
- No hay cola.
- No hay healthcheck.

Mejora:

- Agregar healthcheck, process manager y structured logging.
- Introducir cola Redis para mensajes Discord entrantes.
- O migrar a un trigger/connector nativo si se adopta un mecanismo oficial del entorno.
- Mantener el webhook de chat solo como borde externo controlado; no mezclarlo con GitHub/Trello.

#### 8. Seguridad de infraestructura [BASELINE IMPLEMENTADO]

Hallazgos:

- `N8N_BASIC_AUTH_USER=admin` y `N8N_BASIC_AUTH_PASSWORD=admin123` en `docker-compose.yml`.
- Postgres con credenciales simples en compose.
- `init.sql` esta montado, pero localmente parece un directorio vacio.
- `n8n` no configura explicitamente Postgres como DB propia; probablemente usa SQLite interno en volumen.

Riesgo:

- Credenciales triviales.
- Backups y HA limitados.
- Migraciones DB inciertas.
- Ambientes no reproducibles.

Mejora:

- Cambiar credenciales por secretos.
- Usar Postgres tambien como DB de n8n si se requiere produccion real.
- Separar redes internas de exposicion publica.
- Definir backup y restore.
- Agregar healthchecks.
- Versionar migraciones SQL reales.

Estado aplicado en repo:

- `docker-compose.yml` ya no contiene `admin/admin123` ni `agente123`; exige variables desde `.env`.
- n8n queda configurado para usar Postgres (`DB_TYPE=postgresdb`) con schema dedicado `n8n`.
- `N8N_ENCRYPTION_KEY` es obligatorio.
- Postgres y Gotenberg se publican solo en loopback por defecto.
- Se agregaron healthchecks para Postgres, Redis y n8n readiness.
- Se habilitaron metricas n8n, task runners internos, pruning de ejecuciones, rotacion de logs y `no-new-privileges`.
- `init.sql` ahora es un archivo SQL real con schema operativo para los workflows, inbox/outbox, auditoria y decisiones AI.
- Se agregaron `.env.example`, `.gitignore`, scripts de security check/backup/restore y `docs/PRODUCTION_RUNBOOK.md`.
- Los `.env` locales fueron sacados del indice Git con `git rm --cached`; siguen existiendo en disco, pero ya no deben entrar en commits.

Pendiente intencional:

- Si el entorno actual de n8n usa SQLite en `n8n_data`, migrar/exportar/importar workflows y credenciales antes de reiniciar con Postgres como DB interna.
- `N8N_BLOCK_ENV_ACCESS_IN_NODE` queda en `false` hasta migrar los workflows desde `$env` hacia credenciales nativas y `System - Config Resolver`; activarlo ahora romperia los flujos actuales.
- Si esos secretos ya salieron a un remoto o a un backup compartido, deben rotarse antes de operar produccion.

## 2. Propuesta profesional de arquitectura

### Principios

- Event-driven primero, polling solo como reconciliacion.
- Nodos nativos primero, HTTP solo para gaps documentados.
- Separacion estricta entre ingestion, normalizacion, analisis, decision y ejecucion.
- Idempotencia por defecto.
- Observabilidad desde el primer nodo.
- AI con autoridad limitada y auditable.
- Contexto canonico en Postgres, cache efimero en Redis.
- Workflows pequenos, composables y con contratos explicitos.

### Componentes propuestos

#### 1. Integration Layer

Responsabilidad:

- Recibir eventos de sistemas externos.
- Usar nodos nativos.
- No tomar decisiones de negocio.
- Validar identidad/firma/credencial.
- Emitir eventos canonicos.

Workflows:

- `Ingest - GitHub Events`
- `Ingest - Trello Events`
- `Ingest - Discord Commands`
- `Ingest - Deployment Events`

Nodos recomendados:

- `GitHub Trigger` para push, pull request, status, check suite, deployment status.
- `Trello Trigger` para cambios relevantes de board/list/card.
- `Discord` o puente actual endurecido para chat.

#### 2. Native Data Adapter Layer

Responsabilidad:

- Consultas enriquecidas bajo demanda.
- Encapsular diferencias entre GitHub/Trello.
- Entregar objetos normalizados al dominio.

Workflows:

- `Adapter - GitHub Repository Snapshot`
- `Adapter - GitHub Pull Requests`
- `Adapter - GitHub CI Runs`
- `Adapter - Trello Board Snapshot`
- `Adapter - Trello Card Details`

Regla:

- Si el nodo nativo soporta la operacion, usarlo.
- Si no la soporta, usar `HTTP Request` con `Authentication > Predefined Credential Type`.
- Nunca construir headers `Authorization` manualmente en multiples nodos.

#### 3. Canonical Project State

Responsabilidad:

- Guardar estado actual y historico.
- Resolver mapeos entre Trello, GitHub, deploys y personas.
- Hacer posible trazabilidad y replay.

Tablas propuestas:

- `events_inbox`
- `events_outbox`
- `project_state_snapshots`
- `work_items`
- `work_item_links`
- `repository_activity`
- `pull_request_state`
- `deployment_state`
- `quality_metrics`
- `team_capacity`
- `risk_register`
- `decision_log`
- `ai_decisions`
- `workflow_runs_audit`

#### 4. Metrics Engine

Responsabilidad:

- Calcular metricas de delivery, calidad y salud operacional.
- Alimentar dashboards y agentes.

Metricas recomendadas:

- Lead time: desde Trello card `in_progress` hasta `done`.
- Cycle time: desde primer commit/PR hasta merge/deploy.
- Throughput: cards completadas por semana.
- WIP: cards activas por persona/lista.
- Aging WIP: dias sin movimiento.
- Defect rate: bugs/incidentes por entrega.
- Deployment frequency.
- Change failure rate.
- MTTR.
- Build failure rate.
- PR review latency.
- PR stale rate.
- Test coverage si CI la reporta.
- Health score compuesto.
- Load balance por dev/agente.

#### 5. AI Orchestration Layer

Responsabilidad:

- Diagnosticar, priorizar, recomendar y despachar.
- No ejecutar acciones sensibles sin politica.

Agentes:

- `PM Orchestrator`: sintetiza estado global y decide siguiente paso.
- `Context Guardian`: mantiene decisiones, convenciones, roadmap, dependencias y estado canonico.
- `Risk Analyst`: detecta riesgos, bloqueos, cuellos de botella y cambios de tendencia.
- `Delivery Metrics Analyst`: calcula flow metrics, DORA y health score.
- `Workload Balancer`: propone redistribucion segun WIP, skills y capacidad.
- `Code Review Scout`: revisa PRs parcialmente, identifica riesgos y falta de tests.
- `Release Guard`: decide si conviene frenar merge/deploy segun CI, riesgo y cobertura.
- `Automation Finder`: detecta procesos repetitivos automatizables.
- `Dispatcher`: decide que agente/modelo/herramienta debe ejecutar una tarea.

#### 6. Action Executor Layer

Responsabilidad:

- Ejecutar cambios en Trello/GitHub/Discord/email.
- Aplicar politicas de seguridad.
- Registrar cada accion en outbox y decision log.

Acciones permitidas automaticamente:

- Publicar resumen.
- Crear recomendacion.
- Marcar alerta como notificada.
- Crear card de seguimiento de baja criticidad.
- Comentar en PR con analisis no bloqueante.

Acciones con aprobacion humana:

- Cambiar responsables.
- Cambiar fechas comprometidas.
- Cerrar o mergear PR.
- Detener despliegues.
- Cambiar prioridad critica.
- Archivar cards.
- Etiquetar incidentes severos.

#### 7. Observability Layer

Responsabilidad:

- Centralizar logs, auditoria y alertas.
- Medir salud de workflows y agentes.

Elementos:

- Error workflow global.
- Log streaming a Sentry/syslog/webhook si disponible.
- `workflow_runs_audit`.
- `ai_decisions`.
- `events_dead_letter`.
- Alertas por SLO.
- Dashboard semanal.

### Flujo de datos objetivo

1. GitHub/Trello/Discord generan evento.
2. Trigger nativo captura evento.
3. Normalizador crea `events_inbox` con `event_id` idempotente.
4. Router de eventos decide dominio: task, repo, CI, deploy, incident, chat.
5. Adapters enriquecen datos faltantes.
6. Project State actualiza tablas canonicas.
7. Metrics Engine recalcula indicadores afectados.
8. AI Orchestrator evalua contexto y produce decision estructurada.
9. Policy Gate valida autoridad, riesgo y necesidad de aprobacion.
10. Action Executor envia notificaciones o cambios via nodos nativos.
11. Outbox registra resultado.
12. Observability registra trazas, errores, latencia y decision.

### Tolerancia a fallos

- Idempotencia en cada evento externo.
- Outbox para acciones externas.
- DLQ para eventos que superen retries.
- Retry exponencial por tipo de integracion.
- Circuit breaker para GitHub/Trello/Gemini si fallan repetidamente.
- Reconciliacion programada cada cierto intervalo para cubrir eventos perdidos.
- Cache Redis con TTL para lecturas costosas, nunca como fuente de verdad.
- `Stop And Error` cuando una condicion critica requiere activar error workflow.
- Healthcheck de `bot-bridge`, n8n, Postgres, Redis y Gotenberg.

### Seguridad

- Credenciales n8n para GitHub/Trello/Discord/Gemini/Postgres/Redis.
- External secrets si el plan lo permite.
- Principio de minimo privilegio:
  - GitHub read para monitoreo.
  - GitHub write solo para comments/issues si se aprueba.
  - Trello write solo para cards/comments/labels autorizados.
- Separar tokens backend/frontend si los permisos difieren.
- Rotacion de secretos.
- Firmas/verificacion en triggers cuando aplique.
- No interpolar SQL.
- No guardar secretos en logs ni payloads AI.
- Redactar datos sensibles en ejecuciones.

### Escalabilidad

- Separar workflows por dominio y responsabilidad.
- Usar colas si el volumen de eventos crece.
- Guardar snapshots incrementales en vez de payloads completos duplicados.
- Indexar tablas por `event_id`, `source`, `occurred_at`, `repo`, `trello_card_id`, `pull_request_number`.
- Ejecutar reconciliaciones por repositorio/board en workflows separados.
- Evitar merges enormes con 10+ ramas cuando se pueda encapsular en adapters.
- Usar paginacion y checkpoints.

## 3. Funciones principales de un Project Manager AI profesional

### A. Funcion profesional esperada

#### Gobernanza de proyecto

Debe mantener:

- Vision del producto.
- Objetivos del sprint.
- Roadmap.
- Dependencias.
- Riesgos.
- Stakeholders.
- Decisiones arquitectonicas.
- Politicas de entrega.

Base PMBOK:

- Integracion.
- Alcance.
- Cronograma.
- Costos/capacidad.
- Calidad.
- Recursos.
- Comunicaciones.
- Riesgos.
- Interesados.

#### Agile/Scrum

Debe ayudar con:

- Sprint planning.
- Daily signal.
- Backlog refinement.
- Priorizacion.
- Sprint review.
- Retrospectiva.
- Definition of Ready.
- Definition of Done.
- WIP limits.
- Bloqueos.

#### Lean Software Delivery

Debe detectar:

- Wait time.
- Handoffs innecesarios.
- Rework.
- WIP excesivo.
- Tareas estancadas.
- Dependencias bloqueantes.
- Lotes demasiado grandes.

#### Engineering Management

Debe observar:

- Carga por persona.
- Bus factor.
- Review latency.
- Calidad de PRs.
- Riesgo tecnico.
- Deuda tecnica.
- Onboarding.
- Consistencia de convenciones.

#### DevOps Observability

Debe monitorear:

- CI/CD.
- Deployments.
- Incidentes.
- Rollbacks.
- MTTR.
- Change failure rate.
- Deployment frequency.
- Uptime.
- Logs y errores.

#### AI Orchestration

Debe coordinar:

- Agentes especializados.
- Modelos adecuados por tarea.
- Herramientas seguras.
- Memoria de contexto.
- Politicas de accion.
- Escalamiento humano.
- Auditoria de decisiones.

## 4. Evaluacion del bot actual

### Funcionalidades ya implementadas

- Chat Discord con comandos.
- Comando `!kpis`.
- Comando `!reporte`.
- Comandos rapidos de estado, vencidas, miembros, commits, CI y progreso.
- Monitor programado.
- Recoleccion de Trello cards/lists/members/checklists.
- Recoleccion de GitHub commits/PRs/CI runs via API.
- Calculo de progreso, vencidas, stales, sin asignar, sin fecha.
- Calculo de velocidad, bus factor, commits convencionales, PR open time y merge ratio.
- Persistencia de analisis en Postgres.
- Snapshots de tareas.
- Alertas Discord.
- Reporte PDF semanal.
- Memoria Redis para chat.
- Deduplicacion Redis.
- Cache de KPIs.
- Agente Gemini nativo en chat.
- Cadena Gemini nativa en alertas de monitor.
- Workflows separados para alertas IA y error handler.

### Funcionalidades parcialmente cubiertas

- Context guardian: existe contexto dinamico, pero no hay registro formal de decisiones, ADRs, roadmap o politicas.
- Risk management: detecta vencidas, proyeccion y stales, pero no tiene risk register con owner, probabilidad, impacto y mitigacion.
- Reviewer parcial: puede revisar diffs bajo demanda, pero no hay workflow de PR review automatico con criterios de calidad.
- Dispatcher: existe un router de comandos, pero no decide agente/modelo/herramienta segun taxonomia de trabajo.
- Observabilidad: ya hay `errorWorkflow` en workflows criticos y `correlation_id` en ingress GitHub/Trello, pero aun no hay `workflow_runs_audit`, `ai_decisions`, log streaming ni dashboard operativo.
- Modelo canonico de eventos: ya existe `events_inbox` y deduplicacion de eventos GitHub/Trello al ingresar, pero todavia no hay event router completo, replay ni outbox operativo.
- Sync bidireccional: lee Trello/GitHub y puede crear tarjeta via tool, pero no hay sincronizacion coherente PR-card-status-deploy.
- Planificacion dinamica: calcula proyeccion, pero no considera feriados, capacidad, ausencias ni carga real asignable.
- Mejora continua: detecta algunos problemas, pero no genera experimentos de proceso ni acciones Kaizen trazables.

### Funcionalidades faltantes

- Reemplazo de HTTP Trello/GitHub por nodos oficiales donde aplique.
- Credenciales centralizadas por app.
- Uso operativo completo de `events_inbox/outbox`.
- DLQ.
- Structured logging.
- Audit log de decisiones AI.
- Policy gate para acciones autonomas.
- Human-in-the-loop.
- Risk register profesional.
- Capacity calendar.
- Skill matrix.
- Sprint model.
- Health score formal.
- DORA metrics completas.
- Revision automatizada de PRs con rubric.
- Integracion real de deployments/uptime/incidentes.
- Trazabilidad Trello card -> branch -> PR -> commit -> CI -> deploy -> release.
- Backups y estrategia de restore.
- Seguridad de secretos de produccion.

## 5. Mejoras propuestas por funcionalidad faltante

### 1. Migrar webhooks GitHub a GitHub Trigger [DONE]

Por que importa:

- Reduce contratos manuales.
- Mejora mantenibilidad.
- Permite eventos tipados.

Impacto operativo:

- Menos fragilidad en cambios de payload.
- Mejor trazabilidad por evento.
- Menos endpoints manuales.

Como implementarlo:

- Crear `Ingest - GitHub Events`.
- Reemplazar `GitHub Event Webhook1`.
- Configurar eventos: `Push`, `Pull request`, `Pull request review`, `Pull request review comment`, `Check suite`, `Status`, `Deployment status`.
- Normalizar cada evento a `events_inbox`.
- Conectar a `Router - Project Events`.

Integraciones sugeridas:

- `GitHub Trigger`.
- `GitHub` node para enriquecer PR/repo/reviews.
- HTTP GitHub con credencial predefinida solo para Actions runs/diff si el nodo no cubre la operacion.

Metricas:

- Eventos GitHub recibidos por tipo.
- Eventos duplicados.
- Lag evento->procesamiento.
- Fallos por evento.
- PR review latency.
- Build failure rate.

### 2. Migrar webhook Trello a Trello Trigger [DONE]

Por que importa:

- Evita webhooks manuales.
- Usa credenciales Trello administradas por n8n.
- Mejora trazabilidad de cambios de cards/listas.

Impacto operativo:

- Mejor captura de cambios de estado.
- Menos polling.
- Mejor deteccion de bloqueos.

Como implementarlo:

- Crear `Ingest - Trello Events`.
- Reemplazar `Trello Event Webhook`.
- Configurar `Model ID` del board o listas relevantes.
- Normalizar acciones: card created, moved, updated, completed, due changed, member assigned, attachment added, comment added.
- Persistir en `events_inbox`.

Integraciones sugeridas:

- `Trello Trigger`.
- `Trello` node para Card, Board, Board Member, Checklist y Attachment.

Metricas:

- Card movement lead time.
- WIP por lista.
- Cards bloqueadas.
- Aging WIP.
- Cambios de due date.

### 3. Sustituir HTTP Trello por Trello node [PENDING]

Por que importa:

- El nodo Trello cubre Board, Board Member, Card, Checklist, Attachment y Label.

Impacto operativo:

- Menos URLs manuales.
- Mejor credencial.
- Mejor mantenibilidad.

Como implementarlo:

- `Trello Cards1`, `Trello Cards`, `Trello Cards Delta1` -> `Trello` Card Get Many o Board/Card operation equivalente.
- `Trello Lists1`, `Trello Lists` -> `Trello` Board Get o listas si la operacion esta disponible en la UI instalada; si no, HTTP con credencial Trello predefinida.
- `Trello Members1`, `Trello Members` -> `Trello` Board Member Get All.
- `Trello Checklists` -> `Trello` Checklist operations.

Metricas:

- Tiempo de respuesta Trello.
- Errores 401/429.
- Cards normalizadas por ejecucion.
- Coverage de campos obligatorios.

### 4. Sustituir HTTP GitHub por GitHub node donde aplique [PENDING]

Por que importa:

- El nodo GitHub cubre repositorios, PRs, issues, reviews, releases, files y workflows.

Impacto operativo:

- Menos headers manuales.
- Mejor uso de credenciales.
- Mas facil extender a reviewer y release guard.

Como implementarlo:

- `GH Back PRs`, `GH Front PRs` -> `GitHub` Repository Get Pull Requests.
- PR reviews -> `GitHub` Review Get/Get Many.
- Issues y comentarios -> `GitHub` Issue operations.
- Workflow metadata -> `GitHub` Workflow List/Get cuando sea suficiente.
- Commits con diff y Actions runs -> mantener HTTP si no existe operacion nativa equivalente en la version instalada, pero con credencial GitHub predefinida.

Metricas:

- PRs abiertas.
- PR stale rate.
- Review latency.
- Merge ratio.
- CI status freshness.

### 5. Introducir event inbox/outbox [PARTIAL]

Por que importa:

- Permite idempotencia, replay y auditoria.

Impacto operativo:

- Eventos no se pierden si falla Gemini/Discord/Postgres.
- Las acciones externas son reintentables.

Estado actual:

- `init.sql` ya define `events_inbox` y `events_outbox`.
- Los workflows `Discord Eventos GitHub PetSafe` y `Discord Eventos Trello PetSafe` ya insertan en `events_inbox` con `ON CONFLICT DO NOTHING`.
- Ambos ingress generan `event_id` y `correlation_id`.
- Ya existe `Router - Project Events` y consumo basico de `events_outbox`, con replay manual y monitor de DLQ, pero falta DLQ formal.

Como implementarlo:

- Mantener `Normalize Event` como primer paso canonico.
- Mantener `Insert events_inbox ON CONFLICT DO NOTHING` como segundo paso.
- Endurecer `Router - Project Events` para validar payloads y anexar metadata operativa.
- Completar `Executor - Discord Outbox` con backoff adaptativo y DLQ formal.
- Agregar replay / DLQ para eventos agotados o dependencias caidas.

Metricas:

- Pending events.
- DLQ count.
- Retry count.
- Processing latency.

### 6. Structured logging y observabilidad [PARTIAL]

Por que importa:

- Sin trazabilidad no hay operacion profesional.

Impacto operativo:

- Debug rapido.
- Auditoria.
- Menor MTTR.

Estado actual:

- `correlation_id` ya existe al entrar por GitHub/Trello.
- El `errorWorkflow` ya esta configurado en workflows criticos.
- Las tablas `workflow_runs_audit` y `ai_decisions` existen en `init.sql`.
- Falta insertar registros reales de forma sistematica y exponer salud operativa.

Como implementarlo:

- Propagar `correlation_id` por workflows hijos.
- Insertar `workflow_runs_audit`.
- Registrar decisiones AI en `ai_decisions`.
- Activar log streaming si esta disponible.
- Crear reportes de salud.

Metricas:

- Workflow success rate.
- Node failure rate.
- P95 duration.
- Error rate por integracion.
- AI LLM error rate.

### 7. Decision ledger AI

Por que importa:

- Las decisiones del PM AI deben ser explicables.

Impacto operativo:

- Facilita confianza.
- Permite auditoria.
- Reduce acciones impulsivas.

Como implementarlo:

Tabla `ai_decisions`:

```sql
decision_id uuid primary key,
correlation_id text,
agent_name text,
decision_type text,
input_summary text,
evidence jsonb,
recommendation text,
confidence numeric,
risk_level text,
requires_human_approval boolean,
approved_by text,
status text,
created_at timestamptz default now()
```

Metricas:

- Decisiones por agente.
- Porcentaje que requiere aprobacion.
- Acceptance rate.
- Reversal rate.

### 8. Policy gate

Por que importa:

- Evita que el sistema haga cambios riesgosos sin control.

Impacto operativo:

- Autonomia segura.
- Menos errores operativos.

Como implementarlo:

- Crear `Policy - Action Gate`.
- Entrada: accion propuesta, severidad, evidencia, actor, sistema destino.
- Salida: `allow`, `deny`, `needs_approval`.
- Si necesita aprobacion, crear card/Discord interaction.

Metricas:

- Actions allowed.
- Actions blocked.
- Approval lead time.
- Incidentes por accion automatica.

### 9. Capacity y calendario

Por que importa:

- La proyeccion actual usa velocidad simple, no disponibilidad real.

Impacto operativo:

- Mejores estimaciones.
- Menos sobrecarga.
- Reasignaciones mas justas.

Como implementarlo:

- Tabla `team_capacity`.
- Tabla `calendar_exceptions`.
- Campos: persona, fecha, capacidad_horas, ausente, feriado, notas.
- Ajustar forecast por capacidad restante.

Metricas:

- Capacity utilization.
- Load imbalance.
- Overcommitment.
- Forecast confidence.

### 10. Reviewer parcial de PRs

Por que importa:

- PM AI debe detectar riesgo tecnico antes de merge.

Impacto operativo:

- Menos regresiones.
- Mejor consistencia.
- Alertas tempranas.

Como implementarlo:

- Trigger GitHub `Pull request`.
- Adapter obtiene diff, changed files, checks, tests.
- `Code Review Scout` genera hallazgos.
- Comenta en PR solo si cumple politica.
- Escala a humano si riesgo alto.

Metricas:

- PRs revisadas.
- Hallazgos por severidad.
- False positive rate.
- Defect escape rate.

### 11. Release guard

Por que importa:

- Debe frenar entregas riesgosas.

Impacto operativo:

- Menos despliegues fallidos.
- Mejor control de calidad.

Como implementarlo:

- Ingestar `Deployment status`, checks y release events.
- Calcular release health.
- Si falla CI o change failure risk alto, crear alerta y bloquear recomendacion de merge/deploy.

Metricas:

- Deployment frequency.
- Change failure rate.
- MTTR.
- Rollbacks.
- Release stability.

### 12. Guardian de contexto

Por que importa:

- Un PM AI sin memoria institucional se vuelve repetitivo e inconsistente.

Impacto operativo:

- Decisiones mas coherentes.
- Menos perdida de contexto.
- Mejor onboarding.

Como implementarlo:

- Tablas `project_facts`, `architecture_decisions`, `active_priorities`, `roadmap_items`.
- RAG con pgvector para documentos del proyecto.
- Workflow `Context - Update Canonical Memory`.
- Resumen diario/semanal de contexto.

Metricas:

- Context freshness.
- Decision references.
- Stale assumptions.
- Contradictions detected.

## 6. Matriz de migracion de integraciones

| Actual | Workflow | Reemplazo recomendado | Prioridad | Nota |
|---|---|---|---|---|
| `GitHub Event Webhook1` | Discord Eventos GitHub | `GitHub Trigger` | Alta | Eventos push/PR/check/deploy/status nativos. |
| `Trello Event Webhook` | Discord Eventos Trello | `Trello Trigger` | Alta | Usar Model ID del board/list/card segun granularidad. |
| `Trello Cards*` HTTP | Chat/Monitor/Contexto | `Trello` Card/Board ops | Alta | Mantener HTTP solo si la operacion exacta no existe en UI instalada. |
| `Trello Members*` HTTP | Chat/Monitor | `Trello` Board Member Get All | Alta | Credencial Trello n8n. |
| `Trello Checklists` HTTP | Monitor | `Trello` Checklist ops | Media | Si requiere board-wide checklist no soportado, HTTP con credencial Trello. |
| `GH * PRs` HTTP | Chat/Monitor | `GitHub` Repository Get Pull Requests | Alta | PRs son nativos. |
| `GH * Commits` HTTP | Chat/Monitor/Reporte/Contexto | `GitHub` node si version soporta commits; si no HTTP con credencial GitHub | Media | Validar version instalada. |
| `GH * CI Runs` HTTP | Chat/Monitor | HTTP con credencial GitHub predefinida o nodo Workflow si alcanza | Media | Actions runs suelen requerir endpoint especifico. |
| `Diff Backend/Frontend` HTTP | Chat | HTTP con credencial GitHub predefinida | Media | Mantener como API gap si no hay operacion nativa. |
| `Gemini Event Analysis1` HTTP | Contexto | `lmChatGoogleGemini` + `chainLlm` | Alta | Ya existe patron en Monitor. |
| `Gemini Executive Summary` HTTP | Reporte | `lmChatGoogleGemini` + `chainLlm` | Alta | Evita API key en URL. |
| `Discord Evento*` HTTP | Eventos | `Discord` node cuando no requiera webhook raw | Media | Para embeds/files complejos, usar Discord node o HTTP con credencial segura. |
| `Gotenberg HTML->PDF` HTTP | Reporte | Mantener HTTP | Baja | Servicio interno sin nodo nativo equivalente. |

## 7. Roadmap recomendado

### Quick wins

1. `DONE` Configurar `Monitor PetSafe - Error Handler` como error workflow global para los workflows criticos.
2. `DONE` Migrar `Gemini Event Analysis1` y `Gemini Executive Summary` a nodos nativos LangChain/Gemini.
3. `DONE` Cambiar `GitHub Event Webhook1` por `GitHub Trigger`.
4. `DONE` Cambiar `Trello Event Webhook` por `Trello Trigger`.
5. `PENDING` Migrar PRs GitHub a `GitHub` node.
6. `PENDING` Migrar cards/members/checklists Trello a `Trello` node donde la UI instalada lo soporte.
7. `PARTIAL` Reemplazar SQL interpolado por `queryReplacement`.
8. `DONE` Crear tabla `events_inbox`.
9. `PARTIAL` Agregar `correlation_id` a todos los eventos y logs.
10. `DONE` Cambiar credenciales por defecto en `docker-compose.yml`.
11. `DONE` Resolver montaje de `init.sql`.
12. `DONE` Actualizar `!ayuda` para quitar referencias a webhooks manuales cuando los triggers nativos entren en produccion.

### Mediano plazo

1. Implementar event router canonico.
2. Implementar outbox y DLQ.
3. Crear `System - Config Resolver`.
4. Crear `Adapter - GitHub Snapshot` y `Adapter - Trello Snapshot`.
5. Crear `Metrics Engine` con DORA, flow metrics y health score.
6. Crear `Risk Register`.
7. Crear `Capacity Calendar`.
8. Crear `Decision Ledger`.
9. Crear `Policy - Action Gate`.
10. Crear dashboard operativo semanal.
11. Implementar reviewer parcial de PRs.
12. Implementar release guard para CI/deploy.

### Arquitectura avanzada futura

1. n8n en modo cola con workers separados.
2. Postgres como DB principal de n8n para produccion.
3. External secrets vault.
4. Log streaming a Sentry/syslog/OpenTelemetry gateway.
5. RAG de contexto con pgvector: ADRs, README, issues, PRs, Trello history.
6. Multi-agent orchestration formal con contratos JSON.
7. Human-in-the-loop para acciones criticas.
8. Evaluacion automatica de calidad de respuestas AI.
9. Simulacion de plan sprint y forecast Monte Carlo.
10. Integracion de uptime/incident management.
11. Scorecards por repositorio/equipo.
12. Auto-generacion de retrospectivas basadas en evidencia.

## 8. Arquitectura objetivo de workflows

```text
Ingest - GitHub Events
  -> Normalize GitHub Event
  -> Insert events_inbox
  -> Router - Project Events

Ingest - Trello Events
  -> Normalize Trello Event
  -> Insert events_inbox
  -> Router - Project Events

Ingest - Discord Commands
  -> Normalize Command
  -> PM Orchestrator
  -> Response Formatter

Router - Project Events
  -> Adapter Enrichment
  -> Project State Update
  -> Metrics Engine
  -> AI Orchestrator
  -> Policy Gate
  -> Action Outbox
  -> Notifiers/Executors

Scheduled Reconciliation
  -> GitHub Snapshot
  -> Trello Snapshot
  -> Deployment Snapshot
  -> Compare With Canonical State
  -> Emit Missing Events

Observability
  -> Error Workflow
  -> Workflow Audit
  -> DLQ
  -> Health Dashboard
```

## 9. Contratos recomendados entre workflows

### Evento canonico

```json
{
  "correlation_id": "evt_...",
  "source": "github|trello|discord|deployment|schedule",
  "event_type": "pull_request.opened",
  "occurred_at": "2026-05-06T00:00:00.000Z",
  "actor": "username",
  "entity": {
    "type": "pull_request",
    "id": "repo#123"
  },
  "links": {
    "repo": "owner/repo",
    "pull_request_number": 123,
    "trello_card_id": "abc"
  },
  "payload": {},
  "metadata": {
    "workflow": "Ingest - GitHub Events",
    "environment": "prod"
  }
}
```

### Decision AI

```json
{
  "correlation_id": "evt_...",
  "agent": "Risk Analyst",
  "decision_type": "risk_detected",
  "summary": "PR stale y CI fallido en backend",
  "evidence": {
    "pr_age_days": 8,
    "ci_status": "failure"
  },
  "recommendation": {
    "action": "notify_owner",
    "owner": "David",
    "due": "2026-05-07"
  },
  "confidence": 0.82,
  "risk_level": "high",
  "requires_human_approval": false
}
```

### Accion externa

```json
{
  "correlation_id": "evt_...",
  "target": "trello|github|discord|email",
  "action": "create_comment",
  "idempotency_key": "github:owner/repo:pr:123:comment:risk-summary",
  "payload": {},
  "policy_result": "allow"
}
```

## 10. Definition of Done para la migracion

- No quedan webhooks manuales para GitHub/Trello si existe trigger nativo adecuado.
- No quedan llamadas Trello por HTTP si existe operacion nativa equivalente.
- No quedan llamadas GitHub por HTTP para PRs/issues/reviews/repos si existe operacion nativa equivalente.
- Las llamadas HTTP restantes usan credenciales predefinidas, retries y justificacion documentada.
- Todos los workflows criticos tienen error workflow configurado.
- Cada evento tiene `correlation_id`.
- Cada accion externa tiene `idempotency_key`.
- Cada decision AI queda registrada.
- No hay SQL interpolado con datos externos.
- Hay dashboard de salud con success rate, latency, errors, backlog y DLQ.
- Hay runbook de incidentes y procedimiento de replay.

## 11. Proximos pasos recomendados

1. Terminar la migracion de PRs GitHub y snapshots Trello a nodos nativos donde la UI instalada ya lo soporte.
2. Propagar `correlation_id` a workflows hijos y comenzar a poblar `workflow_runs_audit`.
3. Endurecer `Router - Project Events` con reglas por dominio y filtros por severidad.
4. Completar `events_outbox` con DLQ formal y replay controlado.
5. Cerrar la deuda restante de SQL interpolado.
6. Validar en entorno real que los triggers GitHub/Trello produzcan el payload esperado en al menos 5 eventos por origen.
7. Implementar primera version del `Decision Ledger`.
8. Activar observabilidad operativa: health report, backlog, retries y fallas por integracion.
