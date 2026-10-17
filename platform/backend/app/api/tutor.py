"""Optional AI tutor. Disabled unless Anthropic credentials are configured on the server.

The browser never sees an API key. The tutor gets the current slide as context;
answer keys are included only for items the learner has already submitted.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import config
from ..content.md import strip_md
from ..content.store import ContentStore
from ..models import User
from ..schemas import TutorIn
from ..services.progress import latest_attempts
from .deps import current_user, get_db, get_store

router = APIRouter(prefix="/api/tutor", tags=["tutor"])

SYSTEM = (
    "You are a patient English tutor for Vietnamese learners (CEFR A0–B2). Explain in Vietnamese, "
    "keep English examples in English, and stay close to the lesson content you are given. "
    "Keep answers short (under 200 words) unless asked for practice. "
    "Never reveal the answer to an exercise item whose answer key is not included in the context: "
    "the learner has not submitted it yet. Give hints instead. "
    "If you generate extra practice, say it is new practice written by the AI, not from the curriculum."
)

ACTIONS = {
    "explain": "Giải thích khái niệm trong slide này.",
    "example": "Cho tôi thêm một ví dụ khác (kèm dịch tiếng Việt).",
    "simpler": "Giải thích lại bằng tiếng Việt đơn giản hơn.",
    "why_wrong": "Vì sao câu trả lời của tôi chưa đúng?",
    "practice": "Tạo 3 câu luyện tập thêm cho nội dung này, đáp án để ở cuối.",
    "quiz_me": "Hỏi tôi 2 câu ngắn để kiểm tra tôi đã hiểu chưa (đừng đưa đáp án ngay).",
    "free": "",
}


def enabled() -> bool:
    if os.environ.get("TUTOR_ENABLED", "").lower() in ("0", "false", "no"):
        return False
    return bool(config.ANTHROPIC_API_KEY or os.environ.get("ANTHROPIC_AUTH_TOKEN") or
                os.environ.get("TUTOR_ENABLED", "").lower() in ("1", "true", "yes"))


@router.get("/status")
def status():
    return {"enabled": enabled(), "model": config.TUTOR_MODEL if enabled() else None}


def build_context(store: ContentStore, db: Session, user: User, body: TutorIn) -> str:
    b = store.built(body.unit_id)
    if b is None:
        raise HTTPException(404, "Lesson not found")
    parts = [f"Lesson: {b.unit.id} — {b.unit.title} ({b.unit.title_vi}), level {b.unit.level or '-'}"]
    step = b.steps[body.step_index] if body.step_index is not None and body.step_index < len(b.steps) else None
    submitted = latest_attempts(db, user.id, body.unit_id)
    if step:
        parts.append(f"Current slide: {step['title']}")
        if step.get("md"):
            parts.append(step["md"][:6000])
        for ex in step.get("examples", [])[:12]:
            parts.append(f"Example: {strip_md(ex['en'])} — {strip_md(ex['vi'])}")
        for m in step.get("mistakes", [])[:10]:
            parts.append(f"Mistake: {strip_md(m['wrong'])} → {strip_md(m['right'])}")
        for it in step.get("items", []):
            line = f"Exercise {it['label']}: {strip_md(it['prompt_md'])}"
            att = submitted.get(it["id"])
            if att is not None:
                si = b.items[it["id"]]
                line += f"\n  Learner answered: {att.response!r} (verdict: {att.verdict}); answer key: {strip_md(si.model_md)}"
            else:
                line += "\n  (not submitted yet — do not reveal the answer)"
            parts.append(line)
    if body.action == "why_wrong":
        if not body.item_id or body.item_id not in submitted:
            raise HTTPException(409, "Hãy nộp câu trả lời trước khi hỏi vì sao sai.")
    return "\n\n".join(parts)


@router.post("/ask")
def ask(body: TutorIn, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    if not enabled():
        raise HTTPException(503, "AI tutor is not configured on this server.")
    import anthropic

    context = build_context(store, db, user, body)
    question = (ACTIONS[body.action] + ("\n" + body.message if body.message else "")).strip() or body.message
    if body.item_id:
        question += f"\n(Liên quan đến bài tập {body.item_id.split(':', 1)[-1]})"
    client = anthropic.Anthropic()
    try:
        response = client.beta.messages.create(
            model=config.TUTOR_MODEL,
            max_tokens=4000,
            system=SYSTEM,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[{"role": "user", "content": f"<lesson_context>\n{context}\n</lesson_context>\n\n{question}"}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(503, "AI tutor credentials are invalid.")
    except anthropic.RateLimitError:
        raise HTTPException(429, "AI tutor is busy, try again shortly.")
    except anthropic.APIStatusError as e:
        raise HTTPException(502, f"AI tutor error ({e.status_code}).")
    except anthropic.APIConnectionError:
        raise HTTPException(502, "Cannot reach the AI service.")
    if response.stop_reason == "refusal":
        return {"answer": "Gia sư AI không thể trả lời yêu cầu này. Hãy thử diễn đạt lại câu hỏi.", "refused": True}
    text = "".join(b.text for b in response.content if b.type == "text")
    return {"answer": text, "refused": False, "model": response.model}
