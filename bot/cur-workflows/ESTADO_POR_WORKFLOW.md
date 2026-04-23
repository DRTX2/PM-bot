# Estado Actual por Workflow

Este documento describe el estado real de cada workflow dentro de `bot/cur-workflows/`.

## 1) Chat Discord PetSafe

- Archivo: `Chat Discord PetSafe.json`
- ID: `ePBXQgBFS8BKvIPS`
- Activo: Si
- Entradas:
  - `POST /webhook/discord-chat`
  - `POST /webhook/trello-event`
  - `POST /webhook/github-event`

### Que hace hoy

1. Router de comandos (`!ayuda`, `!kpis`, `!reporte`, `!riesgos`, `!hitos`, `!revisar`).
2. Responde KPIs desde Postgres.
3. Construye contexto de proyecto y consulta Gemini para chat.
4. Guarda Q&A en `recomendaciones`.
5. Procesa eventos realtime de Trello/GitHub, notifica a Discord y guarda en `eventos_detectados`.

### Estado operativo

- Correcto: rutas `ayuda` y `error` ya conectadas al `Switch Tipo`.
- Correcto: incluye `DISCORD_WEBHOOK_URL` en `Config`.
- Observacion: `!reporte [dias]` parsea dias, pero el nodo `Trigger Reporte PDF` no esta pasando `rango_dias` al workflow de reporte.
- Observacion: inserts SQL de `Guardar Q&A`, `PG Insert Evento Trello` y `PG Insert Evento GitHub` se construyen por string interpolation (funciona, pero es fragil).

## 2) Construir Contexto Robusto

- Archivo: `Construir Contexto Robusto.json`
- ID: `Dgobg3vMcRWaNPkA`
- Activo: Si
- Trigger: `Schedule Trigger` por minutos

### Que hace hoy

1. Lee tarjetas Trello + commits `main` (backend/frontend) + snapshot previo (`estado_conocido`).
2. Calcula deltas (`Delta Detector`): tarea completada, PDF nuevo, commits nuevos en main.
3. Actualiza snapshot en `estado_conocido`.
4. Si hay eventos: analiza con Gemini, notifica Discord y guarda evento en Postgres.

### Estado operativo

- Correcto: detector robusto para entradas spliteadas/no spliteadas.
- Riesgo: `Gemini Event Analysis` y `Discord Event` tienen `sendBody` activo pero `bodyParameters` vacio (`[{}]`), por lo que pueden no enviar payload util.
- Riesgo: `PG Insert Evento` usa `queryReplacement` en formato comma-separated (`={{ a }},={{ b }},={{ c }}`), patron fragil segun version del nodo Postgres.
- Riesgo funcional: el schedule no define `minutesInterval`; queda sujeto al default de n8n (en la practica suele ser cada minuto).

## 3) Monitor PetSafe

- Archivo: `Monitor PetSafe.json`
- ID: `Q4GWX9tgUGXv8rek`
- Activo: Si
- Trigger: cada 30 minutos

### Que hace hoy

1. Recolecta estado Trello, GitHub (commits/PRs/CI), historial e hitos.
2. Calcula KPIs, riesgos y snapshot de tareas.
3. Guarda analisis en `analisis_proyecto`.
4. Guarda snapshot en `estado_tareas`.
5. Si hay problemas: pide analisis a Gemini, arma payload y envia alerta Discord.

### Estado operativo

- Correcto: filtro de PRs ya usa `html_url?.includes('/pull/')` (mejor que la version anterior).
- Riesgo: nodo `Analisis Impacto` existe pero no esta conectado (nodo huérfano).
- Riesgo: `Guardar Recomendación IA` actualiza por `MAX(id)` de `analisis_proyecto`; con concurrencia podria actualizar otra corrida.

## 4) Reporte PDF Semanal

- Archivo: `Reporte PDF Semanal.json`
- ID: `joddDTQkcp6U7mT9`
- Activo: Si
- Triggers:
  - Cron viernes 18:00
  - `On-Demand Trigger` (llamado por `Execute Workflow`)

### Que hace hoy

1. Junta analisis/hitos/eventos/recomendaciones/destinatarios desde Postgres.
2. Toma actividad GitHub de los ultimos N dias.
3. Pide resumen ejecutivo a Gemini.
4. Construye HTML, lo convierte a PDF (Gotenberg), renombra y distribuye.
5. Publica a Discord + envia email + registra log en `reportes_generados`.

### Estado operativo

- Correcto: workflow esta activo y el ID coincide con el usado por el chat.
- Riesgo: `PG Log Reporte` tiene `queryReplacement` con prefijo `=={{ ... }}` (doble `=`), potencial error de expresion.
- Riesgo de datos: `Build Report Data` clasifica recomendaciones por `obj.aplicada`, pero la query de recomendaciones no devuelve `aplicada`; eso puede mezclar recomendaciones como eventos.
- Riesgo de consistencia: `Build HTML + Binary` espera llaves KPI (`velocidad_semana`, `commits_por_dia_back`, `proyeccion_a_tiempo`, etc.) distintas de las que produce Monitor (`velocidad_tareas_por_dia`, `commits_por_dia`, `proyeccion`, etc.), dejando celdas vacias o en `-`.
- Observacion: hay dos envios a Discord (`Discord Upload PDF` por webhook y `Discord Upload PDF2` por bot), lo que puede generar duplicado en canales.

## 5) System - DB Seeder (estado_conocido)

- Archivo: `System - DB Seeder (estado_conocido).json`
- ID: `aXOczDpgOsgmRulm`
- Activo: No (manual)
- Trigger: manual

### Que hace hoy

1. Genera un seed con `id=1` y snapshot inicial.
2. Hace upsert en tabla `estado_conocido`.

### Estado operativo

- Correcto para inicializacion.
- Requisito: debe ejecutarse al menos una vez en entornos nuevos/reset para que el detector de deltas tenga baseline.

