# Workflows PetSafe

Mapa rápido de los workflows actuales en `bot/`.

Para la revision senior completa y roadmap de produccion, ver `ARQUITECTURA_PM_AI_PETSAFE.md`.
Para operar o validar infraestructura de produccion, ver `../docs/PRODUCTION_RUNBOOK.md`.

## Discord

- `Chat Discord PetSafe.json`: entrada principal `POST /webhook/discord-chat`, comandos rápidos, contexto para chat y agente Gemini nativo.
- `Discord Eventos GitHub PetSafe.json`: webhook independiente `POST /webhook/github-event`, normaliza eventos de GitHub, notifica Discord y guarda el evento.
- `Discord Eventos Trello PetSafe.json`: webhook independiente `POST /webhook/trello-event`, normaliza eventos de Trello, notifica Discord y guarda el evento.

## Monitor

- `Monitor PetSafe.json`: schedule principal, cache, recolección Trello/GitHub/Postgres, cálculo de KPIs, snapshots y decisión de alerta.
- `Monitor PetSafe - Alertas IA.json`: workflow hijo llamado por `Monitor PetSafe` cuando hay problemas; genera diagnóstico con nodo Gemini nativo, publica Discord y guarda recomendación.
- `Monitor PetSafe - Error Handler.json`: error workflow separado para alertar fallos de ejecución a Discord.

## Soporte

- `Construir Contexto Robusto.json`: detector programado de deltas/eventos.
- `Reporte PDF Semanal.json`: reporte semanal y on-demand desde Discord.
- `System - DB Seeder (estado_conocido).json`: seed inicial de estado conocido.

## Notas de importación

1. Importar primero workflows hijos/soporte: `Monitor PetSafe - Alertas IA`, `Monitor PetSafe - Error Handler`, eventos Discord, reporte y contexto.
2. Importar después los principales: `Monitor PetSafe` y `Chat Discord PetSafe`.
3. Activar explícitamente los workflows con webhooks/schedules que correspondan en n8n. Los hijos nuevos quedaron `active: false` para evitar duplicar webhooks por accidente al importar.

## Próximo refactor recomendado

Unificar las llamadas IA restantes para que usen nodos nativos como Discord/Monitor:

- `Construir Contexto Robusto`: reemplazar `Gemini Event Analysis1` (`httpRequest`) por `lmChatGoogleGemini` + `chainLlm`.
- `Reporte PDF Semanal`: reemplazar `Gemini Executive Summary` (`httpRequest`) por `lmChatGoogleGemini` + `chainLlm`.
