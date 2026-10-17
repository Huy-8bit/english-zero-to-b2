"""AI configuration from environment variables. Business code never hardcodes model names."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from .. import config  # noqa: F401  (loads platform/.env)

TASKS = ("tutor", "exercise", "grading", "complex_grading", "transcription", "tts", "realtime", "embedding")

DEFAULT_MODELS = {
    # Cost-aware defaults chosen from the OpenAI pricing page (Oct 2026); override per deployment.
    "tutor": "gpt-5.4-mini",
    "exercise": "gpt-5.4-mini",
    "grading": "gpt-5.4-mini",
    "complex_grading": "gpt-6.1-sol",
    "transcription": "gpt-4o-mini-transcribe",
    "tts": "gpt-4o-mini-tts",
    "realtime": "gpt-realtime-mini",
    "embedding": "text-embedding-3-small",
}

# USD per 1M tokens (input, output). Audio models: per-minute estimate in "per_minute".
# Source: developers.openai.com/api/docs/pricing (checked 2026-10-17). Override with OPENAI_PRICING_JSON.
DEFAULT_PRICING: dict[str, dict[str, float]] = {
    "gpt-5.4-mini": {"input": 0.75, "output": 4.50},
    "gpt-5.4-nano": {"input": 0.20, "output": 1.25},
    "gpt-6.1-sol": {"input": 2.00, "output": 10.00},
    "gpt-6-sol": {"input": 2.00, "output": 10.00},
    "gpt-6-luna": {"input": 0.10, "output": 0.50},
    "gpt-5.6-luna": {"input": 0.20, "output": 1.20},
    "gpt-5.6-terra": {"input": 2.00, "output": 12.00},
    "gpt-5.6-sol": {"input": 4.00, "output": 20.00},
    "gpt-6-astra": {"input": 10.00, "output": 50.00},
    "gpt-4o-mini-transcribe": {"input": 1.25, "output": 5.00, "per_minute": 0.003},
    "gpt-4o-transcribe": {"input": 2.50, "output": 10.00, "per_minute": 0.006},
    "gpt-4o-mini-tts": {"input": 0.60, "output": 12.00, "per_minute": 0.015},
    "gpt-realtime-mini": {"input": 10.00, "output": 20.00, "per_minute": 0.10},
    "gpt-realtime": {"input": 32.00, "output": 64.00, "per_minute": 0.30},
    "text-embedding-3-small": {"input": 0.02, "output": 0.0},
}


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass
class AISettings:
    provider: str = "openai"  # openai | fake (tests/E2E only) | disabled
    api_key: str = field(default="", repr=False)  # never printed in reprs, logs or test failures
    models: dict[str, str] = field(default_factory=dict)
    pricing: dict[str, dict[str, float]] = field(default_factory=dict)
    timeout_seconds: float = 45.0
    max_retries: int = 2
    rate_limit_per_minute: int = 12
    daily_request_limit: int = 300
    monthly_budget_usd: float = 10.0
    max_audio_seconds: int = 120
    max_audio_bytes: int = 8 * 1024 * 1024
    max_exercise_count: int = 20
    verify_exercises: bool = True
    store_user_audio: bool = False
    use_embeddings: bool = False
    realtime_max_seconds: int = 300
    tts_voice: str = "marin"
    reasoning_effort: str | None = None

    def model(self, task: str) -> str:
        return self.models[task]

    @property
    def enabled(self) -> bool:
        return self.provider == "fake" or (self.provider == "openai" and bool(self.api_key))


def load_settings() -> AISettings:
    models = {t: os.environ.get(f"OPENAI_MODEL_{t.upper()}", DEFAULT_MODELS[t]).strip() or DEFAULT_MODELS[t] for t in TASKS}
    pricing = dict(DEFAULT_PRICING)
    extra = os.environ.get("OPENAI_PRICING_JSON", "").strip()
    if extra:
        try:
            pricing.update(json.loads(extra))
        except json.JSONDecodeError:
            pass
    provider = os.environ.get("AI_PROVIDER", "openai").strip().lower()
    return AISettings(
        provider=provider,
        api_key=os.environ.get("OPENAI_API_KEY", "").strip(),
        models=models,
        pricing=pricing,
        timeout_seconds=_float("AI_TIMEOUT_SECONDS", 45.0),
        max_retries=_int("AI_MAX_RETRIES", 2),
        rate_limit_per_minute=_int("AI_RATE_LIMIT_PER_MINUTE", 12),
        daily_request_limit=_int("AI_DAILY_REQUEST_LIMIT", 300),
        monthly_budget_usd=_float("AI_MONTHLY_BUDGET_USD", 10.0),
        max_audio_seconds=_int("AI_MAX_AUDIO_SECONDS", 120),
        max_audio_bytes=_int("AI_MAX_AUDIO_MB", 8) * 1024 * 1024,
        max_exercise_count=_int("AI_MAX_EXERCISE_COUNT", 20),
        verify_exercises=os.environ.get("AI_VERIFY_EXERCISES", "true").lower() in ("1", "true", "yes"),
        store_user_audio=os.environ.get("AI_STORE_USER_AUDIO", "false").lower() in ("1", "true", "yes"),
        use_embeddings=os.environ.get("AI_USE_EMBEDDINGS", "false").lower() in ("1", "true", "yes"),
        realtime_max_seconds=_int("AI_REALTIME_MAX_SECONDS", 300),
        tts_voice=os.environ.get("OPENAI_TTS_VOICE", "marin"),
        reasoning_effort=os.environ.get("OPENAI_REASONING_EFFORT") or None,
    )


def estimate_cost(settings: AISettings, model: str, input_tokens: int = 0, output_tokens: int = 0, audio_seconds: float = 0) -> float:
    price = settings.pricing.get(model)
    if not price:
        return 0.0
    if audio_seconds and "per_minute" in price and not (input_tokens or output_tokens):
        return round(price["per_minute"] * audio_seconds / 60, 6)
    return round((input_tokens * price.get("input", 0) + output_tokens * price.get("output", 0)) / 1_000_000, 6)
