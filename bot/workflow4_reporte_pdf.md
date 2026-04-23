# 📄 Workflow 4 — Reporte PDF Semanal (n8n)

Este documento explica **a detalle** el flujo definido en `workflow4_reporte_pdf.json`.

## 1) Objetivo del workflow
Generar un **reporte semanal** (o bajo demanda) del estado del proyecto *PetSafe* en formato **PDF**, usando:

- Métricas y estado histórico desde **Postgres** (tablas del sistema).
- Actividad reciente de **GitHub** (commits backend/frontend).
- Un **resumen ejecutivo** generado por **Gemini** (Google Generative Language API) con salida en HTML.
- Render de **HTML → PDF** con **Gotenberg**.
- Distribución del PDF por:
  - **Discord** (Webhook + adjunto)
  - **Email** (SMTP + adjunto)
- Registro del envío en Postgres (`reportes_generados`).

## 2) Entradas y disparadores (Triggers)
El workflow se puede ejecutar de 2 maneras:

### A. Programado (semanal)
**Nodo:** `Schedule Viernes 18:00` (`scheduleTrigger`)
- Cron: `0 18 * * 5` → todos los **viernes a las 18:00**.

### B. Bajo demanda (desde otro workflow)
**Nodo:** `On-Demand Trigger` (`executeWorkflowTrigger`)
- Este trigger se activa cuando otro workflow usa un nodo **Execute Workflow** apuntando a este Workflow 4.

### Parámetro de entrada opcional
El workflow soporta controlar el rango de días (por defecto 7):
- `rango_dias`: número de días hacia atrás para el reporte.

Si el workflow se ejecuta “bajo demanda”, el workflow padre puede pasar `rango_dias` en el JSON de entrada.

## 3) Configuración central (Set)
**Nodo:** `Configuración` (`set`)

Este nodo normaliza variables y computa fechas. Variables que prepara:

### Variables de entorno esperadas (env)
- `GITHUB_TOKEN`
- `GITHUB_TOKEN_BACKEND` (opcional; si no existe usa `GITHUB_TOKEN`)
- `GITHUB_TOKEN_FRONTEND` (opcional; si no existe usa `GITHUB_TOKEN`)
- `GITHUB_OWNER_BACKEND`
- `GITHUB_OWNER_FRONTEND` (fallback: `GITHUB_OWNER` → `GITHUB_OWNER_BACKEND`)
- `GITHUB_REPO_BACKEND`
- `GITHUB_REPO_FRONTEND`
- `GEMINI_API_KEY`
- `DISCORD_WEBHOOK_URL`
- `GOTENBERG_URL` (opcional; default: `http://gotenberg:3000`)
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`

### Campos calculados
- `rango_dias`: `{{$json.rango_dias || 7}}`
- `fecha_desde`: ISO timestamp de “hoy - rango_dias”
- `fecha_hoy`: ISO timestamp de “ahora”

> Nota: `fecha_hoy` se calcula pero en este workflow no se usa directamente; es útil como variable de contexto.

## 4) Recolección de datos (data sources)
Desde `Configuración` se disparan **9 ramas en paralelo** (9 entradas al merge):

### 4.1 Postgres (7 consultas)
Todos estos nodos usan credencial Postgres (placeholder en el JSON):
- Credential ID: `POSTGRES_CREDENTIAL_ID`

1) **Nodo:** `PG Análisis 7d`
- Tabla: `analisis_proyecto`
- Trae histórico de análisis desde `NOW() - rango_dias`.

2) **Nodo:** `PG Último Análisis`
- Tabla: `analisis_proyecto`
- Trae el último snapshot (última ejecución).

3) **Nodo:** `PG Tareas Vencidas`
- Tabla: `estado_tareas`
- Trae tareas no completadas con `fecha_vencimiento < NOW()` (usa `DISTINCT ON (card_id)` para el último estado por tarjeta).

4) **Nodo:** `PG Hitos Próximos`
- Tabla: `hitos_proyecto`
- Trae hitos cuya `fecha_fin` está en los próximos 30 días.

5) **Nodo:** `PG Eventos 7d`
- Tabla: `eventos_detectados`
- Trae eventos recientes del rango (limit 100).

6) **Nodo:** `PG Recomendaciones`
- Tabla: `recomendaciones`
- Trae recomendaciones pendientes tipo `alerta_ia` dentro del rango.

7) **Nodo:** `PG Destinatarios`
- Tabla: `destinatarios_reporte`
- Trae emails activos para envío.

### 4.2 GitHub (2 consultas)
Se ejecutan con `httpRequest` y token Bearer:

8) **Nodo:** `GitHub Back 7d`
- Endpoint: `GET /repos/{owner_back}/{repo_back}/commits`
- Query: `since=fecha_desde`, `per_page=100`

9) **Nodo:** `GitHub Front 7d`
- Endpoint: `GET /repos/{owner_front}/{repo_front}/commits`
- Query: `since=fecha_desde`, `per_page=100`

## 5) Unión de datos (Merge)
**Nodo:** `Merge Reporte` (`merge`, modo `append`, `numberInputs: 9`)

Este nodo concatena los 9 streams en un solo stream (heterogéneo). El resultado es una lista de items mezclados: filas de análisis, filas de tareas vencidas, filas de destinatarios, commits, etc.

## 6) Preparación de datos + Prompt para IA (Code)
**Nodo:** `Build Report Data` (`code`)

Responsabilidades principales:

1) **Clasificar** items del merge por “tipo” (analisis / tarea / destinatario / commit / etc.).
2) Elegir `ultimo` análisis (el más reciente).
3) Parsear `kpis_json` si viene como string.
4) Calcular **tendencia semanal** (delta de progreso).
5) Armar un **prompt** para Gemini solicitando HTML con estructura:
   - Estado general
   - Logros
   - Riesgos (con prioridad A/M/B)
   - Próximos pasos

### Salida del nodo
Este nodo devuelve un objeto `json` con:
- `fecha_reporte`, `fecha_reporte_local`
- `rango_dias`
- `ultimo_analisis`, `kpis`, `tendencia`
- `analisis_historia`, `tareas_vencidas`, `hitos_proximos`, `eventos_recientes`, `recomendaciones_pendientes`
- `destinatarios`, `destinatarios_info`
- `commits_back`, `commits_front` y totales
- `gemini_key` (usa `$env.GEMINI_API_KEY`)
- `prompt` (texto completo para Gemini)

## 7) Generación del resumen ejecutivo con Gemini (HTTP)
**Nodo:** `Gemini Executive Summary` (`httpRequest`)

- Método: `POST`
- URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={{ gemini_key }}`
- Body JSON: `contents[0].parts[0].text = prompt`
- Config: `temperature: 0.4`, `maxOutputTokens: 1200`

La expectativa es que Gemini responda con **HTML** usando etiquetas: `<h3>`, `<p>`, `<ul>`, `<li>`, `<strong>`.

## 8) Construcción del HTML completo + Binary (Code)
**Nodo:** `Build HTML + Binary` (`code`)

Tareas:

1) Extraer el HTML del resumen generado por Gemini:
   - `candidates[0].content.parts[0].text`
   - Si falla o viene vacío, usa un **fallback** HTML mínimo.

2) Construir un documento HTML completo (con CSS inline) que incluye:
   - Portada
   - Resumen ejecutivo
   - Tabla de KPIs
   - Tendencia semanal
   - Tareas vencidas
   - Hitos próximos (si hay)
   - Actividad Git (back/front)
   - Eventos (si hay)
   - Recomendaciones (si hay)

3) Emitir:
   - `json.summaryText`: texto corto para Discord/Email.
   - `json.destinatarios`: lista de emails.
   - `binary.data`: archivo `index.html` (base64, `text/html`).

## 9) Conversión HTML → PDF (Gotenberg)
**Nodo:** `Gotenberg HTML→PDF` (`httpRequest`)

- Método: `POST`
- URL: `{{ GOTENBERG_URL }}/forms/chromium/convert/html`
- Body: `multipart/form-data`
  - Campo `files` toma el binario `data` (el HTML)
- Respuesta: `file` guardada en binario como `pdf`

## 10) Renombrado del PDF (Code)
**Nodo:** `Rename PDF` (`code`)

- Genera `fileName`: `reporte-petsafe-YYYY-MM-DD.pdf`
- Ajusta el binario `pdf` para que quede con el nombre y mimetype correcto.

## 11) Distribución del reporte (Discord + Email) y logging (Postgres)
Desde `Rename PDF` salen **3 ramas en paralelo**:

### 11.1 Discord
**Nodo:** `Discord Upload PDF` (`httpRequest`)
- POST a `DISCORD_WEBHOOK_URL`
- `multipart/form-data` con:
  - `payload_json`: mensaje con `summaryText`
  - `file`: binario `pdf`

### 11.2 Email (SMTP)
**Nodo:** `SMTP Enviar Email` (`emailSend`)
- From: `SMTP_FROM_NAME <SMTP_FROM_EMAIL>`
- To: `destinatarios` (coma-separado)
- Subject: `📊 Reporte Semanal PetSafe — {fecha_reporte_local}`
- Body: HTML breve + `summaryText`
- Attachment: `pdf`

Credencial SMTP (placeholder):
- `SMTP_CREDENTIAL_ID`

### 11.3 Log en Postgres
**Nodo:** `PG Log Reporte` (`postgres`)
- Inserta en `reportes_generados`:
  - tipo = `semanal`
  - rango_dias
  - enviado_discord = TRUE
  - enviado_email = TRUE
  - destinatarios
  - resumen (`summaryText`)

## 12) Dependencias/infra necesarias
Para que el workflow corra bien en servidor necesitas:

- **Postgres** accesible y credenciales creadas en n8n (reemplazar `POSTGRES_CREDENTIAL_ID`).
- **SMTP** configurado en n8n (reemplazar `SMTP_CREDENTIAL_ID`).
- **Gotenberg** corriendo y accesible desde el contenedor n8n.
- **Variables de entorno** disponibles dentro de n8n (`$env.*`).

## 13) Puntos de falla típicos
- `GEMINI_API_KEY` no seteada → el nodo Gemini falla (HTTP 401/403).
- `DISCORD_WEBHOOK_URL` inválida → falla la subida del PDF a Discord.
- `GOTENBERG_URL` no accesible → falla conversión HTML→PDF.
- Credenciales Postgres/SMTP no existen en esa instancia de n8n → fallan queries/envío.
- Límites de GitHub API / token sin permisos → GitHub requests fallan.

## 14) Observaciones importantes (inconsistencias en el JSON)
Hay 2 detalles que conviene tener presentes porque afectan mantenimiento y, dependiendo de la versión de n8n, podrían causar problemas:

1) **Conexión a un nodo inexistente**
En `connections`, el nodo `Gemini Executive Summary` apunta también a `Generar Tablas HTML`, y existe además un bloque `connections["Generar Tablas HTML"]`, **pero ese nodo NO existe en `nodes[]`**.

- En la práctica, esto es una **inconsistencia del grafo**.
- Si te da errores raros al importar/publicar, este suele ser el tipo de causa.

2) **Clasificación de items (posibles secciones vacías)**
El `Build Report Data` detecta `hitos/eventos/recomendaciones` por campos que **no coinciden** con las columnas seleccionadas en los queries actuales. Resultado típico: esas secciones pueden quedar vacías aunque Postgres devuelva filas.

> Si quieres, puedo proponerte un patch “mínimo” para arreglar esas 2 cosas (sin cambiar el UX del reporte):
> - eliminar la conexión a `Generar Tablas HTML` o re-crear el nodo faltante, y
> - ajustar la función `detectType()` para reconocer `hitos_proyecto` (`fecha_fin`), `eventos_detectados` (`tipo/descripcion`) y `recomendaciones` (`tipo/descripcion`).

## 15) Cómo se usa desde el Workflow 2 (alto nivel)
Workflow 4 está diseñado para ejecutarse desde un workflow “chat/router” (por ejemplo, el Workflow 2) mediante **Execute Workflow** (y opcionalmente pasando `rango_dias`).

- Requisito: el Workflow 4 debe estar **publicado/activo** en esa instancia, y el nodo Execute Workflow debe referenciar el **ID real** de este workflow.
