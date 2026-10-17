"""Audio files on disk (TTS cache, listening exercises, optional learner recordings)."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .. import config

SAFE = re.compile(r"^[a-z]+/[A-Za-z0-9_.\-/]+\.(mp3|webm|ogg|wav|m4a)$")


def media_root() -> Path:
    root = config.MEDIA_DIR
    root.mkdir(parents=True, exist_ok=True)
    return root


def tts_name(model: str, voice: str, text: str, instructions: str = "", *, provider: str = "openai") -> str:
    return "tts/" + hashlib.sha256(f"{provider}|{model}|{voice}|{instructions}|{text}".encode()).hexdigest()[:40] + ".mp3"


def write(rel: str, data: bytes) -> str:
    if not SAFE.fullmatch(rel) or ".." in rel:
        raise ValueError("invalid media path")
    p = (media_root() / rel).resolve()
    p.relative_to(media_root().resolve())
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    return rel


def exists(rel: str) -> bool:
    return (media_root() / rel).is_file()


def resolve(rel: str) -> Path | None:
    if not SAFE.match(rel) or ".." in rel:
        return None
    p = (media_root() / rel).resolve()
    try:
        p.relative_to(media_root().resolve())
    except ValueError:
        return None
    return p if p.is_file() else None


def delete(rel: str | None) -> None:
    if rel and (p := resolve(rel)):
        p.unlink(missing_ok=True)
