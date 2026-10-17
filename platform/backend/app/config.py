"""Runtime configuration, read from environment variables (see .env.example)."""
from __future__ import annotations

import os
from pathlib import Path

PLATFORM_DIR = Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    env = PLATFORM_DIR / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

CONTENT_ROOT = Path(os.environ.get("CONTENT_ROOT", PLATFORM_DIR.parent)).resolve()
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{PLATFORM_DIR / 'backend' / 'data' / 'english.db'}")
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
TUTOR_MODEL = os.environ.get("TUTOR_MODEL", "claude-opus-5-5")
CONTENT_RELOAD_SECONDS = float(os.environ.get("CONTENT_RELOAD_SECONDS", "3"))
