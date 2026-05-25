# Plan de pruebas Discord - PetSafe PM AI

Este documento es un guion operativo para probar el bot PM en Discord usando datos coherentes con el tablero real de PetSafe. El foco es validar comandos, ruteo por canal, persistencia en Postgres, sincronizacion con Trello, reportes, reuniones y comportamiento PM.

## 0) Alcance y criterios de exito

**Incluye**
- Comandos `/pm` y comandos directos `/estado`, `/reporte`, `/kpis`, `/pendientes`, etc.
- Respuestas en el canal correcto.
- Persistencia en Postgres (`pm_*`, `events_outbox`, `events_inbox`, etc.).
- Integraciones Trello, GitHub, reportes PDF y Discord.
- Lenguaje natural dentro de canales PM.
- Validacion de fases reales del tablero: `Seguimiento y Control` y `Cierre`.

**Exito**
- Ningun comando devuelve stack trace ni `Error conectando con n8n`.
- No hay mensajes duplicados.
- Las fechas se muestran legibles, no como ISO crudo.
- Las tablas esperadas reflejan cada accion.
- El bot distingue tareas, avances, bloqueos, riesgos, entregables y reuniones segun el canal.

## 1) Contexto real del tablero

Las pruebas deben alinearse con estas fases/cards existentes:

**Seguimiento y Control**
- Pruebas de integracion
- Pruebas del sistema
- Pruebas de aceptacion de usuario

**Cierre**
- Implantacion
- Desarrollo y entrega de manual de usuario
- Capacitaciones

Los comandos `/pm tarea crear` crean tareas/cards nuevas asociadas a una fase. No deben asumirse como subtareas/checklists dentro de una card existente.

## 2) Punto importante antes de probar

Evita duplicar cards principales como `Pruebas de integracion`, `Implantacion` o `Capacitaciones`. Las tareas de prueba deben ser actividades complementarias.

Ejemplo correcto:

```text
/pm tarea crear Validar sincronizacion de estados entre Trello y Discord fase: "Seguimiento y Control" responsable: DP limite: 2026-05-27 prioridad: alta
```

Ejemplo que no se debe asumir como subtarea:

```text
/pm tarea crear Pruebas de integracion fase: "Seguimiento y Control" responsable: DP limite: 2026-05-27 prioridad: alta
```

## 3) Preflight

1. Servicios arriba y health OK:
   - `docker compose ps`
   - `curl -fsS http://127.0.0.1:5678/healthz/readiness`
2. Variables criticas configuradas en `.env`:
   - `DISCORD_WEBHOOK_URL`, `DISCORD_BOT_TOKEN`
   - `DISCORD_CHANNEL_*`
   - `DISCORD_CHANNEL_PM` y `PM_CHANNEL_IDS`
   - `N8N_WEBHOOK` y `N8N_PM_WEBHOOK`
   - `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_BOARD_ID`
   - `GITHUB_TOKEN` + owners/repos
3. n8n activo:
   - `WF_PM_Discord_Entrada`
   - `WF_PM_Router_Intenciones`
   - `WF_PM_Tareas`
   - `WF_PM_Avances`
   - `WF_PM_Bloqueos_Riesgos`
   - `WF_PM_Reportes`
   - `WF_PM_Reuniones`
   - `WF_PM_Entregables`
   - `Reporte PDF Semanal`

## 4) Mapa de canales Discord

| Canal | Variable | Uso principal | Validar |
|---|---|---|---|
| `#chat-agente` | `DISCORD_CHANNEL_PM` | consultas generales + `/pm` | ruteo a canal propietario |
| `#📋-tareas` | `DISCORD_CHANNEL_TAREAS` | crear, listar, actualizar tareas | fases, responsables, Trello |
| `#📈-avances` | `DISCORD_CHANNEL_AVANCES` | avances y cierre dinamico por evidencia | progreso y estado |
| `#🚧-bloqueos` | `DISCORD_CHANNEL_BLOQUEOS` | impedimentos reales | tareas bloqueadas |
| `#⚠️-riesgos` | `DISCORD_CHANNEL_RIESGOS` | amenazas potenciales | mitigacion y prioridad |
| `#📊-reportes` | `DISCORD_CHANNEL_REPORTES` | reportes, KPIs, PDF | fechas, lectura PM |
| `#📅-reuniones` | `DISCORD_CHANNEL_REUNIONES` | reuniones, decisiones, actas | agenda interna |
| `#📦-entregables` | `DISCORD_CHANNEL_ENTREGABLES` | documentos/evidencias/versiones | entregables pendientes |
| `#🤖-bot-log` | `DISCORD_CHANNEL_BOT_LOG` | logs tecnicos | no comandos PM normales |
| `#🔐-admin-bot` | `DISCORD_CHANNEL_ADMIN` | diagnostico/admin | permisos |

## 5) Ayuda contextual por canal

Ejecutar en cada canal PM:

```text
/ayuda
que puedo hacer en este canal?
```

Esperado:
- En `#riesgos` debe responder ayuda de riesgos, no registrar un riesgo.
- En `#avances` debe responder ayuda o interpretar avances solo si el texto parece avance real.
- En `#reportes` debe mostrar comandos de reportes/KPIs/PDF.
- No debe aparecer `Error conectando con n8n`.

## 6) Datos de prueba por fases reales

### 6.1 Crear tareas en `Seguimiento y Control`

En `#📋-tareas`:

```text
/pm tarea crear Validar sincronizacion de estados entre Trello y Discord fase: "Seguimiento y Control" responsable: DP limite: 2026-05-27 prioridad: alta

/pm tarea crear Verificar persistencia de comandos PM en PostgreSQL fase: "Seguimiento y Control" responsable: DM limite: 2026-05-28 prioridad: alta

/pm tarea crear Comprobar registro de eventos GitHub en reportes del sprint fase: "Seguimiento y Control" responsable: JA limite: 2026-05-29 prioridad: media

/pm tarea crear Validar generacion de alertas por tareas vencidas fase: "Seguimiento y Control" responsable: FG limite: 2026-05-30 prioridad: alta

/pm tarea crear Revisar evidencia de pruebas funcionales del bot fase: "Seguimiento y Control" responsable: FG limite: 2026-06-01 prioridad: media
```

Esperado:
- Se crean tareas nuevas, no se duplican las cards principales.
- Quedan asociadas a `Seguimiento y Control`.
- El responsable se resuelve sin ambiguedad o el bot pide aclaracion.
- Si Trello esta activo, se crea/sincroniza card en la lista correcta.

### 6.2 Crear tareas en `Cierre`

En `#📋-tareas`:

```text
/pm tarea crear Verificar despliegue final del bot y servicios integrados fase: "Cierre" responsable: DM limite: 2026-06-04 prioridad: critica

/pm tarea crear Consolidar evidencias finales de funcionamiento del sistema fase: "Cierre" responsable: DP limite: 2026-06-06 prioridad: alta

/pm tarea crear Elaborar acta de aceptacion final del proyecto fase: "Cierre" responsable: FG limite: 2026-06-08 prioridad: alta

/pm tarea crear Registrar lecciones aprendidas del desarrollo e integracion fase: "Cierre" responsable: JA limite: 2026-06-09 prioridad: media

/pm tarea crear Preparar informe ejecutivo de cierre para el director fase: "Cierre" responsable: DM limite: 2026-06-10 prioridad: alta

/pm tarea crear Validar respaldo final de documentos y evidencias fase: "Cierre" responsable: JA limite: 2026-06-10 prioridad: media
```

Esperado:
- Las tareas quedan agrupadas en `Cierre`.
- La tarea critica debe aparecer arriba en pendientes.
- Las fechas deben verse legibles.

## 7) Secuencia completa de pruebas en Discord

### A. Comprobar registro por fase

En `#📋-tareas`:

```text
/pm tarea listar
/pm pendientes
que tareas hay pendientes
```

Esperado:
- Tareas agrupadas por `Seguimiento y Control` y `Cierre`.
- IDs visibles, por ejemplo `#77`, `#78`.
- `pendientes` prioriza por urgencia y prioridad.

Guarda estos IDs reales:
- `ID_SYNC_ESTADOS`: Validar sincronizacion de estados entre Trello y Discord
- `ID_GITHUB_REPORTES`: Comprobar registro de eventos GitHub en reportes del sprint
- `ID_EVIDENCIAS_BOT`: Revisar evidencia de pruebas funcionales del bot
- `ID_DESPLIEGUE_FINAL`: Verificar despliegue final del bot y servicios integrados

### B. Tarea en progreso de Seguimiento y Control

Reemplaza `#ID_SYNC_ESTADOS` por el ID real:

```text
/pm tarea actualizar #ID_SYNC_ESTADOS estado: en_progreso prioridad: alta
```

En `#📈-avances`:

```text
/pm avance registrar #ID_SYNC_ESTADOS 40% Sincronizacion inicial validada; falta comprobar actualizacion bidireccional de estados.
```

Esperado:
- La tarea pasa a `en_progreso`.
- Se registra avance del 40%.
- No se marca como completada.
- Trello refleja estado si la sincronizacion bidireccional esta activa.

### C. Tarea bloqueada

En `#🚧-bloqueos`:

```text
/pm bloqueo registrar No se reciben eventos del repositorio backend en el reporte semanal prioridad: alta tarea: #ID_GITHUB_REPORTES
```

En `#📋-tareas`:

```text
/pm tarea actualizar #ID_GITHUB_REPORTES estado: bloqueada prioridad: alta
```

Despues:

```text
/pm bloqueo listar
/pm pendientes
```

Esperado:
- La tarea queda `bloqueada`.
- El bloqueo queda asociado a la tarea.
- El reporte recomienda revisar token, webhook o configuracion de GitHub.

### D. Tarea en revision

En `#📋-tareas`:

```text
/pm tarea actualizar #ID_EVIDENCIAS_BOT estado: en_revision prioridad: media
```

En `#📈-avances`:

```text
/pm avance registrar #ID_EVIDENCIAS_BOT 90% Evidencias consolidadas y pendientes de validacion final por QA o director del proyecto.
```

Esperado:
- La tarea queda en `en_revision`.
- No debe marcarse como completada automaticamente.
- El bot puede recomendar revision por Fernando/QA.

### E. Riesgo asociado a Implantacion y Cierre

En `#⚠️-riesgos`:

```text
/pm riesgo registrar descripcion: Posible retraso en la implantacion por fallas en sincronizacion Trello Discord probabilidad: media impacto: critico mitigacion: Ejecutar validacion completa antes del despliegue final
/pm riesgo listar
```

Esperado:
- Riesgo registrado con prioridad alta o critica segun matriz.
- Texto limpio, sin repetir `descripcion:` o `mitigacion:`.
- Debe verse como amenaza potencial, no como bloqueo activo.

### F. Tarea critica proxima al cierre

En `#📋-tareas`:

```text
/pm tarea actualizar #ID_DESPLIEGUE_FINAL estado: en_progreso prioridad: critica
```

En `#📈-avances`:

```text
/pm avance registrar #ID_DESPLIEGUE_FINAL 25% Entorno preparado; pendiente validar Discord, Trello, GitHub, PostgreSQL y generacion de reportes.
```

Luego:

```text
/pm pendientes
```

Esperado:
- La tarea aparece como prioridad critica.
- Debe estar por encima de tareas medias o bajas.

### G. Entregables relacionados con Cierre

En `#📦-entregables`:

```text
/pm entregable registrar nombre: Informe ejecutivo final del proyecto responsable: DM limite: 2026-06-10

/pm entregable registrar nombre: Acta de aceptacion final responsable: FG limite: 2026-06-08

/pm entregable registrar nombre: Evidencias finales de pruebas y funcionamiento responsable: DP limite: 2026-06-06

/pm entregable pendientes
```

Esperado:
- Los entregables no se confunden con tareas comunes.
- Quedan disponibles para reportes de cierre.

### H. Reunion y decision de cierre

En `#📅-reuniones`:

```text
/pm reunion agendar tema: Revision final de evidencias e implantacion cuando: 2026-06-08 hora: 10:00 donde: videollamada participantes: DM, FG, DP, JA

/pm reunion listar
```

Registrar decision:

```text
/pm decision registrar Se realizara el cierre unicamente despues de validar reportes, sincronizacion Trello y alertas criticas responsable: FG

/pm decision listar
```

Esperado:
- La reunion queda registrada en el calendario interno del bot.
- La decision aparece en reportes posteriores.
- Participantes ambiguos deben pedirse con mas claridad si el bot no los resuelve.

### I. Reportes finales

En `#📊-reportes`:

```text
/pm reporte diario
/reporte 14
/kpis 7
/reporte 14 pdf
/reporte pdf 14
```

Esperado:
- Reporte diario corto y entendible.
- Reporte de 14 dias con tareas clave, riesgos, bloqueos, entregables y decisiones.
- KPIs con fechas legibles.
- PDF generado/publicado si `Reporte PDF Semanal` esta activo y Gotenberg funciona.

## 8) Escenario de replanificacion asistida

Simular bloqueo critico cerca del cierre:

```text
/pm tarea actualizar #ID_DESPLIEGUE_FINAL estado: bloqueada prioridad: critica
```

En `#🚧-bloqueos`:

```text
/pm bloqueo registrar Despliegue final detenido por error de comunicacion con webhook de Discord prioridad: critica tarea: #ID_DESPLIEGUE_FINAL
```

En `#⚠️-riesgos`:

```text
/pm riesgo registrar descripcion: El bloqueo del despliegue final puede retrasar el cierre del proyecto probabilidad: alta impacto: critico mitigacion: Priorizar correccion del webhook y reprogramar validacion final
```

Luego:

```text
/pm pendientes
/pm reporte diario
/reporte 14
```

Respuesta esperada:

```text
Se detecta riesgo critico en la fase Cierre debido al bloqueo de la tarea de despliegue final. Se recomienda priorizar la correccion del webhook de Discord, reasignar apoyo tecnico si es necesario y revisar la fecha de la validacion final antes de aprobar el cierre del proyecto.
```

## 9) Comandos adicionales por canal

### 9.1 `#📋-tareas`

```text
/pm tarea listar
/pm pendientes
/pm atrasos
que tareas se completaron en los ultimos 2 dias
hay tareas que requieran la asistencia del cliente?
para esta semana del 25 al 29 de mayo que tareas se prevee completar
/pm tarea actualizar #ID estado: completada
/pm tarea actualizar #ID prioridad: urgente
/pm tarea asignar #ID responsable: David
/pm tarea asignar #ID responsable: David Manjarres
```

Validar:
- `prioridad: urgente` debe rechazarse con valores permitidos.
- Responsable ambiguo debe pedir aclaracion.
- Lenguaje natural debe responder sin error.

### 9.2 `#📈-avances`

```text
/pm avance resumen
/pm avance registrar #ID 50% Avance parcial sin evidencia final.
/pm avance registrar #ID 90% Evidencia cargada para revision.
/pm avance registrar #ID 100% Tarea completada con evidencia y documento adjunto.
Tarea #ID completada con evidencia y documento adjunto
```

Validar:
- 50% no completa la tarea.
- 90% con evidencia puede dejar `en_revision`.
- 100% o texto de completado con evidencia puede cerrar la tarea asociada.
- En este canal, palabras como `documento` no deben redirigir a entregables si el texto es avance.

### 9.3 `#🚧-bloqueos`

```text
que puedo hacer en este canal?
/pm bloqueo registrar No puedo validar reportes por timeout de n8n prioridad: alta tarea: #ID
/pm bloqueo listar
/pm bloqueo cerrar #ID_BLOQUEO
```

Validar:
- Ayuda contextual no registra bloqueo.
- Bloqueos se listan separados de riesgos.
- Cerrar bloqueo cambia estado a `resuelto`.

### 9.4 `#⚠️-riesgos`

```text
que puedo hacer en este canal?
/pm riesgo registrar descripcion: Cambios tardios del cliente pueden afectar capacitaciones probabilidad: media impacto: alto mitigacion: Congelar alcance antes de pruebas finales
/pm riesgo listar
/pm riesgo mitigar #ID_RIESGO
```

Validar:
- Ayuda contextual no registra riesgo.
- Riesgos se listan limpios y con mitigacion.
- Mitigar cambia estado a `mitigado`.

### 9.5 `#📊-reportes`

```text
/estado
/pm estado
/pm reporte diario
/pm reporte semanal
/reporte 1
/reporte 7
/reporte 14
/reporte 90
/reporte 200
/kpis 7
/reporte 14 pdf
```

Validar:
- `/reporte 200` se limita a 90 dias.
- `/reporte 1` no debe ser identico a `/reporte 14`.
- No debe haber ISO crudo tipo `2026-05-27T05:00:00.000Z`.
- Si el mensaje supera 2000 caracteres, debe dividirse sin cortar contenido.

### 9.6 `#📅-reuniones`

```text
/pm reunion agendar tema: Seguimiento de cierre cuando: 2026-06-08 hora: 10:00 donde: videollamada participantes: todos
/pm reunion agendar tema: Validacion con cliente cuando: 2026-06-09 hora: 15:00 participantes: DM, FG
/pm reunion listar
/pm reunion actualizar #ID_REUNION cuando: 2026-06-09 hora: 11:00 participantes: DM, FG, JA
/pm reunion acta #ID_REUNION acuerdos: validar evidencias compromisos: FG envia acta decisiones: cierre condicionado a pruebas
/pm reunion cancelar #ID_REUNION
/pm decision registrar Se prioriza cierre sobre nuevas mejoras responsable: DM
/pm decision listar
/pm retrospectiva accion Documentar errores encontrados en pruebas de Discord responsable: FG
/pm retrospectiva listar
```

Validar:
- Reunion sin fecha/hora debe pedir datos faltantes.
- Por defecto `donde` debe ser videollamada.
- `todos` debe resolver participantes configurados.
- Decisiones y actas aparecen en reportes posteriores.

### 9.7 `#📦-entregables`

```text
/pm entregable registrar nombre: Manual rapido de comandos PM responsable: FG limite: 2026-06-09
/pm entregable registrar nombre: Evidencias de pruebas Discord responsable: DP limite: 2026-06-06
/pm entregable listar
/pm entregable pendientes
```

Validar:
- Entregables no deben crear tareas.
- Fechas legibles.
- Responsable ambiguo debe aclararse si aplica.

### 9.8 `#🔐-admin-bot`

```text
/pm admin estado
```

En otro canal:

```text
/pm admin estado
```

Validar:
- En `#admin-bot` responde estado.
- Fuera de `#admin-bot` deniega o redirige sin ejecutar diagnostico sensible.

## 10) Subtareas/checklists dentro de cards existentes

No ejecutar estos comandos hasta confirmar que `/pm subtarea crear` existe. El plan actual valida tareas/cards, no checklists dentro de cards.

Comandos deseados a futuro:

```text
/pm subtarea crear card: "Pruebas de integracion" titulo: "Validar sincronizacion Trello Discord" responsable: DP limite: 2026-05-24 prioridad: alta

/pm subtarea crear card: "Pruebas del sistema" titulo: "Verificar persistencia de comandos PM" responsable: JA limite: 2026-05-29 prioridad: media

/pm subtarea crear card: "Pruebas de aceptacion de Usuario" titulo: "Aprobar evidencias funcionales del bot" responsable: FG limite: 2026-06-02 prioridad: alta

/pm subtarea crear card: "Implantacion" titulo: "Validar despliegue final y webhooks" responsable: DM limite: 2026-06-03 prioridad: critica

/pm subtarea crear card: "Desarrollo y entrega de manual de usuario" titulo: "Documentar comandos PM y casos de uso" responsable: FG limite: 2026-06-06 prioridad: media

/pm subtarea crear card: "Capacitaciones" titulo: "Demostrar gestion de tareas y reportes en Discord" responsable: FG limite: 2026-06-09 prioridad: media
```

Pendiente tecnico:
- Confirmar si el bot soporta checklists de Trello.
- Si no existe, implementar `/pm subtarea crear/listar/completar` contra checklists/items de Trello.

## 11) Integracion Trello

### 11.1 Sync de tareas

1. Ejecutar workflow `Trello - Sync Tareas`.
2. Mover una tarjeta en Trello a una lista de completadas.
3. Esperado:
   - `pm_tareas.estado = 'completada'`
   - `estado_tareas.completada = true`
   - Reportes dejan de mostrar esa tarea como activa.

### 11.2 Sync de fases/listas

```text
/fase sync
```

Esperado:
- `project_phases` actualizado.
- Las fases `Seguimiento y Control` y `Cierre` existen.

### 11.3 Adjuntos/PDFs

1. Ejecutar `Trello - Sync Attachments`.
2. Adjuntar PDF/evidencia en una card.
3. Usar:

```text
/doc <card_id>
```

Esperado:
- Fila en `card_attachments`.
- Resumen del documento si el flujo de PDFs esta activo.

## 12) Integracion GitHub

### 12.1 Eventos GitHub

- Forzar evento push o PR en backend y frontend.
- Esperado:
  - Filas en `events_inbox`.
  - Filas en `eventos_detectados`.
  - Alertas o reportes reflejan actividad.

### 12.2 Commits/PR en reportes

```text
/reporte 7
/reporte 7 pdf
```

Esperado:
- Reporte de Discord muestra lectura PM.
- PDF incluye actividad tecnica si GitHub esta configurado.

## 13) Outbox Discord y DLQ

### 13.1 Envio normal

```text
/pm reporte diario
```

Esperado:
- `events_outbox` registra payload.
- No quedan mensajes en `sending` mas de 10 minutos.

### 13.2 DLQ controlado

Solo en entorno de pruebas:
- Cambiar `DISCORD_WEBHOOK_URL` a endpoint invalido.
- Ejecutar reporte.

Esperado:
- `events_outbox` pasa a `dead`.
- Se genera alerta tecnica.
- Restaurar variable inmediatamente.

## 14) Consultas SQL de verificacion

```sql
select id, titulo, estado, responsable, prioridad, sprint, fecha_limite, fecha_actualizacion
from pm_tareas
order by fecha_actualizacion desc
limit 20;

select id, tarea_id, responsable, porcentaje, descripcion, fecha
from pm_avances
order by fecha desc
limit 20;

select id, descripcion, estado, severidad, tarea_id, fecha_creacion
from pm_bloqueos
order by fecha_creacion desc
limit 20;

select id, descripcion, estado, prioridad_calculada, mitigacion, fecha_creacion
from pm_riesgos
order by fecha_creacion desc
limit 20;

select id, decision, responsable, fecha
from pm_decisiones
order by fecha desc
limit 20;

select id, nombre, estado, responsable, fecha_limite
from pm_entregables
order by fecha_limite nulls last
limit 20;

select outbox_id, status, retry_count, scheduled_at, last_error
from events_outbox
order by scheduled_at desc
limit 20;
```

## 15) Checklist final

- Cada canal responde segun su proposito.
- `#riesgos` no convierte preguntas de ayuda en riesgos.
- `#avances` puede cerrar tareas con 100% o evidencia cuando corresponde.
- Tareas nuevas quedan en `Seguimiento y Control` o `Cierre`.
- Fechas legibles en tareas, KPIs y reportes.
- `/pm reporte diario` es corto y distinto de `/reporte 14`.
- `/kpis 7` no mezcla el reporte largo.
- Bloqueos y riesgos se cuentan/listan por separado.
- Entregables no se confunden con tareas.
- Reuniones se registran sin Google Calendar.
- PDF funciona con `/reporte 14 pdf` o `/reporte pdf 14` si `Reporte PDF Semanal` esta activo.
- Trello refleja estados correctos cuando la sincronizacion esta disponible.
- GitHub genera eventos si credenciales/webhooks estan activos.
- No hay mensajes duplicados ni errores visibles en Discord.
