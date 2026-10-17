#!/usr/bin/env bash
# Run from any directory. Build first; snapshot the stopped DB before migrations.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
docker compose build
WAS_RUNNING="$(docker compose ps --status running -q backend)"
EXISTING_VOLUME="$(docker volume ls -q --filter label=com.docker.compose.volume=learning-data)"
# Inspect the configured volume rather than relying on directory/project naming.
PYTHON="${PYTHON_BIN:-$ROOT/backend/.venv/bin/python}"
[[ -x "$PYTHON" ]] || PYTHON=python3
VOLUME="$(docker compose config --format json | "$PYTHON" -c 'import json,sys; print(json.load(sys.stdin)["volumes"]["learning-data"]["name"])')"
for CONTAINER in $(docker compose ps -a -q backend); do
  MOUNTED="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$CONTAINER")"
  if [[ "$MOUNTED" != "$VOLUME" ]]; then
    echo 'Configured data volume differs from the existing backend. Deployment aborted; keep LEARNING_DATA_VOLUME unchanged.' >&2
    exit 1
  fi
done
if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  docker compose stop -t 60 backend
  if ! "$ROOT/scripts/backup-db.sh"; then
    echo 'Backup failed. Deployment aborted before migrations.' >&2
    if [[ -n "$WAS_RUNNING" ]]; then docker compose start --wait --wait-timeout 120 backend; fi
    exit 1
  fi
elif [[ -n "$EXISTING_VOLUME" && "${ALLOW_NEW_DATABASE:-0}" != 1 ]]; then
  echo 'Another learning-data volume exists. Set LEARNING_DATA_VOLUME to the existing volume, or ALLOW_NEW_DATABASE=1 for an intentional fresh installation.' >&2
  exit 1
fi
# Recreate nginx too so its upstream DNS cannot retain the old backend IP.
docker compose up -d --force-recreate --wait --wait-timeout 120
docker compose exec -T frontend wget -q -O /dev/null http://127.0.0.1/api/health
echo 'Deployment healthy. Existing database and media stay in the named volume.'
