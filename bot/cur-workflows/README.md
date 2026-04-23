# Cur Workflows: Estado General

Este folder (`bot/cur-workflows/`) contiene los workflows que hoy estan desplegados en n8n.

## Inventario actual

| Workflow | Archivo | ID n8n | Activo | Trigger principal |
|---|---|---|---|---|
| Chat Discord PetSafe | `Chat Discord PetSafe.json` | `ePBXQgBFS8BKvIPS` | Si | Webhooks (`discord-chat`, `trello-event`, `github-event`) |
| Construir Contexto Robusto | `Construir Contexto Robusto.json` | `Dgobg3vMcRWaNPkA` | Si | Schedule por minutos |
| Monitor PetSafe | `Monitor PetSafe.json` | `Q4GWX9tgUGXv8rek` | Si | Schedule cada 30 min |
| Reporte PDF Semanal | `Reporte PDF Semanal.json` | `joddDTQkcp6U7mT9` | Si | Cron viernes 18:00 + trigger on-demand |
| System - DB Seeder (estado_conocido) | `System - DB Seeder (estado_conocido).json` | `aXOczDpgOsgmRulm` | No | Manual trigger |

## Arquitectura funcional (resumen)

1. `Monitor PetSafe` genera estado periodico y escribe en `analisis_proyecto` / `estado_tareas`.
2. `Chat Discord PetSafe` consume ese estado para responder comandos y chat contextual.
3. `Construir Contexto Robusto` detecta deltas y registra eventos en `eventos_detectados`.
4. `Reporte PDF Semanal` consume analitica + eventos + GitHub para generar y distribuir PDF.
5. `System - DB Seeder` inicializa `estado_conocido` (necesario para detector de deltas).

## Dependencias compartidas

- Env vars: `TRELLO_*`, `GITHUB_*`, `GEMINI_API_KEY`, `DISCORD_WEBHOOK_URL`.
- Infra: Postgres, acceso API Trello/GitHub/Gemini.
- Extras para reporte: `GOTENBERG_URL`, SMTP, (opcional) credencial Discord Bot.

## Credenciales usadas en los JSON actuales

- Postgres: `Postgres account` (`upx1y0H6Nw7XOqLJ`)
- SMTP: `SMTP account` (`a8FFW4GlCOssGKKe`)
- Discord Bot (solo en reporte): `Discord Bot account` (`zFc4flszXSfcReRJ`)

## Relacion con la documentacion en `bot/`

Documentacion de referencia historica:

- `bot/workflow1_monitor.md`
- `bot/workflow2_chat_discord.md`
- `bot/workflow3_delta_detector.md`
- `bot/workflow4_reporte_pdf.md`
- `bot/inconsistencias y demas.md`

Estado actualizado de despliegue:

- `bot/cur-workflows/ESTADO_POR_WORKFLOW.md`
- `bot/cur-workflows/PENDIENTES_SISTEMA_N8N.md`

