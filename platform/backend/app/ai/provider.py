"""Provider interface + the OpenAI implementation (official SDK, Responses API).

Every AI feature goes through this interface, so tests can swap in a fake provider.
The OpenAI SDK retries transient errors (408/409/429/5xx, connection errors) with exponential
backoff; here we only configure timeout/max_retries and translate errors.
"""
from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from .errors import AIConfigError, AIInvalidOutput, AIQuotaExceeded, AITimeout, AIUnavailable
from .settings import AISettings

T = TypeVar("T", bound=BaseModel)


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    audio_seconds: float = 0.0
    characters: int = 0
    latency_ms: int = 0


class AIProvider(Protocol):
    name: str

    def structured(self, *, model: str, instructions: str, input: str, schema: type[T], max_output_tokens: int) -> tuple[T, Usage]: ...
    def text(self, *, model: str, instructions: str, input: str, max_output_tokens: int) -> tuple[str, Usage]: ...
    def transcribe(self, *, model: str, audio: bytes, filename: str, prompt: str = "") -> tuple[str, Usage]: ...
    def speech(self, *, model: str, text: str, voice: str, instructions: str = "") -> tuple[bytes, Usage]: ...
    def transcribe_words(self, *, model: str, audio: bytes, filename: str) -> tuple[str, list[tuple[str, float]], Usage]: ...
    def realtime_secret(self, *, model: str, instructions: str, voice: str, ttl_seconds: int) -> dict: ...
    def embed(self, *, model: str, texts: list[str]) -> tuple[list[list[float]], Usage]: ...
    def list_models(self) -> list[str]: ...


class OpenAIProvider:
    name = "openai"

    def __init__(self, settings: AISettings):
        import openai

        self._openai = openai
        self.settings = settings
        self.client = openai.OpenAI(api_key=settings.api_key, timeout=settings.timeout_seconds, max_retries=settings.max_retries)

    # -------------------------------------------------------------- error mapping
    def _translate(self, exc: Exception) -> Exception:
        o = self._openai
        if isinstance(exc, (ValidationError, o.LengthFinishReasonError, o.ContentFilterFinishReasonError)):
            return AIInvalidOutput("structured response could not be parsed")
        if isinstance(exc, o.APITimeoutError):
            return AITimeout()
        if isinstance(exc, o.APIConnectionError):
            return AIUnavailable()
        if isinstance(exc, o.RateLimitError):
            return AIQuotaExceeded() if (getattr(exc, "code", None) == "insufficient_quota") else AIUnavailable()
        if isinstance(exc, (o.AuthenticationError, o.PermissionDeniedError, o.NotFoundError)):
            return AIConfigError(f"{type(exc).__name__}")
        if isinstance(exc, o.BadRequestError):
            return AIConfigError(f"BadRequest: {getattr(exc, 'code', '')}")
        if isinstance(exc, o.APIStatusError):
            return AIUnavailable()
        return exc

    def _call(self, fn):
        start = time.monotonic()
        try:
            out = fn()
        except Exception as exc:  # noqa: BLE001
            raise self._translate(exc) from None
        return out, int((time.monotonic() - start) * 1000)

    def _reasoning(self) -> dict:
        return {"reasoning": {"effort": self.settings.reasoning_effort}} if self.settings.reasoning_effort else {}

    # -------------------------------------------------------------- text
    def structured(self, *, model, instructions, input, schema, max_output_tokens):
        resp, ms = self._call(lambda: self.client.responses.parse(
            model=model, instructions=instructions, input=input, text_format=schema,
            max_output_tokens=max_output_tokens, store=False, **self._reasoning()))
        parsed = resp.output_parsed
        if parsed is None:
            raise AIInvalidOutput("no parsed output (refusal or truncated)")
        u = resp.usage
        return parsed, Usage(input_tokens=u.input_tokens if u else 0, output_tokens=u.output_tokens if u else 0, latency_ms=ms)

    def text(self, *, model, instructions, input, max_output_tokens):
        resp, ms = self._call(lambda: self.client.responses.create(
            model=model, instructions=instructions, input=input, max_output_tokens=max_output_tokens, store=False,
            **self._reasoning()))
        text = resp.output_text or ""
        if not text.strip():
            raise AIInvalidOutput("empty output")
        u = resp.usage
        return text, Usage(input_tokens=u.input_tokens if u else 0, output_tokens=u.output_tokens if u else 0, latency_ms=ms)

    # -------------------------------------------------------------- audio
    def transcribe(self, *, model, audio, filename, prompt=""):
        kwargs = {"language": "en"}
        if prompt:
            kwargs["prompt"] = prompt[:500]
        tr, ms = self._call(lambda: self.client.audio.transcriptions.create(model=model, file=(filename, audio), **kwargs))
        usage = Usage(latency_ms=ms)
        u = getattr(tr, "usage", None)
        if u is not None:
            if getattr(u, "type", "") == "duration":
                usage.audio_seconds = float(u.seconds)
            else:
                usage.input_tokens = getattr(u, "input_tokens", 0) or 0
                usage.output_tokens = getattr(u, "output_tokens", 0) or 0
        return tr.text, usage

    def transcribe_words(self, *, model, audio, filename):
        """Transcription without any prompt (a prompt would steer the model towards the expected words and hide errors),
        with token log-probabilities grouped into words: [(word, probability)]."""
        tr, ms = self._call(lambda: self.client.audio.transcriptions.create(
            model=model, file=(filename, audio), language="en", response_format="json", include=["logprobs"]))
        words: list[list] = []
        for t in getattr(tr, "logprobs", None) or []:
            tok, p = t.token, math.exp(t.logprob)
            if not words or tok.startswith(" ") or not re.match(r"[A-Za-z0-9']", words[-1][0][-1:] or " "):
                words.append([tok.strip(), p])
            else:
                words[-1][0] += tok
                words[-1][1] = min(words[-1][1], p)
        pairs = [(re.sub(r"[^A-Za-z0-9'’-]", "", w).lower(), round(p, 3)) for w, p in words]  # hyphens kept; split when aligned
        usage = Usage(latency_ms=ms)
        u = getattr(tr, "usage", None)
        if u is not None:
            if getattr(u, "type", "") == "duration":
                usage.audio_seconds = float(u.seconds)
            else:
                usage.input_tokens = getattr(u, "input_tokens", 0) or 0
                usage.output_tokens = getattr(u, "output_tokens", 0) or 0
        return tr.text, [x for x in pairs if x[0]], usage

    def speech(self, *, model, text, voice, instructions=""):
        kwargs = {"instructions": instructions} if instructions else {}
        res, ms = self._call(lambda: self.client.audio.speech.create(
            model=model, voice=voice, input=text[:4000], response_format="mp3", **kwargs))
        words = len(text.split())
        return res.content, Usage(characters=len(text), audio_seconds=round(words / 2.5, 1), latency_ms=ms)

    def realtime_secret(self, *, model, instructions, voice, ttl_seconds):
        res, _ = self._call(lambda: self.client.realtime.client_secrets.create(
            expires_after={"anchor": "created_at", "seconds": ttl_seconds},
            session={"type": "realtime", "model": model, "instructions": instructions, "audio": {"output": {"voice": voice}}}))
        return {"value": res.value, "expires_at": res.expires_at}

    def embed(self, *, model, texts):
        res, ms = self._call(lambda: self.client.embeddings.create(model=model, input=texts))
        return [d.embedding for d in res.data], Usage(input_tokens=res.usage.prompt_tokens, latency_ms=ms)

    def list_models(self):
        res, _ = self._call(lambda: self.client.models.list())
        return sorted(m.id for m in res)


class DisabledProvider:
    name = "disabled"

    def _no(self, *a, **k):
        from .errors import AIDisabled

        raise AIDisabled()

    structured = text = transcribe = transcribe_words = speech = realtime_secret = embed = list_models = _no
