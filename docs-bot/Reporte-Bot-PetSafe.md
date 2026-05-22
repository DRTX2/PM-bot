# INFORME DE DESARROLLO — BOT PROJECT MANAGER AI PETSAFE

**Código:** CAL-BOT-INF-001  
**Versión:** 1.0  
**Proceso:** Calidad y Gestión de Proyectos  
**Fecha de elaboración:** 19/05/2026  
**Última revisión:** 19/05/2026

---

## I. TÍTULO

Desarrollo e implementación del **Bot Project Manager AI PetSafe**: sistema de orquestación inteligente para la gestión automatizada de proyectos de software, con integración de Discord, GitHub, Trello y análisis asistido por inteligencia artificial.

---

## II. INTRODUCCIÓN

El presente informe documenta el proceso de desarrollo, implementación y despliegue del Bot Project Manager AI para el proyecto PetSafe, una plataforma digital orientada a la gestión clínica veterinaria. El bot fue concebido como respuesta a una necesidad real del equipo de desarrollo: la dificultad de mantener visibilidad centralizada sobre el estado del proyecto cuando la información se encuentra distribuida entre múltiples herramientas (GitHub, Trello, Discord) y la consolidación de métricas, riesgos y avances recae manualmente sobre el gestor del proyecto.

La solución desarrollada integra capacidades de inteligencia artificial generativa (Google Gemini 2.5 Pro) con una arquitectura de orquestación basada en n8n, permitiendo al equipo interactuar con un asistente virtual que no solo responde consultas, sino que monitorea proactivamente el proyecto, detecta riesgos, revisa código, genera reportes ejecutivos en PDF y requiere aprobación humana para decisiones críticas.

El sistema opera actualmente en producción sobre un VPS con infraestructura Docker, procesando eventos en tiempo real y proporcionando al equipo una herramienta de gobernanza ágil que combina automatización con supervisión humana (*Human-in-the-Loop*).

---

## III. OBJETIVO GENERAL

Diseñar, implementar y desplegar un sistema de gestión de proyectos inteligente basado en IA que centralice la información del proyecto PetSafe desde múltiples fuentes, automatice el monitoreo y análisis del estado del proyecto, y proporcione al equipo herramientas de comunicación, reportería y toma de decisiones asistidas por inteligencia artificial.

### 3.1 Objetivos Específicos

1. **Diseño del bot:** Definir una arquitectura modular event-driven que permita la separación de responsabilidades entre ingesta de eventos, análisis, decisiones IA y ejecución de acciones.
2. **Implementación de funcionalidades:** Desarrollar más de 25 workflows de n8n que cubran chat interactivo, monitoreo, reportería, agentes IA especializados y gestión PMO.
3. **Integración con APIs:** Conectar el sistema con las APIs de GitHub, Trello, Discord y Google Gemini para obtener datos en tiempo real del proyecto.
4. **Almacenamiento de datos:** Implementar un modelo de datos en PostgreSQL con pgvector que soporte eventos canónicos, decisiones IA, auditoría, calendario PMO y análisis históricos.
5. **Pruebas:** Establecer un plan de pruebas end-to-end que valide cada flujo del sistema, desde la ingesta de eventos hasta la notificación en Discord.
6. **Despliegue:** Contenerizar todos los servicios con Docker Compose y desplegar en un VPS con políticas de reinicio automático, healthchecks y aislamiento de red.
7. **Seguridad:** Aplicar controles de autenticación, cifrado de credenciales, validación de entradas y separación de secretos mediante variables de entorno.
8. **Documentación:** Generar documentación técnica completa que cubra arquitectura, funcionalidades, plan de pruebas, guía de operación y roadmap de evolución.

---

## IV. ALCANCE DEL PROYECTO

### 4.1 Incluido en el alcance

- Desarrollo de un bot conversacional accesible desde Discord con más de 15 comandos operativos.
- Implementación de 6 agentes IA especializados (PM Orchestrator, Code Review Scout, Context Guardian, Risk Analyst, Release Guard, Sync Bidireccional).
- Generación automatizada de reportes PDF ejecutivos semanales con análisis técnico de commits, PRs, deuda técnica y KPIs.
- Sistema de monitoreo continuo con cálculo de KPIs, detección de anomalías y alertas inteligentes.
- Arquitectura event-driven con tablas canónicas `events_inbox` y `events_outbox`, idempotencia y Dead Letter Queue.
- Dashboard web de aprobaciones humanas para decisiones bloqueadas por la IA.
- Calendario PMO interno con gestión de reuniones sin dependencias de servicios externos.
- Despliegue en producción con Docker Compose sobre VPS.

### 4.2 Excluido del alcance

- Desarrollo de una interfaz web completa de administración del bot (se usa la interfaz nativa de n8n).
- Integración con servicios de calendario externos (Google Calendar, Microsoft Outlook).
- Implementación de un sistema de permisos granular por usuario dentro de Discord.
- Auditoría certificable de seguridad o conformidad ISO.
- Migración del bot-bridge de Discord a un SDK oficial de Discord.js con slash commands.

---

## V. DEFINICIONES

| Término | Definición |
|---|---|
| **n8n** | Plataforma de automatización de workflows open-source que permite crear flujos de trabajo visuales con nodos conectados. |
| **Workflow** | Flujo de trabajo automatizado compuesto por nodos que procesan datos secuencialmente o en paralelo dentro de n8n. |
| **Agente IA** | Workflow especializado que utiliza un modelo de lenguaje (Gemini) para analizar contexto y tomar decisiones sobre un dominio específico. |
| **Event-driven** | Patrón arquitectónico donde el sistema reacciona a eventos (commits, PRs, movimientos de tarjetas) en lugar de ejecutar lógica de forma secuencial. |
| **Dead Letter Queue (DLQ)** | Cola de mensajes fallidos que almacena eventos que no pudieron ser procesados después de múltiples reintentos. |
| **Human-in-the-Loop** | Patrón de gobernanza donde ciertas decisiones de la IA requieren aprobación humana antes de ejecutarse. |
| **KPI** | Indicador clave de desempeño utilizado para medir el estado y progreso del proyecto. |
| **RAID** | Registro de Riesgos, Acciones, Issues y Dependencias del proyecto. |
| **bot-bridge** | Servicio Node.js intermedio que escucha eventos de Discord y los reenvía al webhook de n8n. |
| **Gotenberg** | Servicio de conversión de documentos que transforma HTML en PDF. |
| **pgvector** | Extensión de PostgreSQL que permite almacenar y consultar embeddings vectoriales. |
| **Correlation ID** | Identificador único que permite rastrear un evento a través de todo el pipeline de procesamiento. |

---

## VI. RESPONSABILIDADES

| Responsable | Responsabilidad en el proyecto | Relación con el bot |
|---|---|---|
| Bonilla Guerrero Fernando Joel — *Gestor del Proyecto* | Coordina cronograma, comunicación con el cliente, control de cambios y consolidación documental. | Principal usuario del bot para consultas de estado, KPIs y reportes ejecutivos. Aprobador en el Dashboard de decisiones IA. |
| Barragán Pozo David Josué — *Desarrollador Full Stack* | Integra frontend y backend, revisa arquitectura, módulos y pruebas de integración. | Desarrollador principal del bot, diseño de arquitectura de workflows, configuración de infraestructura Docker y agentes IA. |
| García Abata Josué Joel — *Desarrollador Frontend* | Desarrolla interfaces web/móviles, flujos de usuario y consumo de APIs. | Contribuyente monitoreado por el bot mediante análisis de commits y PRs del repositorio frontend. |
| Manjarres Quinteros David Oswaldo — *Desarrollador Backend* | Desarrolla lógica de negocio, APIs REST, base de datos, autenticación y servicios. | Contribuyente monitoreado por el bot mediante análisis de commits y PRs del repositorio backend. |

---

## VII. DESARROLLO DE LA ACTIVIDAD

### 7.1 Análisis del problema

El equipo PetSafe opera con las siguientes herramientas de desarrollo: GitHub para control de versiones (dos repositorios: backend y frontend), Trello para gestión de tareas por sprints, y Discord como canal de comunicación principal. La problemática identificada fue que la información del estado real del proyecto se encontraba fragmentada entre estas herramientas, lo que generaba:

- **Falta de visibilidad consolidada:** El gestor del proyecto debía consultar manualmente GitHub, Trello y Discord para construir una imagen del estado actual.
- **Reportes manuales costosos:** La generación de reportes semanales requería horas de consolidación manual de commits, PRs, tareas completadas y métricas de avance.
- **Detección tardía de riesgos:** Los cuellos de botella, tareas envejecidas y deuda técnica se identificaban cuando ya habían impactado el cronograma.
- **Descoordinación entre herramientas:** Los cambios en GitHub (merges, PRs) no se reflejaban automáticamente en Trello ni se comunicaban oportunamente al equipo.

### 7.2 Diseño de la solución

Se diseñó una arquitectura modular basada en cinco capas funcionales:

1. **AI Intelligence:** Agentes IA especializados que analizan eventos y generan decisiones.
2. **Core System:** Infraestructura de ruteo de eventos, auditoría, configuración y manejo de errores.
3. **Communication & Events:** Canales de entrada/salida (Discord, GitHub webhooks, Trello webhooks).
4. **Monitoring & Reliability:** Monitoreo programado, alertas y gestión de mensajes fallidos.
5. **PMO & Reporting:** Reportes ejecutivos, dashboards y herramientas de gobernanza.

La arquitectura sigue un patrón event-driven donde los eventos externos (commits, PRs, movimientos de tarjetas) se normalizan en una tabla canónica `events_inbox`, se enrutan mediante un router central hacia agentes especializados, y las acciones resultantes se encolan en `events_outbox` para su ejecución controlada.

### 7.3 Implementación

La implementación se realizó de forma iterativa siguiendo las siguientes fases:

**Fase 1 — Infraestructura base:**
- Configuración de Docker Compose con n8n, PostgreSQL/pgvector, Redis y Gotenberg.
- Desarrollo del bot-bridge Node.js como puente Discord → n8n.
- Diseño e implementación del esquema de base de datos (`init.sql`) con tablas para análisis, eventos, decisiones IA, auditoría y calendario.

**Fase 2 — Chat y monitoreo:**
- Implementación del workflow `Chat Discord PetSafe` con deduplicación Redis, interpretación de comandos y agente Gemini con herramientas (tools).
- Desarrollo del `Monitor PetSafe` con cálculo de KPIs, snapshots y detección de severidad.
- Integración de `Monitor PetSafe - Alertas IA` para diagnósticos inteligentes.

**Fase 3 — Eventos y agentes:**
- Migración de webhooks manuales a triggers nativos de GitHub y Trello.
- Implementación de `events_inbox` con ingesta idempotente y `correlation_id`.
- Desarrollo de los 6 agentes IA especializados.
- Implementación del Router de eventos y el PM Orchestrator.

**Fase 4 — Reportería y PMO:**
- Desarrollo del `Reporte PDF Semanal` con análisis técnico de commits/PRs, detección de deuda técnica y ranking de participantes.
- Implementación del Dashboard de aprobaciones humanas.
- Desarrollo del calendario PMO interno y motor de gobierno.

**Fase 5 — Endurecimiento:**
- Migración de credenciales a variables de entorno seguras.
- Implementación del Error Handler global.
- Configuración de DLQ con replay automático.
- Auditoría de ejecuciones con `workflow_runs_audit`.

### 7.4 Configuración

La configuración del sistema se centraliza en:

- **Variables de entorno (`.env`):** Contienen todas las credenciales sensibles (tokens GitHub, Trello, Discord, Gemini, PostgreSQL). Nunca se versionan en el repositorio.
- **Nodo Configuración en n8n:** Cada workflow principal contiene un nodo `Configuración` que lee variables de entorno y las distribuye a los nodos subsiguientes.
- **`System - Config Resolver`:** Workflow hijo que normaliza la configuración operativa desde variables de entorno y base de datos.
- **`init.sql`:** Script SQL que inicializa el esquema de base de datos con todas las tablas, índices y datos semilla necesarios.

### 7.5 Pruebas

Se definió un plan de pruebas end-to-end documentado en `TEST_PLAN_PM_AI.md` que cubre:

1. **Flujos de eventos:** Validación del pipeline completo desde la ingesta de un evento GitHub/Trello hasta la notificación en Discord.
2. **Integración con Discord:** Pruebas de cada comando disponible (`!estado`, `!kpis`, `!reporte`, etc.).
3. **Human-in-the-Loop:** Inyección de decisiones bloqueadas y aprobación desde el dashboard web.
4. **Reporte semanal:** Generación on-demand y validación del PDF generado.
5. **Tolerancia a fallos:** Simulación de fallos de envío y validación del comportamiento de DLQ y replay.

### 7.6 Despliegue

El sistema se desplegó en un VPS (Virtual Private Server) mediante Docker Compose con la siguiente configuración:

- **5 servicios contenerizados:** n8n, PostgreSQL, Redis, Gotenberg, bot-bridge.
- **Políticas de reinicio:** `restart: unless-stopped` en todos los servicios.
- **Aislamiento de red:** PostgreSQL y Gotenberg publicados solo en loopback.
- **Persistencia:** Volúmenes Docker para datos de n8n, PostgreSQL y Redis.
- **Cifrado:** `N8N_ENCRYPTION_KEY` obligatorio para proteger credenciales almacenadas en n8n.
## VIII. MANUAL DE USUARIO

### 8.1 Descripción del uso del bot

El bot PetSafe PM AI se utiliza exclusivamente a través de Discord. El equipo envía mensajes en el canal configurado y el bot responde con información del proyecto obtenida en tiempo real desde GitHub, Trello y PostgreSQL, procesada por Gemini cuando se requiere análisis inteligente.

### 8.2 Comandos disponibles

| Comando | Descripción |
|---|---|
| `!ayuda` | Muestra la lista completa de comandos disponibles |
| `!estado` | Resumen rápido del proyecto: progreso, tareas vencidas, total de tareas |
| `!kpis` | Indicadores clave de desempeño del periodo actual |
| `!reporte [días]` | Genera un PDF ejecutivo del periodo indicado (default: 7 días) |
| `!riesgos` | Lista de riesgos activos con severidad |
| `!hitos` | Próximos hitos del proyecto con fechas y responsables |
| `!commits` | Actividad reciente de commits en backend y frontend |
| `!ci` | Estado de los últimos runs de CI/CD en GitHub Actions |
| `!vencidas` | Tareas vencidas sin completar |
| `!miembros` | Lista de miembros del equipo con roles |
| `!progreso` | Porcentaje de avance general del proyecto |
| `!fase listar` | Fases del tablero Trello con completitud |
| `!fase sync` | Sincroniza fases de Trello a la base de datos |
| `!acciones` | Lista acciones PMO abiertas con owner y deadline |
| `!raid` | Registro RAID: riesgos, acciones, issues y dependencias |
| `!logs` | Salud del bot, errores recientes e info del sistema |
| `!agenda` | Próximas reuniones del calendario PMO |
| `!reunion [tema]` | Agenda una nueva reunión PMO |

### 8.3 Flujo de interacción

1. El usuario escribe un mensaje en el canal de Discord.
2. El bot-bridge captura el mensaje y lo reenvía al webhook de n8n.
3. n8n deduplica el mensaje mediante Redis.
4. Si es un comando (`!`), se ejecuta la lógica específica del comando.
5. Si es una consulta libre, se construye contexto desde Trello/GitHub/Postgres y se envía a Gemini.
6. La respuesta se devuelve al canal de Discord.

### 8.4 Mensajes de error comunes

| Mensaje | Causa | Solución |
|---|---|---|
| `⚠️ No se pudo obtener información` | Credencial GitHub/Trello inválida | Verificar tokens en `.env` |
| `⏳ Procesando...` (sin respuesta) | Timeout de Gemini o cuota agotada | Esperar o verificar API key |
| `❌ Error interno` | Fallo en un nodo del workflow | Revisar logs en n8n |

---

## IX. DOCUMENTACIÓN TÉCNICA

### 9.1 Arquitectura general

El sistema sigue una arquitectura de microservicios orquestados por n8n con patrón event-driven:

```
┌─────────────────────────────────────────────────────┐
│                    DISCORD                          │
│              (Canal del equipo)                      │
└───────────┬─────────────────────────┬───────────────┘
            │ Mensajes                │ Webhooks
            ▼                         ▼
┌───────────────────┐    ┌────────────────────────────┐
│   bot-bridge      │    │  GitHub/Trello Triggers     │
│   (Node.js)       │    │  (n8n nativos)              │
└───────┬───────────┘    └──────────┬─────────────────┘
        │                           │
        ▼                           ▼
┌───────────────────────────────────────────────────────┐
│                    n8n Engine                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Chat     │ │ Monitor  │ │ Router   │ │ Report  │ │
│  │ Discord  │ │ PetSafe  │ │ Events   │ │ PDF     │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │            │            │             │      │
│       ▼            ▼            ▼             ▼      │
│  ┌──────────────────────────────────────────────────┐│
│  │          Agentes IA (Gemini 2.5 Pro)             ││
│  │  PM Orchestrator │ Code Review │ Risk Analyst    ││
│  │  Context Guard   │ Release Guard│ Sync Bidir.   ││
│  └──────────────────────────────────────────────────┘│
└───────────┬──────────────┬──────────────┬────────────┘
            │              │              │
            ▼              ▼              ▼
┌───────────────┐ ┌──────────────┐ ┌────────────┐
│  PostgreSQL   │ │    Redis     │ │ Gotenberg  │
│  + pgvector   │ │  (caché)     │ │  (PDF)     │
└───────────────┘ └──────────────┘ └────────────┘
```

### 9.2 Estructura de carpetas

```
n8n/
├── bot/
│   ├── 1. 🧠 AI Intelligence/
│   │   ├── AI - Code Review Scout.json
│   │   ├── AI - Context Guardian.json
│   │   ├── AI - PM Orchestrator.json
│   │   ├── AI - Release Guard.json
│   │   ├── AI - Risk Analyst & Workload Balancer.json
│   │   ├── AI - Sync Bidireccional Activa.json
│   │   └── Construir Contexto Robusto.json
│   ├── 2. ⚙️ Core System/
│   │   ├── Router - Project Events.json
│   │   ├── System - AI Decision Logger.json
│   │   ├── System - Audit Logger.json
│   │   ├── System - Config Resolver.json
│   │   ├── System - DB Seeder (estado_conocido).json
│   │   └── Monitor PetSafe - Error Handler.json
│   ├── 3. 💬 Communication & Events/
│   │   ├── Chat Discord PetSafe.json
│   │   ├── Discord Eventos GitHub PetSafe.json
│   │   ├── Discord Eventos Trello PetSafe.json
│   │   └── Executor - Discord Outbox.json
│   ├── 4. 🛠️ Monitoring & Reliability/
│   │   ├── Monitor PetSafe.json
│   │   ├── Monitor PetSafe - Alertas IA.json
│   │   ├── Monitor - Outbox DLQ.json
│   │   └── DLQ - Outbox Replay.json
│   ├── 5. 📊 PMO & Reporting/
│   │   ├── Reporte PDF Semanal.json
│   │   ├── Dashboard - PM Approval Hub.json
│   │   ├── Trello - Gestion de Fases.json
│   │   └── Trello - Sync Attachments.json
│   ├── ARQUITECTURA_PM_AI_PETSAFE.md
│   ├── FUNCIONALIDADES_Y_PRUEBAS.md
│   ├── PM_AI_ROADMAP_FUNCIONALIDADES.md
│   ├── TEST_PLAN_PM_AI.md
│   └── README.md
├── bot-bridge/
│   ├── index.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── init.sql
├── .env
└── .env.example
```

### 9.3 Módulos principales

| Módulo | Workflows | Responsabilidad |
|---|---|---|
| **AI Intelligence** | 7 workflows | Análisis inteligente de eventos, revisión de código, evaluación de riesgos, decisiones de release y sincronización bidireccional |
| **Core System** | 6 workflows | Ruteo de eventos, logging de decisiones IA, auditoría, configuración centralizada, seed de datos y manejo global de errores |
| **Communication** | 4 workflows | Recepción y despacho de mensajes Discord, ingesta de eventos GitHub/Trello y ejecución del outbox |
| **Monitoring** | 4 workflows | Monitoreo programado, alertas IA, vigilancia de DLQ y replay de mensajes fallidos |
| **PMO & Reporting** | 4+ workflows | Reportes PDF ejecutivos, dashboard de aprobaciones, gestión de fases Trello y sincronización de adjuntos |

### 9.4 Flujo de datos

1. **Ingesta:** Eventos externos (GitHub push, Trello card move, mensaje Discord) entran al sistema a través de triggers nativos o el bot-bridge.
2. **Normalización:** Los eventos se normalizan a un formato canónico y se insertan en `events_inbox` con idempotencia (`ON CONFLICT DO NOTHING`).
3. **Ruteo:** El `Router - Project Events` lee eventos pendientes y los distribuye al agente IA correspondiente mediante el `PM Orchestrator`.
4. **Análisis:** El agente especializado analiza el evento con contexto de Gemini y genera una decisión que se registra en `ai_decisions`.
5. **Ejecución:** Las acciones resultantes se encolan en `events_outbox` y son ejecutadas por el `Executor - Discord Outbox`.
6. **Notificación:** Los resultados se comunican al equipo vía Discord (mensajes, embeds, archivos adjuntos).

### 9.5 Dependencias principales

| Dependencia | Propósito |
|---|---|
| n8n (self-hosted) | Motor de orquestación de workflows |
| PostgreSQL 17 + pgvector | Persistencia de datos, eventos, decisiones y auditoría |
| Redis | Caché de KPIs, deduplicación, memoria conversacional |
| Gotenberg | Generación de PDFs desde HTML |
| discord.js (bot-bridge) | Librería para interacción con la API de Discord |
| Google Gemini 2.5 Pro | Modelo de IA para análisis y generación de texto |
| LangChain (n8n) | Framework de agentes con herramientas |

### 9.6 Servicios externos

#### GitHub API
- **Propósito:** Obtener commits, PRs, diffs, status de CI/CD y branches.
- **Endpoints:** `/repos/{owner}/{repo}/commits`, `/repos/{owner}/{repo}/pulls`, `/repos/{owner}/{repo}/actions/runs`
- **Autenticación:** Bearer token vía `GITHUB_TOKEN`

#### Trello API
- **Propósito:** Leer tarjetas, listas, miembros, checklists y adjuntos del tablero del proyecto.
- **Endpoints:** `/boards/{id}/cards`, `/boards/{id}/lists`, `/boards/{id}/members`
- **Autenticación:** API Key + Token vía `TRELLO_API_KEY` y `TRELLO_TOKEN`

#### Google Gemini API
- **Propósito:** Análisis inteligente de código, generación de diagnósticos, resúmenes ejecutivos y decisiones PMO.
- **Modelo:** `gemini-2.5-pro`
- **Autenticación:** API Key vía `GEMINI_API_KEY`

#### Discord Webhooks
- **Propósito:** Envío de mensajes, embeds y archivos al canal del equipo.
- **Autenticación:** URL del webhook con token integrado

### 9.7 Base de datos

El sistema utiliza **PostgreSQL 17 con la extensión pgvector** como base de datos operacional. Las tablas principales son:

| Tabla | Propósito |
|---|---|
| `analisis_proyecto` | Snapshots periódicos del análisis del proyecto con KPIs, progreso y recomendaciones IA |
| `estado_tareas` | Estado actual de cada tarjeta de Trello con asignado, fechas y progreso |
| `events_inbox` | Cola canónica de eventos entrantes con idempotencia y correlation_id |
| `events_outbox` | Cola de acciones pendientes de ejecución (notificaciones Discord) |
| `ai_decisions` | Registro de cada decisión tomada por la IA con confianza, riesgo y estado de aprobación |
| `workflow_runs_audit` | Auditoría de ejecuciones de workflows con resultado y duración |
| `recomendaciones` | Historial de preguntas y respuestas del chat con contexto |
| `eventos_detectados` | Registro de eventos GitHub/Trello procesados |
| `project_phases` | Fases del proyecto sincronizadas desde Trello |
| `pmo_calendar` | Calendario interno de reuniones PMO |

### 9.8 Manejo de errores

El sistema implementa un manejo de errores en tres niveles:

1. **Error Handler global:** El workflow `Monitor PetSafe - Error Handler` está configurado como `errorWorkflow` en todos los workflows críticos. Captura errores de ejecución y envía una notificación a Discord con detalles del fallo.
2. **DLQ (Dead Letter Queue):** Los mensajes que fallan después de 5 reintentos en el `events_outbox` se marcan como `dead`. El `Monitor - Outbox DLQ` vigila estos registros y alerta al equipo.
3. **Replay automático:** El workflow `DLQ - Outbox Replay` permite reintentar mensajes fallidos de forma controlada.

### 9.9 Logs y auditoría

- **`workflow_runs_audit`:** Registra cada ejecución de workflow con timestamp, resultado (success/error), duración y correlation_id.
- **`ai_decisions`:** Registra cada evaluación y decisión de la IA con input_summary, decision, recommendation, confidence y risk_level.
- **Logs de n8n:** Disponibles mediante `docker compose logs -f n8n`.
- **Discord:** Las alertas y notificaciones del bot quedan registradas en el canal de Discord como historial consultable.

### 9.10 Seguridad

| Control | Implementación |
|---|---|
| Credenciales | Almacenadas exclusivamente en variables de entorno (`.env`), nunca en el código |
| Cifrado n8n | `N8N_ENCRYPTION_KEY` obligatorio para proteger credenciales almacenadas en n8n |
| Aislamiento de red | PostgreSQL y Gotenberg publicados solo en loopback (`127.0.0.1`) |
| Autenticación n8n | Basic Auth con usuario y contraseña configurables |
| Dashboard seguro | Token `PM_APPROVAL_SECRET` requerido para aprobar decisiones IA |
| Tokens rotativos | GitHub, Trello y Gemini API keys configurables sin modificar código |
| Validación SQL | Migración progresiva a `queryReplacement` parametrizado para prevenir SQL injection |
| `.env.example` | Plantilla sin credenciales reales versionada en el repositorio |

---

## X. DOCUMENTACIÓN DE API E INTEGRACIONES

### Servicio: GitHub REST API

**Propósito:** Obtener actividad de código (commits, Pull Requests, CI status) de los repositorios backend y frontend.

**Endpoints utilizados:**

| Endpoint | Método | Propósito |
|---|---|---|
| `/repos/{owner}/{repo}/commits` | GET | Obtener commits recientes con filtro por fecha |
| `/repos/{owner}/{repo}/pulls` | GET | Listar PRs abiertos/cerrados/mergeados |
| `/repos/{owner}/{repo}/actions/runs` | GET | Estado de CI/CD |
| `/repos/{owner}/{repo}/commits/{sha}` | GET | Detalle de commit con diff |

**Headers requeridos:**
```
Authorization: Bearer {GITHUB_TOKEN}
Accept: application/vnd.github+json
```

**Respuesta esperada (commits):**
```json
[
  {
    "sha": "abc1234...",
    "commit": {
      "author": { "name": "David", "date": "2026-05-18T10:00:00Z" },
      "message": "feat(auth): add JWT refresh token"
    },
    "html_url": "https://github.com/org/repo/commit/abc1234"
  }
]
```

**Errores posibles:**

| Código | Causa | Solución |
|---|---|---|
| 401 | Token inválido o expirado | Regenerar token en GitHub Settings |
| 403 | Token sin permisos sobre el repositorio | Agregar permisos de lectura al token |
| 404 | Repositorio no encontrado | Verificar owner y nombre del repo en `.env` |

### Servicio: Trello REST API

**Propósito:** Leer el estado del tablero de tareas del proyecto (tarjetas, listas, miembros, checklists).

**Endpoints utilizados:**

| Endpoint | Método | Propósito |
|---|---|---|
| `/boards/{id}/cards` | GET | Listar todas las tarjetas del tablero |
| `/boards/{id}/lists` | GET | Obtener listas/columnas del tablero |
| `/boards/{id}/members` | GET | Miembros del equipo |
| `/cards/{id}/checklists` | GET | Checklists de una tarjeta específica |

**Parámetros de autenticación:**
```
?key={TRELLO_API_KEY}&token={TRELLO_TOKEN}
```

**Errores posibles:**

| Código | Causa | Solución |
|---|---|---|
| 401 | Token inválido o expirado | Regenerar token en Trello Developer |
| 404 | Board ID incorrecto | Verificar `TRELLO_BOARD_ID` en `.env` |

### Servicio: Google Gemini API

**Propósito:** Análisis inteligente de código, generación de diagnósticos y resúmenes ejecutivos.

**Integración:** Se utiliza a través de los nodos nativos de n8n (LangChain + Google Gemini Chat Model) en la mayoría de los workflows. En el reporte semanal se utiliza el modo JSON para obtener respuestas estructuradas.

**Errores posibles:**

| Código | Causa | Solución |
|---|---|---|
| 429 | Cuota de requests agotada | Esperar reset de cuota o upgrader plan |
| 400 | Prompt demasiado largo | Reducir contexto enviado al modelo |

---

## XI. PRUEBAS

### 11.1 Cómo ejecutar las pruebas

Las pruebas se ejecutan directamente desde la interfaz de n8n:

1. Abrir el workflow a probar en el editor de n8n.
2. Hacer clic en **Execute Workflow** para disparar la ejecución manual.
3. Para pruebas del chat, enviar el payload JSON al webhook configurado.

### 11.2 Casos de prueba principales

| ID | Caso de prueba | Entrada | Resultado esperado | Estado |
|---|---|---|---|---|
| CP-001 | Chat: comando ayuda | `!ayuda` | Lista completa de comandos | ✅ Correcto |
| CP-002 | Chat: estado del proyecto | `!estado` | Resumen con progreso, tareas y vencidas | ✅ Correcto |
| CP-003 | Chat: generar reporte | `!reporte 15` | PDF adjunto en Discord | ✅ Correcto |
| CP-004 | Chat: consulta libre | `¿cómo vamos?` | Respuesta IA con contexto real | ✅ Correcto |
| CP-005 | Monitor: ejecución programada | Schedule trigger | KPIs calculados, snapshot guardado | ✅ Correcto |
| CP-006 | Monitor: detección de alerta | Problema detectado | Diagnóstico IA + alerta Discord | ✅ Correcto |
| CP-007 | Evento GitHub: push | Push a repositorio | Evento en inbox + notificación Discord | ✅ Correcto |
| CP-008 | Evento Trello: mover tarjeta | Card moved | Evento normalizado + notificación | ✅ Correcto |
| CP-009 | Reporte PDF semanal | On-demand trigger | PDF con resumen ejecutivo y análisis técnico | ✅ Correcto |
| CP-010 | Dashboard: aprobar decisión | POST con token válido | Estado actualizado + notificación Discord | ✅ Correcto |
| CP-011 | DLQ: fallo de envío | Webhook URL inválida | Reintentos + marcado como dead | ✅ Correcto |
| CP-012 | Chat: KPIs | `!kpis` | Indicadores de desempeño actualizados | ✅ Correcto |

### 11.3 Pruebas manuales realizadas

- Verificación de cada comando Discord con payloads reales.
- Generación de PDFs on-demand y validación del contenido HTML renderizado.
- Simulación de fallos de red para validar el comportamiento del DLQ.
- Inyección de decisiones con `requires_human_approval = true` y aprobación desde el dashboard.
- Validación de idempotencia en `events_inbox` con eventos duplicados.

---

## XII. DESPLIEGUE

### 12.1 Plataforma usada

El sistema está desplegado en un **VPS (Virtual Private Server)** utilizando **Docker Compose** para orquestar los cinco servicios principales.

### 12.2 Variables necesarias

Todas las variables del archivo `.env` son requeridas para el despliegue. Ver sección de Configuración para la lista completa.

### 12.3 Comando de inicio

```bash
docker compose up -d
```

### 12.4 Webhooks

El bot utiliza webhooks para:
- **Recepción de chat:** `POST /webhook/discord-chat` (bot-bridge → n8n)
- **Dashboard de aprobaciones:** `GET /webhook/pm-approvals` (navegador → n8n)
- **Dashboard de logs:** `GET /webhook/pm-logs` (navegador → n8n)
- **GitHub Triggers:** Configurados nativamente en n8n (no requieren webhook manual)
- **Trello Triggers:** Configurados nativamente en n8n (no requieren webhook manual)

### 12.5 Reinicio automático

Todos los servicios están configurados con `restart: unless-stopped` en Docker Compose, lo que garantiza reinicio automático ante caídas inesperadas o reinicios del servidor.

### 12.6 Monitoreo

- **Healthchecks:** Configurados en Docker Compose para PostgreSQL y Redis.
- **Error Handler:** Workflow dedicado que notifica fallos en Discord.
- **Comando `!logs`:** Permite consultar la salud del bot desde Discord.
- **Logs Docker:** `docker compose logs -f [servicio]`

---

## XIII. MANTENIMIENTO

### 13.1 Cómo agregar nuevos comandos

1. Abrir el workflow `Chat Discord PetSafe` en n8n.
2. En el nodo `Switch` de comandos, agregar un nuevo case con el patrón del comando.
3. Conectar a un nuevo nodo `Code` o `HTTP Request` con la lógica del comando.
4. Conectar la salida al nodo de respuesta Discord.
5. Actualizar la documentación de comandos.

### 13.2 Cómo agregar nuevos agentes IA

1. Crear un nuevo workflow con el prefijo `AI -`.
2. Configurar un nodo de entrada que reciba el evento del Router.
3. Implementar la lógica de análisis con un nodo Gemini.
4. Registrar la decisión en `ai_decisions` mediante el `AI Decision Logger`.
5. Encolar acciones en `events_outbox` si se requiere notificación.
6. Registrar el nuevo agente en el `PM Orchestrator` para que el Router lo conozca.

### 13.3 Errores comunes

| Error | Posible causa | Solución |
|---|---|---|
| `Authorization failed` en GitHub | Token incorrecto o expirado | Regenerar token y actualizar `.env` |
| `429 Too Many Requests` en Gemini | Cuota agotada | Esperar reset o verificar plan |
| `there is no parameter $1` en Postgres | Query parametrizada mal configurada | Verificar `queryReplacement` en el nodo |
| Respuestas vacías en chat | Credencial Gemini inválida o nodos previos fallando | Verificar API key y ejecución de nodos upstream |
| Dos PDFs generados | Nodos de PR conectados al Merge | Verificar que PRs se lean con `$('NodeName').all()` |

### 13.4 Convenciones

- Nombres de workflows: `[Módulo] - [Nombre descriptivo]` (ej. `AI - Code Review Scout`)
- Nombres de nodos: descriptivos y en español cuando corresponda
- Variables de entorno: `SCREAMING_SNAKE_CASE`
- Documentación: Markdown con estructura jerárquica

---

## XIV. CONCLUSIONES

El desarrollo del Bot Project Manager AI PetSafe demostró que es factible construir un sistema de gestión de proyectos inteligente utilizando herramientas de automatización (n8n) combinadas con modelos de IA generativa (Gemini). Los principales resultados obtenidos fueron:

1. **Centralización efectiva:** El equipo pasó de consultar manualmente tres herramientas distintas a obtener información consolidada del proyecto mediante comandos simples en Discord.
2. **Automatización de reportes:** La generación de reportes ejecutivos que antes tomaba horas de trabajo manual ahora se produce automáticamente cada semana con análisis técnico detallado.
3. **Detección proactiva de riesgos:** El sistema identifica cuellos de botella, tareas envejecidas y deuda técnica antes de que impacten el cronograma.
4. **Gobernanza con IA:** La implementación del patrón Human-in-the-Loop garantiza que las decisiones críticas de la IA sean supervisadas por el equipo antes de ejecutarse.
5. **Arquitectura escalable:** La organización en cinco módulos funcionales con patrón event-driven permite agregar nuevas capacidades sin modificar los flujos existentes.

El principal aprendizaje técnico fue la importancia de diseñar una arquitectura event-driven desde el inicio, ya que los patrones de ingesta, normalización y ruteo de eventos son la base que permite escalar el sistema con nuevos agentes y capacidades de forma modular.

---

## XV. RECOMENDACIONES

1. **Migrar bot-bridge a Discord.js v14 con slash commands:** Reemplazar el puente HTTP actual por un bot nativo de Discord con comandos registrados, lo que mejoraría la experiencia de usuario con autocompletado y validación de parámetros.
2. **Implementar métricas DORA:** Agregar cálculo automático de Deployment Frequency, Lead Time for Changes, Mean Time to Recovery y Change Failure Rate.
3. **Externalizar secretos:** Migrar de variables de entorno a un vault externo (HashiCorp Vault, AWS Secrets Manager) para gestión centralizada de credenciales.
4. **Agregar pruebas automatizadas:** Implementar tests unitarios para los nodos `Code` más complejos y tests de integración para los flujos críticos.
5. **Migrar SQL a queryReplacement completo:** Completar la migración de todas las queries con interpolación de texto a parámetros seguros.
6. **Implementar rate limiting en el chat:** Agregar control de frecuencia de mensajes para evitar abuso del bot y consumo excesivo de la API de Gemini.
7. **Dashboard de métricas operativas:** Desarrollar un panel web con métricas en tiempo real del sistema (throughput, latencia, errores, health score).

---

## XVI. FIRMAS DE RESPONSABILIDAD

| Integrante | Responsabilidad | Firma |
|---|---|---|
| Bonilla Guerrero Fernando Joel | Gestor del proyecto y consolidación documental | [Firma] |
| Barragán Pozo David Josué | Desarrollo full stack y revisión técnica | [Firma] |
| García Abata Josué Joel | Desarrollo frontend e interfaces | [Firma] |
| Manjarres Quinteros David Oswaldo | Desarrollo backend y servicios | [Firma] |

---

## XVII. CONTROL DE CAMBIOS

| Versión | Descripción del cambio | Responsable | Fecha |
|---|---|---|---|
| 1.0 | Creación de la primera versión del informe de desarrollo del Bot PM AI PetSafe. Incluye arquitectura, módulos, funcionalidades, pruebas, despliegue, seguridad, integraciones y recomendaciones. | Equipo PetSafe | 19/05/2026 |
