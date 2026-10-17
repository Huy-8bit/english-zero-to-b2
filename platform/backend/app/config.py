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
CONTENT_RELOAD_SECONDS = float(os.environ.get("CONTENT_RELOAD_SECONDS", "3"))


def _media_dir() -> Path:
    explicit = os.environ.get("MEDIA_DIR")
    if explicit:
        return Path(explicit).resolve()
    if DATABASE_URL.startswith("sqlite:///") and ":memory:" not in DATABASE_URL:
        return Path(DATABASE_URL.replace("sqlite:///", "", 1)).resolve().parent / "media"
    return PLATFORM_DIR / "backend" / "data" / "media"


MEDIA_DIR = _media_dir()
APP_ACCESS_TOKEN = os.environ.get("APP_ACCESS_TOKEN", "").strip()
