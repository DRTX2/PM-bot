# 🔍 Workflow 1 — Monitor PetSafe (cada 30 min)

Este documento explica **a detalle** el flujo definido en `workflow1_monitor.json`.

## 1) Objetivo del workflow
Ejecutar un **monitoreo automático** del proyecto PetSafe cada 30 minutos para:

- Leer el estado real de Trello (tareas, responsables, fechas, adjuntos, checklists).
- Leer señales de GitHub (commits, PRs, CI runs) para backend y frontend.
- Calcular **KPIs** y detectar **problemas/riesgos**.
- Guardar un snapshot en Postgres (`analisis_proyecto` + `estado_tareas`).
- Si hay problemas, generar un diagnóstico con **Gemini** y enviar una **alerta a Discord**.

En pocas palabras: es el “motor” que produce la tabla `analisis_proyecto` que luego consumen los otros workflows (por ejemplo KPIs del Workflow 2 y reporte del Workflow 4).

## 2) Trigger (schedule)
**Nodo:** `Schedule Trigger` (`scheduleTrigger`)

- Intervalo: cada **30 minutos**.

## 3) Configuración central (Set)
**Nodo:** `Configuración` (`set`)

Prepara variables de entorno para usar en el resto del workflow.

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

**IA + Alertas**
- `GEMINI_API_KEY`
- `DISCORD_WEBHOOK_URL`

## 4) Recolección de datos (12 fuentes en paralelo)
Desde `Configuración`, el workflow dispara **12 nodos** en paralelo que luego se unen en un merge.

### 4.1 Trello (4 requests)
1) **Nodo:** `Trello Cards`
- `GET /1/boards/{boardId}/cards`
- fields: `name,desc,due,dueComplete,idMembers,idList,dateLastActivity,labels`
- attachments: `true`
- attachment_fields: `name,url,mimeType,isUpload,date`

2) **Nodo:** `Trello Lists`
- `GET /1/boards/{boardId}/lists`

3) **Nodo:** `Trello Members`
- `GET /1/boards/{boardId}/members`
- fields: `fullName,username`

4) **Nodo:** `Trello Checklists`
- `GET /1/boards/{boardId}/checklists`
- fields: `name,idCard`
- checkItem_fields: `name,state,due`

### 4.2 GitHub (6 requests)
Se consulta backend y frontend por separado.

5) **Nodo:** `GitHub Back Commits`
- `GET /repos/{owner_back}/{repo_back}/commits?per_page=30`

6) **Nodo:** `GitHub Front Commits`
- `GET /repos/{owner_front}/{repo_front}/commits?per_page=30`

7) **Nodo:** `GitHub Back PRs`
- `GET /repos/{owner_back}/{repo_back}/pulls?state=all&per_page=20`

8) **Nodo:** `GitHub Front PRs`
- `GET /repos/{owner_front}/{repo_front}/pulls?state=all&per_page=20`

9) **Nodo:** `GitHub Back CI Runs`
- `GET /repos/{owner_back}/{repo_back}/actions/runs?per_page=5`

10) **Nodo:** `GitHub Front CI Runs`
- `GET /repos/{owner_front}/{repo_front}/actions/runs?per_page=5`

Todos los requests agregan headers:
- `Authorization: Bearer <token>`
- `Accept: application/vnd.github+json`
- `User-Agent: n8n-agent`

### 4.3 Postgres (2 queries)
11) **Nodo:** `Postgres Historial`
- Lee los últimos 10 registros de `analisis_proyecto`.

12) **Nodo:** `Postgres Hitos`
- Lee todos los hitos ordenados por fecha fin (`hitos_proyecto`).

**Credencial Postgres:** placeholder `POSTGRES_CREDENTIAL_ID`.

## 5) Unión de datos (Merge)
**Nodo:** `Merge Datos` (`merge`)

- mode: `append`
- numberInputs: `12`

Esto crea un stream “heterogéneo” con mezcla de:
- cards, lists, members, checklists
- commits, PRs, CI runs
- historial de análisis previos
- hitos

## 6) Cálculo principal: Análisis + KPIs (Code)
**Nodo:** `Análisis + KPIs` (`code`)

Este es el núcleo del workflow. A alto nivel:

### 6.1 Normalización de entidades
- Construye `listaById` (id → nombre de lista)
- Construye `miembroById` (id → nombre)
- Agrupa checklists por tarjeta (`checklistsByCard`)
- Resuelve mapeo de nombres a usuarios GitHub mediante un `MEMBER_MAP` (FG/DM/DP/JA)

### 6.2 Enriquecimiento de cada tarjeta
Por cada card de Trello calcula:
- vencida / completada / pendiente
- días restantes a due date
- responsables
- adjuntos: enlaces vs archivos subidos
- PDFs detectados
- progreso de checklist (`checklist_done/total`)
- días sin actividad y si es “stale” (>5 días)
- banderas: sin asignar, sin fecha

### 6.3 Agregación por fase (lista de Trello)
Agrupa tareas por `lista` y calcula por fase:
- total, completadas, pendientes, vencidas
- `pct` de completadas
- semáforo:
  - rojo si hay vencidas
  - verde si pct ≥ 80
  - amarillo si pct ≥ 40
  - gris si pct < 40

### 6.4 KPIs calculados
Entre los KPIs principales:
- `velocidad_tareas_por_dia` (completadas últimos 7 días / 7)
- `% a tiempo` (completadas con due date ≥ última actividad)
- `progreso_sprint_pct` (completadas/total)
- `commits_14d` y `commits_por_dia`
- `% commits convencionales` (feat/fix/etc)
- `bus_factor_14d` (autores distintos en commits 14d)
- silencio en días desde el último commit (back/front)
- `pr_open_time_dias` (promedio días abiertos de PRs open)
- `pr_merge_ratio_30d`
- `dias_hasta_fin` (si existe un hito tipo `entrega_final`)
- `proyeccion` (`on-track` / `riesgo` / `retrasado`)

### 6.5 Detección de problemas
Construye `problemas_detectados` con reglas simples, por ejemplo:
- tareas vencidas (alta)
- proyección retrasada/riesgo
- PRs “stale”
- baja actividad cerca de fecha fin
- CI roto (back/front)
- muchas cards stale
- bus factor bajo
- cards sin asignar

Produce también:
- `severidad_max` (alta/media/baja)
- `cantidad_problemas`

### 6.6 Salida
Devuelve un `json` con:
- resumen de tareas + snapshot completo (`snapshot_tareas`)
- `fases`, `ranking` (carga por persona), `hitos_proximos`
- bloque `github` (conteos, top commits, CI status, links)
- `kpis` y `problemas_detectados`
- `gemini_key` y `discord_url`

## 7) Persistencia en Postgres
### 7.1 Guardar análisis agregado
**Nodo:** `Guardar Análisis` (`postgres`)

Inserta en `analisis_proyecto`:
- `hay_problemas`, totales de tareas, progreso
- commits/prs abiertos (back/front)
- `problemas_detectados` como JSONB
- `severidad_maxima`, `cantidad_problemas`
- `kpis_json` como JSONB

Retorna `id` del análisis insertado.

### 7.2 Guardar snapshot por tarea
**Nodo:** `Guardar Snapshot Tareas` (`code`)

Convierte `snapshot_tareas` a filas para `estado_tareas` (una por tarjeta):
- analisis_id, card_id, card_nombre, lista_nombre
- miembro_id/nombre (toma el primer miembro si hay varios)
- fecha_vencimiento, completada
- adjuntos_count y flag `tiene_adjuntos`

**Nodo:** `Insert Snapshot` (`postgres`, operation `insert`)
- Inserta en `public.estado_tareas` con automapeo.

## 8) Rama de alertas: solo si hay problemas
**Nodo:** `IF Hay Problemas` (`if`)

- Condición: `{{$node['Análisis + KPIs'].json.hay_problemas}} == true`

Si **NO** hay problemas: termina (no manda Discord, no llama Gemini).

Si **SÍ** hay problemas:

### 8.1 Preparar prompt para Gemini
**Nodo:** `Preparar Prompt` (`code`)

Crea un prompt extenso con:
- estructura obligatoria: RESUMEN / POR FASE / CARGA EQUIPO / RIESGOS / ACCIONES / PROYECCIÓN
- incluye:
  - tareas por fase (con nombres)
  - cards problemáticas (stale/sin asignar/sin fecha)
  - top commits back/front
  - CI status y deploy
  - ranking por persona
  - entregables (archivos y links de Trello)
  - hitos próximos
  - problemas auto-detectados

> Nota: el prompt exige “SIN emojis”, pero el propio prompt y el payload de Discord usan emojis; esto no rompe el flujo, pero la regla no es consistente.

### 8.2 Llamar a Gemini
**Nodo:** `Gemini Análisis` (`httpRequest`)

- POST a: `.../models/gemini-2.5-flash:generateContent?key={{gemini_key}}`
- `temperature: 0.2`, `maxOutputTokens: 2048`

### 8.3 Construir mensaje para Discord
**Nodo:** `Build Discord Payload` (`code`)

- Extrae `ia_text` de Gemini.
- Construye un embed con:
  - resumen de progreso, proyección y diff vs análisis previo
  - tareas por fase (truncado a límites de Discord)
  - cards problemáticas
  - commits top 5
  - entregables recientes
  - KPIs
  - CI status
  - hitos próximos
  - diagnóstico IA truncado (~1000 chars)

### 8.4 Enviar a Discord
**Nodo:** `Discord Alerta` (`httpRequest`)

- POST a `DISCORD_WEBHOOK_URL`
- Body JSON: embed payload.

### 8.5 Guardar recomendación IA en Postgres
**Nodo:** `Guardar Recomendación IA` (`postgres`)

Actualiza el último registro de `analisis_proyecto`:
- `recomendaciones_ia = ia_text`

## 9) Dependencias necesarias
- Trello: API key/token y board ID.
- GitHub: tokens válidos y owners/repos.
- Postgres: credencial real en n8n (reemplazar `POSTGRES_CREDENTIAL_ID`).
- Discord: `DISCORD_WEBHOOK_URL` válido.
- Gemini: `GEMINI_API_KEY` válido.

## 10) Observaciones y posibles problemas del JSON
### 10.1 Nodo definido pero no conectado
Existe un nodo:
- `Analisis Impacto` (`analisis-impacto`)

pero **no aparece conectado en `connections`**, o sea:
- no se ejecuta nunca.

### 10.2 Filtro de PRs probablemente no matchea el shape real
En `Análisis + KPIs`, se intenta construir `allPRs` con:
- `items.filter(d => d && d.number && d.state && d.pull_request !== undefined)`

Pero el endpoint `GET /repos/{owner}/{repo}/pulls` normalmente retorna objetos de PR sin campo `pull_request` (ese campo aparece típicamente en objetos de *issues* cuando el issue es un PR).

Efecto posible:
- `allPRs` queda vacío → PR KPIs (open time, merge ratio, etc.) salen como 0 o sin señal real.

Si quieres, puedo aplicarte un patch mínimo para ajustar el filtro de PRs (sin cambiar el UX) y para conectar/eliminar `Analisis Impacto`.
