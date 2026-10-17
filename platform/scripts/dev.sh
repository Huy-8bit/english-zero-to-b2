#!/usr/bin/env bash
# Start backend (FastAPI :8000) and frontend (Vite :5173) for local development.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ ! -x backend/.venv/bin/python ]; then
  echo "Run scripts/setup.sh first." >&2
  exit 1
fi
(cd backend && .venv/bin/uvicorn app.main:app --reload --port "${API_PORT:-8000}") &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
cd frontend && npm run dev -- --port "${WEB_PORT:-5173}"
