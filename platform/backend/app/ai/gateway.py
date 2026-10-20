"""Single entry point for AI calls: limits, rate limiting, caching, usage + cost logging."""
from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import defaultdict, deque
from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from ..models import AICache, AIUsageLog, LearningProfile, utcnow
from .errors import AIBudgetExceeded, AIConfigError, AIDailyLimit, AIDisabled, AIError, AIRateLimited
from .provider import AIProvider, Usage
from .settings import AISettings, estimate_cost


log = logging.getLogger(__name__)


class AIGateway:
    def __init__(self, settings: AISettings, provider: AIProvider, session_factory: sessionmaker):
        self.settings = settings
        self.provider = provider
        self.session_factory = session_factory
        self._calls: dict[int, deque] = defaultdict(deque)
        self._lock = threading.Lock()
        self._pending: list[dict] = []

    # ---------------------------------------------------------------- limits
    def limits(self, db: Session, user_id: int) -> dict:
        p = db.get(LearningProfile, user_id)
        s = self.settings
        return {
            "ai_enabled": True if p is None else p.ai_enabled,
            "daily_request_limit": min(p.daily_request_limit, s.daily_request_limit) if p and p.daily_request_limit else s.daily_request_limit,
            "monthly_budget_usd": min(p.monthly_budget_usd, s.monthly_budget_usd) if p and p.monthly_budget_usd is not None else s.monthly_budget_usd,
            "max_audio_seconds": min(p.max_audio_seconds, s.max_audio_seconds) if p and p.max_audio_seconds else s.max_audio_seconds,
            "max_exercise_count": min(p.max_exercise_count, s.max_exercise_count) if p and p.max_exercise_count else s.max_exercise_count,
            "rate_limit_per_minute": s.rate_limit_per_minute,
        }

    def usage_summary(self, db: Session, user_id: int) -> dict:
        now = utcnow()
        day0 = datetime(now.year, now.month, now.day)
        month0 = datetime(now.year, now.month, 1)
        def agg(since):
            row = db.execute(select(func.count(AIUsageLog.id), func.coalesce(func.sum(AIUsageLog.cost_usd), 0.0))
                             .where(AIUsageLog.user_id == user_id, AIUsageLog.created_at >= since, AIUsageLog.status != "cached")).one()
            return int(row[0]), float(row[1])
        return {"today_requests": agg(day0)[0], "today_cost": agg(day0)[1], "month_requests": agg(month0)[0], "month_cost": agg(month0)[1]}

    def check(self, db: Session, user_id: int) -> None:
        if not self.settings.enabled:
            raise AIDisabled()
        lim = self.limits(db, user_id)
        if not lim["ai_enabled"]:
            raise AIDisabled()
        with self._lock:
            q = self._calls[user_id]
            now = time.monotonic()
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= lim["rate_limit_per_minute"]:
                raise AIRateLimited()
            q.append(now)
        u = self.usage_summary(db, user_id)
        with self._lock:
            queued = [r for r in self._pending if r["user_id"] == user_id and r["status"] != "cached"]
        u["today_requests"] += len(queued)
        u["month_cost"] += sum(r["cost_usd"] for r in queued)
        if u["today_requests"] >= lim["daily_request_limit"]:
            raise AIDailyLimit()
        if lim["monthly_budget_usd"] is not None and u["month_cost"] >= lim["monthly_budget_usd"]:
            raise AIBudgetExceeded()

    # ---------------------------------------------------------------- logging
    def _log(self, user_id: int, feature: str, model: str, usage: Usage | None, status: str, error_code: str | None = None) -> None:
        """Queue a usage record. Written by flush_logs() after the request's DB session is closed, in its own
        transaction — so it survives a rolled-back request and never waits on the request's SQLite write lock."""
        usage = usage or Usage()
        cost = 0.0 if status == "cached" else estimate_cost(self.settings, model, usage.input_tokens, usage.output_tokens, usage.audio_seconds)
        with self._lock:
            self._pending.append(dict(user_id=user_id, feature=feature, model=model, input_tokens=usage.input_tokens,
                                      output_tokens=usage.output_tokens, audio_seconds=usage.audio_seconds, characters=usage.characters,
                                      cost_usd=cost, latency_ms=usage.latency_ms, status=status, error_code=error_code,
                                      created_at=utcnow()))

    def flush_logs(self) -> None:
        with self._lock:
            rows, self._pending = self._pending, []
        if not rows:
            return
        try:
            with self.session_factory() as s:
                s.add_all([AIUsageLog(**r) for r in rows])
                s.commit()
        except Exception:  # noqa: BLE001 — logging must never break learning
            import logging

            logging.getLogger("english.ai").exception("could not write AI usage logs")

    def _guard(self, db: Session, feature: str) -> None:
        """An AI call takes seconds to minutes. If the request already wrote to SQLite, its write lock would be held all
        that time and every other writer (heartbeats, usage logs, other tabs) fails with "database is locked".
        Services must call AI first and write afterwards (or commit before). Tests (fake provider) fail loudly."""
        try:
            raw = db.connection().connection.driver_connection
        except Exception:  # noqa: BLE001 — non-SQLite or closed session: nothing to check
            return
        if getattr(raw, "in_transaction", False):
            if self.settings.provider == "fake":
                raise AssertionError(f"AI call '{feature}' while holding a database write transaction")
            log.warning("AI call %s while holding a database write transaction", feature)

    def _run(self, db: Session, user_id: int, feature: str, model: str, fn):
        if model not in self.settings.pricing:
            raise AIConfigError("model pricing missing; configure OPENAI_PRICING_JSON")
        self._guard(db, feature)
        self.check(db, user_id)
        try:
            result, usage = fn()
        except AIError as e:
            self._log(user_id, feature, model, None, "error", e.code)
            raise
        except Exception:
            self._log(user_id, feature, model, None, "error", "unexpected")
            raise
        self._log(user_id, feature, model, usage, "ok")
        return result, usage

    # ---------------------------------------------------------------- cache
    @staticmethod
    def cache_key(*parts: str) -> str:
        return hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()

    def _cache_get(self, db: Session, key: str):
        row = db.get(AICache, key)
        if row is not None:
            row.hits += 1
        return row

    def _cache_put(self, db: Session, key: str, feature: str, model: str, payload: dict) -> None:
        if db.get(AICache, key) is None:
            db.add(AICache(key=key, feature=feature, model=model, payload=payload))

    # ---------------------------------------------------------------- public calls
    def structured(self, db: Session, user_id: int, *, feature: str, task: str, instructions: str, input: str,
                   schema: type[BaseModel], max_output_tokens: int, cache: bool = False):
        if not self.settings.enabled or not self.limits(db, user_id)["ai_enabled"]:
            raise AIDisabled()
        model = self.settings.model(task)
        key = self.cache_key(self.provider.name, str(user_id), feature, model, schema.__name__, instructions, input) if cache else None
        if key and (hit := self._cache_get(db, key)) is not None:
            self._log(user_id, feature, model, None, "cached")
            return schema.model_validate(hit.payload)
        result, _ = self._run(db, user_id, feature, model, lambda: self.provider.structured(
            model=model, instructions=instructions, input=input, schema=schema, max_output_tokens=max_output_tokens))
        if key:
            self._cache_put(db, key, feature, model, result.model_dump(mode="json"))
        return result

    def text(self, db: Session, user_id: int, *, feature: str, task: str, instructions: str, input: str,
             max_output_tokens: int, cache: bool = False) -> str:
        if not self.settings.enabled or not self.limits(db, user_id)["ai_enabled"]:
            raise AIDisabled()
        model = self.settings.model(task)
        key = self.cache_key(self.provider.name, str(user_id), feature, model, "text", instructions, input) if cache else None
        if key and (hit := self._cache_get(db, key)) is not None:
            self._log(user_id, feature, model, None, "cached")
            return hit.payload["text"]
        text, _ = self._run(db, user_id, feature, model, lambda: self.provider.text(
            model=model, instructions=instructions, input=input, max_output_tokens=max_output_tokens))
        if key:
            self._cache_put(db, key, feature, model, {"text": text})
        return text

    def transcribe(self, db: Session, user_id: int, *, feature: str, audio: bytes, filename: str, prompt: str = "",
                   duration_hint: float | None = None) -> str:
        from .audio_validation import audio_duration
        from .errors import AIBadInput

        if not audio or len(audio) > self.settings.max_audio_bytes:
            raise AIBadInput("File ghi âm rỗng hoặc quá lớn.")
        if self.settings.provider != "fake":
            duration_hint = audio_duration(audio, self.limits(db, user_id)["max_audio_seconds"])
        model = self.settings.model("transcription")
        def fn():
            text, usage = self.provider.transcribe(model=model, audio=audio, filename=filename, prompt=prompt)
            if not usage.audio_seconds and not usage.input_tokens and duration_hint:
                usage.audio_seconds = duration_hint
            return text, usage
        text, _ = self._run(db, user_id, feature, model, fn)
        return text

    def transcribe_words(self, db: Session, user_id: int, *, feature: str, audio: bytes, filename: str,
                         duration_hint: float | None = None) -> tuple[str, list[tuple[str, float]], float | None]:
        """Unprompted transcription with per-word confidence (pronunciation checks). Returns (text, words, seconds)."""
        from .audio_validation import audio_duration
        from .errors import AIBadInput

        if not audio or len(audio) > self.settings.max_audio_bytes:
            raise AIBadInput("File ghi âm rỗng hoặc quá lớn.")
        if self.settings.provider != "fake":
            duration_hint = audio_duration(audio, self.limits(db, user_id)["max_audio_seconds"])
        model = self.settings.model("pronunciation")

        def fn():
            text, words, usage = self.provider.transcribe_words(model=model, audio=audio, filename=filename)
            if not usage.audio_seconds and not usage.input_tokens and duration_hint:
                usage.audio_seconds = duration_hint
            return (text, words), usage
        (text, words), _ = self._run(db, user_id, feature, model, fn)
        return text, words, duration_hint

    def speech(self, db: Session, user_id: int, *, feature: str, text: str, voice: str | None = None, instructions: str = "") -> bytes:
        model = self.settings.model("tts")
        audio, _ = self._run(db, user_id, feature, model, lambda: self.provider.speech(
            model=model, text=text, voice=voice or self.settings.tts_voice, instructions=instructions))
        return audio

    def speech_many(self, db: Session, user_id: int, *, feature: str, items: list[tuple[str, str, str]], workers: int = 6) -> list[bytes]:
        """TTS for several texts in parallel — e.g. every line of a listening dialogue. Counts as one request for the
        per-minute rate limit (one learner action); each line's usage and cost is still logged."""
        if not items:
            return []
        model = self.settings.model("tts")
        if model not in self.settings.pricing:
            raise AIConfigError("model pricing missing; configure OPENAI_PRICING_JSON")
        self._guard(db, feature)
        self.check(db, user_id)

        def one(it: tuple[str, str, str]) -> bytes:
            text, voice, instructions = it
            try:
                audio, usage = self.provider.speech(model=model, text=text, voice=voice, instructions=instructions)
            except AIError as e:
                self._log(user_id, feature, model, None, "error", e.code)
                raise
            self._log(user_id, feature, model, usage, "ok")
            return audio
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor(max_workers=max(1, min(workers, len(items)))) as ex:
            return list(ex.map(one, items))

    def realtime_secret(self, db: Session, user_id: int, *, instructions: str, voice: str | None = None) -> dict:
        model = self.settings.model("realtime")
        ttl = max(60, min(600, self.settings.realtime_max_seconds + 60))
        secret, _ = self._run(db, user_id, "speaking_realtime", model, lambda: (self.provider.realtime_secret(
            model=model, instructions=instructions, voice=voice or self.settings.tts_voice, ttl_seconds=ttl), Usage()))
        return {**secret, "model": model, "max_seconds": self.settings.realtime_max_seconds}

    def log_realtime_minutes(self, user_id: int, seconds: float) -> None:
        self._log(user_id, "speaking_realtime", self.settings.model("realtime"), Usage(audio_seconds=seconds), "ok")

    def embed(self, db: Session, user_id: int, texts: list[str]) -> list[list[float]]:
        model = self.settings.model("embedding")
        vecs, _ = self._run(db, user_id, "embedding", model, lambda: self.provider.embed(model=model, texts=texts))
        return vecs


def stable_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, default=str)
