# Plan de Pruebas de Validación — PetSafe PM AI

Este documento detalla el plan de pruebas *End-to-End* para asegurar que todos los flujos del sistema Project Management AI funcionen correctamente.

> ⚠️ **Pre-requisitos:** Asegúrate de tener las credenciales correctas configuradas en n8n y de tener el token de aprobación configurado (`PM_APPROVAL_SECRET`) en las variables de entorno.

---

## 1. Pruebas de Eventos (Event-Driven Pipeline)

### Prueba 1.1: Flujo de Ingesta desde GitHub (Code Review Scout)
- **Acción:** Crea un *Pull Request* falso en el repositorio Backend de PetSafe en GitHub.
- **Validación Esperada:**
  1. El webhook recibe el evento y lo inserta en la tabla `events_inbox` con `status='ingested'`.
  2. El `Router - Project Events` lo toma y llama al `PM Orchestrator`.
  3. El Orchestrator deduce que es un PR y enruta el evento al `Code Review Scout`.
  4. El Code Review Scout evalúa el código, lo inserta en `ai_decisions` e inserta el resultado final en `events_outbox`.
  5. Recibes una notificación en Discord analizando los riesgos del código introducido en el PR.

### Prueba 1.2: Flujo de Ingesta desde Trello (Bidireccional)
- **Acción:** Mueve una tarjeta de Trello de la columna "En Progreso" a la columna "QA" o "Hecho".
- **Validación Esperada:**
  1. El webhook de Trello captura el movimiento y lo encola.
  2. El evento es enrutado y el sistema deduce la actualización del estado.
  3. El bot notifica en Discord sobre el avance del equipo en Trello.

---

## 2. Pruebas de Integración con Discord (Chat Bot)

### Prueba 2.1: Comandos de Fase (`!fase`)
- **Acción:** En el canal de Discord, escribe `!fase sync`.
- **Validación Esperada:** El bot debe importar todas tus listas de Trello a la base de datos PostgreSQL en la tabla `project_phases` y responder: "🔄 Sincronización completada...".

### Prueba 2.2: Listado de Fases (`!fase listar`)
- **Acción:** Escribe `!fase listar`.
- **Validación Esperada:** El bot debe responder con un listado limpio de tus fases/listas de Trello y mostrar un porcentaje de completitud basado en las tarjetas de `estado_tareas`.

### Prueba 2.3: Extracción de Resúmenes (`!doc`)
- **Acción:**
  1. Sube un PDF a una tarjeta activa en Trello.
  2. Espera que pase el job (o ejecuta manualmente el trigger del workflow `Trello - Sync Attachments`).
  3. Escribe en Discord `!doc <ID_DE_LA_TARJETA>`.
- **Validación Esperada:** El bot consultará la BD, pedirá el resumen a Gemini y responderá con el análisis ejecutivo del documento PDF y los metadatos generados. 

---

## 3. Pruebas de Human-In-The-Loop (Dashboard de Aprobaciones)

### Prueba 3.1: Inyectar Decisión Bloqueada
- **Acción:** Modifica manualmente en la base de datos (o inyecta un evento riesgoso intencionalmente) para que una decisión llegue con `requires_human_approval = true` a la tabla `ai_decisions`.
- **Validación Esperada:**
  1. La decisión debe quedar con estado `pending_approval`.
  2. En el navegador, abre la ruta del webhook del dashboard: `URL_N8N/webhook/pm-approvals`.
  3. Debe renderizarse una tarjeta roja/amarilla indicando que una acción riesgosa está a la espera.

### Prueba 3.2: Aprobar desde Dashboard
- **Acción:**
  1. Utiliza una extensión de navegador (ej. ModHeader) para inyectar el header `X-PM-Token: <TU_SECRETO>` en tu navegación, o hazlo vía cURL/Postman.
  2. Haz clic en "Aprobar" en la tarjeta del Dashboard.
- **Validación Esperada:**
  1. La interfaz indica que fue aprobado, y la tarjeta desaparece de la vista.
  2. En PostgreSQL, el registro en `ai_decisions` ahora tiene estado `approved` y el actor dice `tech-lead`.
  3. Recibes un mensaje de confirmación "✅ Decisión aprobada" en Discord.

---

## 4. Pruebas del Reporte Semanal

### Prueba 4.1: Reporte Premium On-Demand
- **Acción:** Entra al workflow `Reporte PDF Semanal` en n8n. Dale clic al botón flotante "Execute Workflow" (esto accionará el nodo *On-Demand Trigger*).
- **Validación Esperada:**
  1. El workflow recopilará datos, hitos y commits.
  2. Gotenberg renderizará el nuevo HTML profesional.
  3. Debería subir a Discord el nuevo PDF elegante, que **NO** debe contener bloques crudos de código (````html`), y lucirá como un informe confidencial de una PMO.

---

## 5. Pruebas de Tolerancia a Fallos y DLQ (Dead Letter Queue)

### Prueba 5.1: Falla de Envío
- **Acción:** Cambia temporalmente la URL de Webhook de Discord (`DISCORD_WEBHOOK_URL`) en las variables por una URL inválida. Luego, inyecta un evento válido.
- **Validación Esperada:**
  1. El `Executor - Discord Outbox` intentará enviar y fallará.
  2. Aumentará el `retry_count` en la tabla `events_outbox`.
  3. Tras 5 reintentos fallidos, el registro debe ser marcado con status `dead`.
  4. El `Monitor - Outbox DLQ` (cuando corra en su Schedule) debe detectar esta fila "muerta" y alertar a los administradores a través del `Error Handler`.
- **Nota final:** Restaura la variable correcta tras la prueba.
