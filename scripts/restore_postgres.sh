#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  printf 'Usage: CONFIRM_RESTORE=I_UNDERSTAND %s <backup.dump>\n' "$0" >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "I_UNDERSTAND" ]]; then
  printf 'Refusing to restore without CONFIRM_RESTORE=I_UNDERSTAND\n' >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Missing %s\n' "$ENV_FILE" >&2
  exit 1
fi

load_env_file() {
  local file="$1"
  local line key value

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    line="${line#export }"
    [[ "$line" == *=* ]] || continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$file"
}

load_env_file "$ENV_FILE"

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

cat "$BACKUP_FILE" | docker compose exec -T postgres pg_restore \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges

printf 'Restore completed from %s\n' "$BACKUP_FILE"
