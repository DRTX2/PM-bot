# Pendientes del Sistema n8n (Backlog Actual)

Este backlog se basa en el estado real de los workflows de `bot/cur-workflows/`.

## Prioridad P0 (critico)

1. Arreglar payload de `Construir Contexto Robusto` en nodos de salida externa.
- Problema: `Gemini Event Analysis` y `Discord Event` tienen `sendBody` pero body vacio.
- Impacto: puede romper analisis de eventos y notificaciones.
- Workflow: `Construir Contexto Robusto.json`.

2. Corregir `queryReplacement` de `PG Log Reporte`.
- Problema: expresion comienza con `=={{ ... }}` en vez de `={{ ... }}`.
- Impacto: puede fallar el log de reportes en DB.
- Workflow: `Reporte PDF Semanal.json`.

3. Pasar `rango_dias` desde comando `!reporte [dias]`.
- Problema: `Router Comandos` parsea dias, pero `Trigger Reporte PDF` no los mapea en `workflowInputs`.
- Impacto: siempre usa default en reporte, ignorando parametro del usuario.
- Workflow: `Chat Discord PetSafe.json`.

## Prioridad P1 (alto impacto)

4. Eliminar o conectar nodo huérfano `Analisis Impacto`.
- Problema: existe en el flujo pero no participa del grafo.
- Impacto: deuda tecnica y confusión operativa.
- Workflow: `Monitor PetSafe.json`.

5. Parametrizar inserts SQL construidos por string.
- Problema: `Guardar Q&A` y inserts de eventos usan interpolacion textual.
- Impacto: fragilidad ante caracteres especiales y mantenimiento complejo.
- Workflow: `Chat Discord PetSafe.json`.

6. Alinear modelo de KPIs entre monitor y reporte.
- Problema: `Build HTML + Binary` espera llaves KPI que no coinciden con las que produce `Monitor`.
- Impacto: campos vacios o métricas incompletas en PDF.
- Workflows: `Monitor PetSafe.json` + `Reporte PDF Semanal.json`.

7. Corregir clasificación de recomendaciones en `Build Report Data`.
- Problema: se diferencia por `obj.aplicada`, pero la query no devuelve esa columna.
- Impacto: recomendaciones se mezclan con eventos.
- Workflow: `Reporte PDF Semanal.json`.

## Prioridad P2 (seguridad y robustez)

8. Verificar firma/autenticidad de webhooks Trello y GitHub.
- Problema: los endpoints `trello-event` y `github-event` aceptan payload sin validación de firma.
- Impacto: riesgo de eventos falsos.
- Workflow: `Chat Discord PetSafe.json`.

9. Mejorar manejo de errores/fallbacks en llamadas externas.
- Problema: varios nodos dependen de `candidates[0]...` o respuestas externas sin guardas consistentes.
- Impacto: caidas por shape inesperado o errores API.
- Workflows: todos, principalmente `Chat`, `Construir Contexto Robusto`, `Reporte`.

10. Revisar estrategia de duplicidad de notificación a Discord en reporte.
- Problema: existen `Discord Upload PDF` (webhook) y `Discord Upload PDF2` (bot) en paralelo.
- Impacto: posible duplicado funcional y mayor complejidad de soporte.
- Workflow: `Reporte PDF Semanal.json`.

## Prioridad P3 (operacion y mantenibilidad)

11. Definir explícitamente intervalo del schedule en `Construir Contexto Robusto`.
- Problema: trigger por minutos sin `minutesInterval` explícito.
- Impacto: ambigüedad operativa (y potencial costo alto si corre cada minuto).
- Workflow: `Construir Contexto Robusto.json`.

12. Reemplazar actualización por `MAX(id)` en guardado IA del monitor.
- Problema: `Guardar Recomendación IA` actualiza el último ID global.
- Impacto: riesgo de race condition con ejecuciones solapadas.
- Workflow: `Monitor PetSafe.json`.

13. Documentar runbook de arranque y recuperación.
- Incluir:
  - orden de activación recomendado,
  - ejecución inicial del seeder,
  - checklist de env vars/credenciales,
  - verificación post-deploy.

## Checklist mínimo de cierre (recomendado)

- [ ] WF3 envía body válido a Gemini y Discord.
- [ ] `PG Log Reporte` inserta correctamente en `reportes_generados`.
- [ ] `!reporte 14` dispara reporte con `rango_dias=14`.
- [ ] PDF muestra KPIs alineados con el monitor.
- [ ] Webhooks Trello/GitHub rechazan requests sin firma válida.
- [ ] No quedan nodos huérfanos en workflows activos.

