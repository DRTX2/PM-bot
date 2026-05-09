# Production Runbook - PetSafe n8n PM AI

Este runbook cubre el baseline de seguridad para operar los workflows PetSafe en un ambiente de produccion o pre-produccion serio.

## 1. Preparacion de secretos

1. Crear `.env` desde `.env.example`.
2. Generar valores fuertes:

```bash
openssl rand -hex 32
```

3. Completar como minimo:

- `N8N_VERSION`
- `N8N_HOST`
- `WEBHOOK_URL`
- `N8N_BASIC_AUTH_USER`
- `N8N_BASIC_AUTH_PASSWORD`
- `N8N_ENCRYPTION_KEY`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- credenciales GitHub, Trello, Gemini, Discord y SMTP

4. Proteger permisos:

```bash
chmod 600 .env
```

Regla: `N8N_VERSION` debe ser una version exacta probada. No usar `latest` en produccion.

Si algun `.env` fue commiteado o trackeado en Git alguna vez, rotar esos secretos antes de usar produccion. Sacar el archivo del indice evita futuros commits accidentales, pero no borra secretos ya presentes en historial remoto.

## 2. Validacion preflight

Ejecutar antes de levantar o actualizar:

```bash
./scripts/security_check.sh
docker compose config
```

Si se esta validando un entorno local sin HTTPS, usar solo temporalmente:

```bash
ALLOW_INSECURE_HTTP=true ./scripts/security_check.sh
```

No usar `ALLOW_INSECURE_HTTP=true` en produccion.

## 3. Arranque seguro

Advertencia para ambientes existentes: este `docker-compose.yml` configura n8n para usar Postgres como base interna. Si el n8n actual estaba usando SQLite en el volumen `n8n_data`, no aplicar `docker compose up -d` directamente sobre produccion sin plan de migracion/export/import de workflows y credenciales.

```bash
docker compose up -d
docker compose ps
```

Verificar readiness:

```bash
curl -fsS http://127.0.0.1:5678/healthz/readiness
```

Si n8n esta detras de reverse proxy, validar tambien:

```bash
curl -fsS https://n8n.example.com/healthz/readiness
```

## 4. Red y exposicion

- Postgres queda publicado solo en `127.0.0.1` por defecto.
- Gotenberg queda publicado solo en `127.0.0.1` por defecto.
- n8n queda publicado solo en `127.0.0.1` por defecto para operar detras de reverse proxy.
- El reverse proxy debe terminar TLS y reenviar hacia `127.0.0.1:5678`.
- No exponer Postgres, Redis ni Gotenberg a internet.

## 5. Base de datos

`init.sql` crea:

- schema `n8n` para metadata interna de n8n.
- tablas operativas del PM AI (`analisis_proyecto`, `estado_tareas`, `eventos_detectados`, `events_inbox`, `events_outbox`, `workflow_runs_audit`, `ai_decisions`, etc.).

Importante: los scripts de inicializacion de Postgres solo corren cuando el volumen `postgres_data` esta vacio. Si el volumen ya existia, aplicar cambios manualmente con `psql` o una migracion controlada.

## 6. Backups

Backup manual:

```bash
./scripts/backup_postgres.sh
```

Backup con ruta explicita:

```bash
./scripts/backup_postgres.sh backups/pre-deploy.dump
```

Politica recomendada:

- Backup antes de cada despliegue.
- Backup diario retenido 7 dias.
- Backup semanal retenido 8 semanas.
- Probar restore al menos una vez por sprint.

## 7. Restore

Restore es destructivo. Requiere confirmacion explicita:

```bash
CONFIRM_RESTORE=I_UNDERSTAND ./scripts/restore_postgres.sh backups/pre-deploy.dump
```

Antes de restaurar produccion:

- detener workflows que escriben datos;
- tomar backup nuevo;
- registrar incidente/cambio;
- validar version de schema.

## 8. Hardening n8n

Configuracion aplicada en `docker-compose.yml`:

- Postgres como DB de n8n (`DB_TYPE=postgresdb`).
- `N8N_ENCRYPTION_KEY` obligatorio.
- cookies seguras por defecto.
- permisos estrictos del settings file.
- bloqueo de acceso a archivos internos de `.n8n`.
- Git bare repositories deshabilitados.
- task runners internos habilitados.
- metrics endpoint habilitado.
- healthcheck readiness.
- pruning de ejecuciones.
- templates deshabilitados.
- logs rotados.
- `no-new-privileges` en servicios.

Pendiente intencional:

- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` porque los workflows actuales usan `$env`. Cuando GitHub/Trello/Gemini/Discord esten en credenciales nativas y exista `System - Config Resolver`, cambiar a `true`.

## 9. Checklist antes de tocar produccion

- `.env` no contiene placeholders.
- `.env` tiene permisos `600`.
- `N8N_VERSION` esta pinneada.
- `N8N_ENCRYPTION_KEY` esta definido y respaldado en vault.
- `WEBHOOK_URL` usa HTTPS.
- `N8N_SECURE_COOKIE=true`.
- `docker compose config` no falla.
- `./scripts/security_check.sh` pasa.
- hay backup reciente.
- se valido restore en staging.
- los workflows criticos tienen error workflow configurado.
- las credenciales GitHub/Trello tienen minimo privilegio.
- Postgres, Redis y Gotenberg no estan expuestos publicamente.

## 10. Referencias oficiales n8n usadas

- Database environment variables.
- Security environment variables.
- Deployment environment variables.
- Task runner environment variables.
- Monitoring endpoints `/healthz`, `/healthz/readiness`, `/metrics`.
- Configuration methods y soporte `_FILE` para secretos.
