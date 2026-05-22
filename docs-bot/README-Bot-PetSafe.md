# 🐾 PetSafe — Project Manager AI Bot

**Bot de gestión de proyectos impulsado por inteligencia artificial para el equipo PetSafe.**

Un sistema de orquestación inteligente construido sobre n8n que actúa como Project Manager autónomo del proyecto PetSafe, integrando Discord, GitHub, Trello y PostgreSQL para ofrecer monitoreo continuo, análisis de código, gestión de riesgos, reportes ejecutivos y toma de decisiones asistida por IA.

---

## 📋 Tabla de Contenidos

1. [Descripción](#descripción)
2. [Objetivo](#objetivo)
3. [Tecnologías Usadas](#tecnologías-usadas)
4. [Funcionalidades Principales](#funcionalidades-principales)
5. [Requisitos Previos](#requisitos-previos)
6. [Instalación](#instalación)
7. [Configuración](#configuración)
8. [Ejecución](#ejecución)
9. [Ejemplos de Uso](#ejemplos-de-uso)
10. [Capturas](#capturas)
11. [Estado del Proyecto](#estado-del-proyecto)
12. [Equipo](#equipo)

---

## Descripción

PetSafe PM AI es un sistema de automatización y orquestación inteligente que funciona como un Project Manager virtual para el proyecto PetSafe (plataforma digital de gestión clínica veterinaria). El bot opera mediante **25+ workflows de n8n** organizados en cinco módulos funcionales, integrando múltiples fuentes de datos del proyecto (GitHub, Trello, PostgreSQL) y canales de comunicación (Discord) para ofrecer una gestión de proyecto proactiva, basada en datos y asistida por inteligencia artificial (Google Gemini).

El sistema no se limita a responder consultas: detecta eventos en tiempo real, analiza riesgos, revisa código automáticamente, genera reportes PDF ejecutivos, gestiona un calendario PMO interno y requiere aprobación humana para decisiones críticas mediante un dashboard web dedicado.

---

## Objetivo

El bot PetSafe PM AI busca resolver la **brecha de visibilidad y coordinación** que existe en equipos de desarrollo distribuidos. En proyectos académicos y profesionales, la información del estado real del proyecto suele estar fragmentada entre múltiples herramientas (tableros Trello, repositorios GitHub, canales de chat) y la consolidación de esta información recae manualmente sobre el gestor del proyecto.

**Valor que aporta:**

- **Monitoreo continuo y automático** del estado del proyecto mediante KPIs calculados en tiempo real.
- **Análisis inteligente de código** que revisa Pull Requests y detecta riesgos técnicos de forma autónoma.
- **Reportes ejecutivos generados por IA** que consolidan progreso, commits, PRs, deuda técnica y recomendaciones en un PDF profesional.
- **Gestión proactiva de riesgos** con detección de cuellos de botella, tareas envejecidas y carga de trabajo desbalanceada.
- **Gobernanza con supervisión humana** (*Human-in-the-Loop*) para decisiones críticas, evitando que la IA actúe sin control en escenarios de alto riesgo.

---

## Tecnologías Usadas

### Plataforma de orquestación
| Tecnología | Versión | Propósito |
|---|---|---|
| **n8n** | Self-hosted (Docker) | Motor de workflows y orquestación de automatizaciones |
| **Node.js** | 18+ | Runtime del bot-bridge Discord → n8n |

### Base de datos y caché
| Tecnología | Propósito |
|---|---|
| **PostgreSQL + pgvector** | Base de datos operacional: eventos, análisis, decisiones IA, auditoría, calendario PMO |
| **Redis** | Caché de KPIs, deduplicación de mensajes, memoria conversacional del chat |

### Inteligencia artificial
| Tecnología | Propósito |
|---|---|
| **Google Gemini 2.5 Pro** | Modelo de lenguaje para análisis de código, diagnósticos, resúmenes ejecutivos y decisiones PMO |
| **LangChain (n8n nativo)** | Cadena de razonamiento para el agente conversacional con herramientas |

### Integraciones externas
| Servicio | Propósito |
|---|---|
| **Discord** (Webhooks + bot-bridge) | Canal principal de comunicación bidireccional con el equipo |
| **GitHub** (API REST + Triggers nativos) | Commits, Pull Requests, CI/CD status, diffs de código |
| **Trello** (API REST + Triggers nativos) | Tablero de tareas, fases del proyecto, checklists y adjuntos |
| **Gotenberg** | Conversión HTML → PDF para reportes ejecutivos |

### Infraestructura
| Componente | Propósito |
|---|---|
| **Docker / Docker Compose** | Contenerización y despliegue de todos los servicios |
| **bot-bridge** (Node.js) | Puente que escucha eventos de Discord y los reenvía al webhook n8n |

---

## Funcionalidades Principales

### 🧠 1. Agentes IA Especializados
- **PM Orchestrator:** Cerebro central que recibe eventos y decide qué agente debe actuar.
- **Code Review Scout:** Analiza diffs de Pull Requests y genera revisiones automáticas de seguridad, convenciones y calidad.
- **Context Guardian:** Mantiene memoria de las reglas de arquitectura y convenciones del equipo.
- **Risk Analyst & Workload Balancer:** Detecta cuellos de botella, *Aging WIP* y desbalance de carga de trabajo.
- **Release Guard:** Evaluación pre-deploy que bloquea o aprueba releases según el estado del proyecto.
- **Sync Bidireccional:** Sincroniza merges de GitHub con tarjetas de Trello automáticamente.

### 💬 2. Chat Discord Interactivo
- Interfaz conversacional que permite al equipo consultar el estado del proyecto en lenguaje natural.
- **15+ comandos** disponibles: `!estado`, `!kpis`, `!reporte`, `!riesgos`, `!hitos`, `!commits`, `!ci`, `!vencidas`, `!miembros`, `!progreso`, `!fase`, `!doc`, `!acciones`, `!raid`, `!logs`, `!agenda`, `!reunion`.
- Respuestas enriquecidas generadas por Gemini con contexto real del proyecto.

### 📊 3. Reportes PDF Ejecutivos
- Generación semanal automática (viernes 18:00) y on-demand desde Discord (`!reporte [días]`).
- Contenido: resumen ejecutivo, KPIs, progreso, logros, riesgos, análisis técnico de commits/PRs, deuda técnica, participantes destacados, hitos y cierre formal.
- Envío automático por Discord y correo electrónico SMTP.

### 🛠️ 4. Monitoreo y Alertas IA
- Monitoreo programado que calcula KPIs, tendencias y severidad del proyecto.
- Alertas inteligentes en Discord cuando se detectan problemas, con diagnóstico generado por Gemini.
- Sistema de Dead Letter Queue (DLQ) para mensajes fallidos con replay automático.

### 📋 5. Gestión PMO
- Dashboard web de aprobaciones humanas para decisiones bloqueadas por la IA.
- Calendario PMO interno sin dependencias externas (Google/Outlook).
- Motor de gobierno diario con RAID (Risks, Actions, Issues, Dependencies) y health score.
- Gestión de fases del tablero Trello con cálculo de completitud.

### ⚙️ 6. Sistema de Eventos
- Arquitectura event-driven con tabla canónica `events_inbox` e `events_outbox`.
- Ingesta idempotente de eventos GitHub y Trello con `correlation_id`.
- Router de eventos que distribuye hacia agentes especializados.
- Auditoría completa de ejecuciones y decisiones IA.

---

## Requisitos Previos

Antes de instalar y ejecutar el proyecto, asegúrese de contar con:

### Software requerido
- **Docker** v20.10+ y **Docker Compose** v2.0+
- **Git** para clonar el repositorio
- **Node.js** v18+ (solo si se ejecuta `bot-bridge` fuera de Docker)

### Cuentas y credenciales externas
- **Discord:** Bot token y webhook URL del canal de destino.
- **GitHub:** Token de acceso personal con permisos de lectura sobre los repositorios backend y frontend.
- **Trello:** API Key y Token con acceso al tablero del proyecto.
- **Google Gemini:** API Key del servicio Generative AI.
- **SMTP** (opcional): Credenciales de correo para envío de reportes por email.

### Acceso a APIs
- API REST de GitHub (repos, commits, PRs, Actions)
- API REST de Trello (boards, cards, lists, members, checklists)
- API de Google Generative Language (Gemini)

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/[org]/petsafe-pm-bot.git
cd petsafe-pm-bot
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con las credenciales reales
nano .env
```

### 3. Iniciar los servicios con Docker Compose

```bash
docker compose up -d
```

Esto levantará los siguientes contenedores:
- `n8n` — Motor de workflows (puerto 5678)
- `agente_db` — PostgreSQL con pgvector
- `redis` — Caché y memoria conversacional
- `gotenberg` — Servicio de generación PDF
- `bot-bridge` — Puente Discord → n8n

### 4. Importar workflows en n8n

1. Acceder a `http://localhost:5678` (o la URL configurada).
2. Importar los archivos `.json` desde la carpeta `bot/` en el siguiente orden:
   - Primero: workflows hijos/soporte (Error Handler, Decision Logger, Config Resolver).
   - Después: workflows principales (Chat Discord, Monitor, Router).
   - Finalmente: dashboards y reportes.
3. Activar los workflows con triggers/schedules.

### 5. Inicializar la base de datos

La base de datos se inicializa automáticamente mediante el archivo `init.sql` montado en Docker Compose. Si se requiere re-ejecutar:

```bash
docker exec -i agente_db psql -U postgres -d agente_pm < init.sql
```

---

## Configuración

### Variables de Entorno (`.env.example`)

```env
# ── n8n
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=cambiar_por_password_seguro
N8N_ENCRYPTION_KEY=clave_de_cifrado_segura_generada
N8N_HOST=n8n-bot.example.com
N8N_PROTOCOL=https

# ── PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=cambiar_por_password_seguro
POSTGRES_DB=agente_pm

# ── GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER_BACKEND=nombre-organizacion
GITHUB_REPO_BACKEND=PetSafe-Back
GITHUB_OWNER_FRONTEND=nombre-organizacion
GITHUB_REPO_FRONTEND=PetSafe-Front

# ── Trello
TRELLO_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TRELLO_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TRELLO_BOARD_ID=xxxxxxxxxxxxxxxxxxxxxxxx

# ── Discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxxx/xxxx
DISCORD_BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Google Gemini
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── SMTP (opcional)
SMTP_FROM_NAME=SafePet Administración
SMTP_FROM_EMAIL=noreply@example.com

# ── Gotenberg
GOTENBERG_URL=http://gotenberg:3000

# ── Seguridad
PM_APPROVAL_SECRET=token_secreto_para_dashboard
```

> ⚠️ **IMPORTANTE:** Nunca suba el archivo `.env` al repositorio. Utilice `.env.example` como plantilla.

### Configuración de Docker

El archivo `docker-compose.yml` orquesta cinco servicios principales con redes internas aisladas, healthchecks y políticas de reinicio automático. PostgreSQL y Gotenberg se publican únicamente en loopback por seguridad. n8n se configura para usar PostgreSQL como base de datos propia con schema dedicado `n8n`.

---

## Ejecución

### Iniciar todos los servicios

```bash
docker compose up -d
```

### Verificar estado de los contenedores

```bash
docker compose ps
```

### Ver logs de un servicio específico

```bash
docker compose logs -f n8n
docker compose logs -f bot-bridge
```

### Reiniciar un servicio

```bash
docker compose restart n8n
```

### Detener todos los servicios

```bash
docker compose down
```

---

## Ejemplos de Uso

### Comandos Discord

| Comando | Descripción | Ejemplo de respuesta |
|---|---|---|
| `!ayuda` | Lista todos los comandos disponibles | Menú con descripción de cada comando |
| `!estado` | Resumen rápido del proyecto | `Progreso: 71% · 3 vencidas · 45 tareas` |
| `!kpis` | Indicadores clave del periodo | Velocidad, % a tiempo, commits/día, PR merge ratio |
| `!reporte 15` | Genera PDF de los últimos 15 días | PDF adjunto + resumen en Discord |
| `!riesgos` | Lista riesgos activos | RAID actualizado con severidad |
| `!hitos` | Próximos hitos del proyecto | Tabla con fechas y responsables |
| `!commits` | Actividad reciente de código | Últimos commits backend/frontend |
| `!ci` | Estado del CI/CD | Último run de GitHub Actions |
| `!vencidas` | Tareas vencidas sin completar | Lista con responsable y días de atraso |
| `!progreso` | Porcentaje de avance general | Barra visual de progreso |
| `!fase listar` | Fases del tablero Trello | Completitud por columna |

### Consulta en lenguaje natural

```
Usuario: ¿Cómo vamos con el proyecto?
Bot: 📊 El proyecto PetSafe se encuentra al 71% de progreso general.
     En los últimos 7 días se registraron 23 commits (15 backend, 8 frontend)
     y 5 PRs mergeados. Hay 3 tareas vencidas pendientes de atención...
```

---

## Capturas

> [Completar con capturas reales del sistema en funcionamiento]

```
![Chat Discord del bot](docs/assets/captura-chat-discord.png)
![Reporte PDF generado](docs/assets/captura-reporte-pdf.png)
![Dashboard de aprobaciones](docs/assets/captura-dashboard-approvals.png)
![Monitor de alertas IA](docs/assets/captura-alertas-ia.png)
```

---

## Estado del Proyecto

🟢 **En producción activa.**

El sistema se encuentra desplegado en un VPS y opera de forma autónoma, procesando eventos de GitHub y Trello, respondiendo consultas vía Discord y generando reportes semanales automáticos. Las funcionalidades de los agentes IA especializados están implementadas y operativas.

---

## Equipo

Proyecto desarrollado por el **Equipo PetSafe**:

| Integrante | Rol |
|---|---|
| Bonilla Guerrero Fernando Joel | Gestor del Proyecto y consolidación documental |
| Barragán Pozo David Josué | Desarrollador Full Stack y revisión técnica |
| García Abata Josué Joel | Desarrollador Frontend e interfaces |
| Manjarres Quinteros David Oswaldo | Desarrollador Backend y servicios |

---

## Licencia

[Completar con la licencia aplicable al proyecto]

---

## Documentación Adicional

- 📐 [Arquitectura PM AI PetSafe](bot/ARQUITECTURA_PM_AI_PETSAFE.md)
- 🗺️ [Roadmap de Funcionalidades](bot/PM_AI_ROADMAP_FUNCIONALIDADES.md)
- 🧪 [Plan de Pruebas](bot/TEST_PLAN_PM_AI.md)
- 📝 [Funcionalidades y Pruebas](bot/FUNCIONALIDADES_Y_PRUEBAS.md)
