# Roadmap de Funcionalidades: Project Manager AI PetSafe

Este documento prioriza los módulos y agentes necesarios para convertir el bot en un Project Manager excepcional y dinámico, capaz de interactuar con GitHub, Trello y Discord con reacciones autónomas (replanificación, gestión de riesgos, revisiones).

## Prioridad Alta (Fundamentos y Orquestación)

1. **[✅ DONE] System - AI Decision Logger (Auditor de IA)**
   - **Objetivo:** Registrar cada evaluación, sugerencia o decisión que tome la IA en la tabla `ai_decisions`.
   - **Valor:** Permite tener trazabilidad completa. Si la IA recomienda replanificar, sabemos exactamente qué contexto usó, su nivel de confianza y permite la intervención humana (*Human-in-the-loop*) antes de ejecutar una acción crítica.

2. **[✅ DONE] AI - PM Orchestrator (Enrutador Dinámico)**
   - **Objetivo:** Recibir eventos (PR creado, tarjeta movida) desde `events_inbox` y decidir qué agente debe actuar, o si requiere la creación de un nuevo ticket por dependencia cruzada.
   - **Valor:** Es el cerebro central que da la sensación de tener un PM que "se da cuenta" de lo que pasa y delega.

3. **[✅ DONE] AI - Context Guardian (Memoria y Reglas)**
   - **Objetivo:** Mantener el estado de las convenciones de código, arquitectura (ADRs) y reglas del negocio.
   - **Valor:** Evita que el bot alucine; obliga a que todos los sub-agentes consulten las reglas base antes de dar una respuesta en Discord o Trello.

## Prioridad Media (Especialización Ágil y Código)

4. **[✅ DONE] AI - Code Review Scout**
   - **Objetivo:** Responder automáticamente a eventos de *Pull Request* de GitHub, analizando el diff y dejando comentarios sobre seguridad, convenciones o cobertura faltante.
   - **Valor:** Descarga el trabajo de revisión inicial y mejora la calidad del código continuo.

5. **[✅ DONE] AI - Risk Analyst & Workload Balancer**
   - **Objetivo:** Analizar *Aging WIP* (tareas que llevan mucho tiempo en In Progress) y la capacidad del equipo.
   - **Valor:** Si nota que un desarrollador tiene 5 PRs abiertos y 3 tarjetas en progreso, emite un aviso proactivo de "Cuello de botella" recomendando a otro miembro o sugiriendo priorizar revisiones.

## Prioridad Baja (Acciones Fuertes y Métricas)

6. **[✅ DONE] Sincronización Bidireccional Activa**
   - **Objetivo:** Movimiento automático real. Ejemplo: Si el CI pasa y se hace merge al PR, mover automáticamente la tarjeta en Trello y avisar al tester en Discord.
   - **Workflow:** `AI - Sync Bidireccional Activa.json` — dispara con GitHub PR Trigger, detecta merges, archiva la tarjeta Trello referenciada en el branch name y notifica a Discord.

7. **[✅ DONE] AI - Release Guard**
   - **Objetivo:** Evaluación pre-deploy. Decide si el release es seguro en función de los tests, incidentes recientes y reportes de calidad.
   - **Workflow:** `AI - Release Guard.json` — sub-workflow invocable. Consulta el último análisis y las tareas en riesgo, evalúa con Gemini y bloquea o aprueba el release con notificación clara en Discord.

8. **[✅ DONE] Dashboard Web de Aprobación de PM**
   - **Objetivo:** Interfaz donde un tech lead vea las acciones bloqueadas por `requires_human_approval = true` y apruebe con un clic.
   - **Workflow:** `Dashboard - PM Approval Hub.json` — expone dos webhooks: `GET /webhook/pm-approvals` sirve HTML dinámico con tarjetas de decisiones pendientes; `POST /webhook/pm-approve` actualiza el estado en BD y notifica a Discord la resolución.
