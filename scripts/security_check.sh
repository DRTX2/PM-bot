#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"
ALLOW_INSECURE_HTTP="${ALLOW_INSECURE_HTTP:-false}"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

warn() {
  printf 'WARN: %s\n' "$1" >&2
}

require_key() {
  local key="$1"
  local value="${!key:-}"
  [[ -n "$value" ]] || fail "$key is required"
  [[ "$value" != REPLACE_WITH_* ]] || fail "$key still contains a placeholder"
}

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

if [[ ! -f "$ENV_FILE" ]]; then
  fail "$ENV_FILE not found"
fi

load_env_file "$ENV_FILE"

required_keys=(
  N8N_VERSION
  N8N_HOST
  WEBHOOK_URL
  N8N_BASIC_AUTH_USER
  N8N_BASIC_AUTH_PASSWORD
  N8N_ENCRYPTION_KEY
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  TRELLO_API_KEY
  TRELLO_TOKEN
  TRELLO_BOARD_ID
  GITHUB_TOKEN
  GITHUB_OWNER_BACKEND
  GITHUB_REPO_BACKEND
  GITHUB_REPO_FRONTEND
  GEMINI_API_KEY
  DISCORD_WEBHOOK_URL
)

for key in "${required_keys[@]}"; do
  require_key "$key"
done

[[ "$N8N_VERSION" != "latest" ]] || fail "N8N_VERSION must be pinned to an exact tested release, not latest"
[[ "$N8N_BASIC_AUTH_USER" != "admin" ]] || fail "N8N_BASIC_AUTH_USER must not be admin in production"

for key in N8N_BASIC_AUTH_PASSWORD POSTGRES_PASSWORD N8N_ENCRYPTION_KEY; do
  value="${!key}"
  [[ "$value" != "admin123" ]] || fail "$key uses an insecure default"
  [[ "$value" != "agente123" ]] || fail "$key uses an insecure default"
  [[ "$value" != "change-me" ]] || fail "$key uses an insecure placeholder"
  [[ "$value" != "password" ]] || fail "$key uses an insecure placeholder"
done

[[ "${#N8N_BASIC_AUTH_PASSWORD}" -ge 24 ]] || fail "N8N_BASIC_AUTH_PASSWORD must be at least 24 characters"
[[ "${#POSTGRES_PASSWORD}" -ge 24 ]] || fail "POSTGRES_PASSWORD must be at least 24 characters"
[[ "${#N8N_ENCRYPTION_KEY}" -ge 32 ]] || fail "N8N_ENCRYPTION_KEY must be at least 32 characters"

if [[ "$ALLOW_INSECURE_HTTP" != "true" ]]; then
  [[ "$WEBHOOK_URL" == https://* ]] || fail "WEBHOOK_URL must use https in production"
  [[ "${N8N_PROTOCOL:-https}" == "https" ]] || fail "N8N_PROTOCOL must be https in production"
  [[ "${N8N_SECURE_COOKIE:-true}" == "true" ]] || fail "N8N_SECURE_COOKIE must be true in production"
fi

if [[ "${N8N_BLOCK_ENV_ACCESS_IN_NODE:-false}" != "true" ]]; then
  warn "N8N_BLOCK_ENV_ACCESS_IN_NODE is false because current workflows still depend on \$env. Migrate to managed credentials/config resolver before enabling it."
fi

if [[ -e init.sql && ! -f init.sql ]]; then
  fail "init.sql exists but is not a regular file"
fi

if command -v stat >/dev/null 2>&1; then
  perms="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
  if [[ -n "$perms" && "$perms" != "600" && "$perms" != "400" ]]; then
    warn "$ENV_FILE permissions are $perms; recommended: chmod 600 $ENV_FILE"
  fi
fi

printf 'Security baseline check passed for %s\n' "$ENV_FILE"
