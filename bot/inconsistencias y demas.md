**Bloqueadores / “por qué a veces no publica o no corre”**
- **WF3/WF4 están `active: false`**: aunque importen bien, no ejecutan en automático hasta activarlos. Archivo: bot/workflow3_delta_detector%20(1).json.json) y workflow4_reporte_pdf.json
- **Variables de entorno faltantes**: los 4 flujos dependen de `$env.TRELLO_*`, `$env.GITHUB_*`, `$env.GEMINI_API_KEY`, `$env.DISCORD_WEBHOOK_URL` (y WF4 además SMTP/Gotenberg). Si en el servidor no están, fallan por 401/403/404 o credenciales inexistentes.

**Inconsistencias / errores por workflow**

**WF1 (Monitor 30 min)** — workflow1_monitor.json
<!-- revisar leugo -->
- **Nodo muerto**: `Analisis Impacto` existe pero no está conectado en `connections`, no se ejecuta nunca.

<!-- DONE -->
- **PRs probablemente no se cuentan**: en `Análisis + KPIs` filtra PRs con `d.pull_request !== undefined`, pero el endpoint usado es `GET /pulls` (normalmente no trae ese campo). Efecto: KPIs de PR pueden quedar en 0 y la detección `pr_stale` pierde señal.
- 
<!-- PENDING -->
- **Reglas del prompt contradictorias**: el prompt exige “SIN emojis”, pero el contenido real usa emojis/formatos (no rompe ejecución, pero la IA puede obedecer la regla y “pelearse” con el estilo esperado).

<!-- PENDING -->
- **Riesgo de límites de Discord embed**: se hace `slice()` por campo, pero Discord también tiene límite total por embed (y por número de fields). A veces el webhook puede rechazar si se pasa del total.

**WF2 (Chat/Webhook)** — workflow2_chat_discord.json
<!-- PENDING -->
- **No es “Discord trigger”**: es un **Webhook HTTP** (`POST discord-chat`). Depende de bot-bridge o de que alguien le pegue al endpoint.
  
<!-- PENDING -->
- **Bloqueo publish por `WORKFLOW4_ID`** (principal).
- 
<!-- PENDING -->
- **SQL armado por string** en `Guardar Q&A`: aunque hace `replace(/'/g,"''")`, sigue siendo frágil (por tamaño, por caracteres raros, y por dependencias del formato exacto). Mucho más estable es usar parámetros del nodo Postgres.

<!-- TO CHECK -->
- **Dependencia fuerte a shape de datos**: `Construir Contexto` asume que Trello/GitHub llegan completos; si una API falla, partes del prompt quedan vacías y Gemini puede “responder bonito” pero con poco sustento.

**WF3 (Delta Detector 5 min)** — bot/workflow3_delta_detector%20(1).json.json)
<!-- DONE -->
- **Asume que Trello/GitHub llegan como arrays en un solo item** (`Array.isArray(it)`). Dependiendo de la versión/config de `HTTP Request`, n8n puede entregar 1 item por card/commit (spliteado) y entonces **no detecta nada**.
 
 <!-- DONE -->
- **Requiere seed de DB**: necesita que exista `estado_conocido` con `id=1`. Si no existe, `prevSnapshot` queda vacío y la comparación inicial queda rara.

<!-- DONE -->
- **Insert/params frágiles**: `PG Insert Evento` usa `queryReplacement` con una lista “tipo,descripcion,detalle”. Dependiendo del nodo Postgres/n8n, eso puede no mapear bien a `$1,$2,$3` (si te falla, este suele ser el motivo).

**WF4 (Reporte PDF)** — workflow4_reporte_pdf.json

- **Grafo inconsistente**: `connections` referencia un nodo inexistente `Generar Tablas HTML`. Esto es una causa típica de errores raros al importar/publicar/editar.

- **`detectType()` no coincide con tus queries**: clasifica `hitos/eventos/recomendaciones` por campos que no son los que realmente retornan los SELECT actuales (`fecha_fin`, `tipo`, `descripcion`, etc.). Resultado: secciones pueden quedar vacías aunque haya datos.

- **SQL params frágiles** (similar): `PG Log Reporte` usa `$1..$4` pero pasa valores vía `queryReplacement` con un string unido; puede romper según versión.

- **HTML/CSS “hardcoded”**: funciona, pero es difícil de mantener; además el PDF puede variar por fonts/layout según el motor de Gotenberg.

**Cosas que le faltan al “bot gestor de proyecto” (y te sirven para usuarios)**

**1) “Ayuda” y comandos claros (UX)**
- Agregar un comando tipo `!help` que responda “qué puedo pedir” + ejemplos.
- Hacer comandos explícitos para evitar heurísticas:
  - `!kpis`, `!reporte [dias]`, `!riesgos`, `!hitos`, `!pendientes`, `!vencidas`, `!prs`, `!actividad`, `!diff` (en vez de regex “necesita_diff”).
- Permitir parámetros: `!reporte 14`, `!hitos 30`, `!prs open`, etc. (aunque sea con parseo simple).

**2) Respuestas más confiables (evitar “alucinaciones” por falta de datos)**
- En WF2/WF4/WF3, si Trello/GitHub/Postgres fallan, responder algo como: “No pude leer GitHub (401). Te doy respuesta parcial con Trello y DB”.
- En WF2, cuando Gemini responde, incluir (opcional) una línea final: “Fuentes: Trello + GitHub + Postgres (timestamp…)” para que el usuario confíe.

**3) Robustez operativa**
- Manejar nulos: muchos nodos asumen `candidates[0]...` existe; si Gemini falla o cambia el shape, el workflow se cae.
- Rate-limit/costo: el chat puede pegar 10+ requests por mensaje (Trello+GitHub+Postgres+Diff). Para usuarios, conviene:
  - caché corto (ej. 30–60s para Trello/GitHub)
  - o “modo rápido” (sin diff/PRs por defecto)

**4) “Onboarding” del sistema (lo que siempre rompe al mover de local a server)**
- Checklist en el repo: lista de env vars requeridas y credenciales a crear en n8n (Postgres/SMTP).
- Seed SQL: crear `estado_conocido(id=1)` y `destinatarios_reporte` si no existen.
- Documentar que Webhook de n8n requiere workflow activo para URL “production”.

**Mejoras de seguridad / mantenimiento (alto valor)**
- Evitar SQL concatenado en WF2 `Guardar Q&A` y estandarizar inserts con parámetros (reduce fallas por caracteres y es más seguro).
- Centralizar configuración (mismos nombres de env vars en los 4 flujos) y validar al inicio: si falta `GEMINI_API_KEY` o `DISCORD_WEBHOOK_URL`, cortar con error claro.
- Tokens/secretos: rotar cualquier token que se haya expuesto en logs/chat y moverlos a env/credentials (nunca hardcode).

Si me dices “sí, aplícalo”, puedo hacer un patch mínimo “sin cambiar el UX” para:
- WF4: eliminar la conexión al nodo inexistente + arreglar `detectType()`.
- WF1: corregir el filtro de PRs + decidir qué hacer con `Analisis Impacto`.
- WF3: hacer el detector compatible con respuestas spliteadas.
- WF2: corregir encoding del nombre + preparar un `!help` básico (si quieres que lo implementemos).