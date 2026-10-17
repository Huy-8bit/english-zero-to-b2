from __future__ import annotations

from ..content.builder import ServerItem
from ..models import Attempt


def result_payload(item: ServerItem, attempt: Attempt) -> dict:
    """What the learner sees after submitting: verdict + the source's answer and explanation."""
    return {
        "item_id": item.id,
        "attempt_id": attempt.id,
        "response": attempt.response,
        "verdict": attempt.verdict,
        "auto": attempt.auto,
        "self_correct": attempt.self_correct,
        "correct_option": item.correct_option if item.kind in ("mc", "tfng", "choice", "multi") else None,
        "model_md": item.model_md,
        "explanation_md": item.explanation_md,
        "review": item.review,
        "has_key": item.key is not None,
    }
