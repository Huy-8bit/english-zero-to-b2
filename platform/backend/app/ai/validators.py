"""Checks on AI-generated exercises beyond JSON schema validity.

Structural checks run in code (options, answer consistency, ordering tokens, duplicates, evidence quotes
copied from the passage, Vietnamese explanation). Semantic checks (is the question answerable with exactly
one answer?) are done by an independent blind-solve pass in exercises.py.
"""
from __future__ import annotations

import re

from ..content.md import fold
from ..services.grading import normalize
from .schemas import GenQuestion

MC_TYPES = {"multiple_choice", "contextual_grammar", "reading_comprehension", "listening_comprehension"}
SHORT_DET_TYPES = {"fill_blank", "verb_conjugation"}
OPEN_TYPES = {"error_correction", "sentence_transformation", "translation_vi_en", "translation_en_vi", "short_answer", "sentence_writing"}
TF_VALUES = {"true", "false", "not given"}


def is_choice(q: GenQuestion) -> bool:
    return q.question_type in MC_TYPES and bool(q.options) or q.question_type == "true_false"


def has_vietnamese(text: str) -> bool:
    return fold(text) != text.lower()


def norm_quote(text: str) -> str:
    t = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", t).strip().lower().strip(" .\"'")


def validate_question(q: GenQuestion, *, allowed_types: set[str] | None, passage: str | None) -> str | None:
    """Return a rejection reason, or None if the question is structurally sound."""
    t = q.question_type
    if allowed_types and t not in allowed_types:
        return f"type {t} not requested"
    text = q.question_text.strip()
    if not text or len(text) > 700:
        return "empty or too long question"
    if not q.explanation_vi.strip() or not has_vietnamese(q.explanation_vi):
        return "explanation_vi missing or not Vietnamese"
    if t == "true_false":
        opts = [o.strip().lower() for o in q.options]
        if len(opts) not in (2, 3) or len(set(opts)) != len(opts) or not set(opts) <= TF_VALUES or q.correct_option_index is None or not 0 <= q.correct_option_index < len(opts):
            return "invalid true/false options"
    elif t in MC_TYPES and q.options:
        opts = [normalize(o) for o in q.options]
        if not 3 <= len(opts) <= 5 or any(not o for o in opts) or len(set(opts)) != len(opts):
            return "multiple choice needs 3–5 distinct options"
        if q.correct_option_index is None or not 0 <= q.correct_option_index < len(opts):
            return "correct option index out of range"
    elif t in MC_TYPES and not q.options:
        if not q.correct_answers:
            return "open comprehension question without reference answer"
    elif t in SHORT_DET_TYPES:
        if "_" not in text:
            return "fill-in question without a blank"
        if not q.correct_answers or any(not a.strip() or len(a.split()) > 6 for a in q.correct_answers):
            return "fill-in needs short acceptable answers"
    elif t == "error_correction":
        if not q.correct_answers:
            return "error correction without corrected sentence"
        if any(normalize(a) == normalize(text) for a in q.correct_answers):
            return "corrected sentence equals the wrong sentence"
    elif t == "sentence_ordering":
        if len(q.ordering_tokens) < 3 or not q.correct_answers:
            return "ordering needs ≥3 tokens and the sentence"
        tokens = sorted(normalize(" ".join(q.ordering_tokens)).split())
        answer = sorted(normalize(q.correct_answers[0]).split())
        if tokens != answer:
            return "ordering tokens do not form the answer sentence"
    elif t == "matching":
        pairs = q.matching_pairs
        if not 3 <= len(pairs) <= 6:
            return "matching needs 3–6 pairs"
        if len({normalize(p.left) for p in pairs}) != len(pairs) or len({normalize(p.right) for p in pairs}) != len(pairs):
            return "matching pairs are not unique"
    elif t in OPEN_TYPES:
        if not q.correct_answers and not (q.answer_criteria or "").strip():
            return "open question without reference answer or criteria"
    if t in ("reading_comprehension", "listening_comprehension") or (passage and (t == "true_false" or q.evidence_quote)):
        if not q.evidence_quote:
            return "comprehension question without evidence quote"
        source = passage or q.context_passage or ""
        if not norm_quote(q.evidence_quote) or norm_quote(q.evidence_quote) not in norm_quote(source):
            return "evidence quote not found in the passage"
    return None


def validate_batch(questions: list[GenQuestion], *, allowed_types: set[str] | None, avoid: list[str],
                   passage: str | None = None) -> tuple[list[GenQuestion], list[dict]]:
    seen = {normalize(a) for a in avoid}
    ok, rejected = [], []
    for i, q in enumerate(questions):
        reason = validate_question(q, allowed_types=allowed_types, passage=passage)
        key = normalize(q.question_text + " " + " ".join(q.options))
        if reason is None and (key in seen or normalize(q.question_text) in seen):
            reason = "duplicate of an earlier question"
        if reason:
            rejected.append({"index": i, "reason": reason, "question": q.question_text[:160]})
            continue
        seen.add(key)
        seen.add(normalize(q.question_text))
        ok.append(q)
    return ok, rejected
