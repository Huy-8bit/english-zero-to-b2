#!/usr/bin/env bash
# One-time setup: Python virtualenv + backend deps, frontend npm deps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
if command -v uv >/dev/null 2>&1; then
  uv venv -q .venv --python 3.12
  uv pip install -q --python .venv/bin/python -r requirements.txt
else
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
cd "$ROOT/frontend"
npm install
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
echo "Done. Start with: scripts/dev.sh  →  http://localhost:5173"
