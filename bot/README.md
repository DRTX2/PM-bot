# Workflows PetSafe

Mapa rápido de los workflows actuales en `bot/`.

Para la revision senior completa y roadmap de produccion, ver `ARQUITECTURA_PM_AI_PETSAFE.md`.
Para operar o validar infraestructura de produccion, ver `../docs/PRODUCTION_RUNBOOK.md`.

## Discord

- `Chat Discord PetSafe.json`: entrada principal `POST /webhook/discord-chat`, comandos rápidos, contexto para chat y agente Gemini nativo.
- `Discord Eventos GitHub PetSafe.json`: trigger nativo de GitHub, normaliza eventos relevantes, notifica Discord y guarda el evento.
- `Discord Eventos Trello PetSafe.json`: trigger nativo de Trello, normaliza eventos relevantes, notifica Discord y guarda el evento.

## Monitor

- `Monitor PetSafe.json`: schedule principal, cache, recolección Trello/GitHub/Postgres con credenciales predefinidas, cálculo de KPIs, snapshots y decisión de alerta.
- `Monitor PetSafe - Alertas IA.json`: workflow hijo llamado por `Monitor PetSafe` cuando hay problemas; genera diagnóstico con nodo Gemini nativo, publica Discord y guarda recomendación.
- `Monitor PetSafe - Error Handler.json`: error workflow separado para alertar fallos de ejecución a Discord.

## Soporte

- `Construir Contexto Robusto.json`: detector programado de deltas/eventos.
- `Reporte PDF Semanal.json`: reporte semanal y on-demand desde Discord, con resumen ejecutivo Gemini nativo y fetch GitHub autenticado por credenciales.
- `System - DB Seeder (estado_conocido).json`: seed inicial de estado conocido.

## Notas de importación

1. Importar primero workflows hijos/soporte: `Monitor PetSafe - Alertas IA`, `Monitor PetSafe - Error Handler`, eventos Discord, reporte y contexto.
2. Importar después los principales: `Monitor PetSafe` y `Chat Discord PetSafe`.
3. Activar explícitamente los workflows con webhooks/schedules que correspondan en n8n. Los hijos nuevos quedaron `active: false` para evitar duplicar webhooks por accidente al importar.

## Cambios recientes

- `Reporte PDF Semanal` ya usa `chainLlm` + `lmChatGoogleGemini` para el resumen ejecutivo.
- `Monitor PetSafe`, `Chat Discord PetSafe` y `Reporte PDF Semanal` ya usan credenciales predefinidas de GitHub/Trello en los nodos `HTTP Request` estáticos.
- Los workflows críticos del bot quedaron enlazados al error handler global `monitor-petsafe-error-handler`.
