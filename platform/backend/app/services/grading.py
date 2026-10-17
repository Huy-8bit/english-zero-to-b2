"""Server-side grading.

Verdicts:
- correct / incorrect — closed questions (multiple choice, T/F/NG, (a / b)
  choices) whose correct option is stated in the answer key.
- correct — a typed answer that matches one of the variants written in the key.
- mismatch — typed answer differs from the key. Open English answers have many
  valid forms, so this is NOT treated as wrong: the learner compares with the
  model answer and self-assesses.
- submitted — production tasks (writing, speaking, knowledge check) or items
  without a key: model answer / rubric is shown and the learner self-assesses.
"""
from __future__ import annotations

import re

from ..content.builder import ServerItem
from ..content.md import bold_segments, fold, strip_md

CONTRACTIONS = [
    (r"\bwon't\b", "will not"), (r"\bcan't\b", "cannot"), (r"\bshan't\b", "shall not"), (r"\bain't\b", "is not"),
    (r"n't\b", " not"), (r"'m\b", " am"), (r"'re\b", " are"), (r"'ll\b", " will"), (r"'ve\b", " have"), (r"'d\b", " would"),
    (r"\bcan not\b", "cannot"),
]


def normalize(text: str) -> str:
    s = strip_md(text or "")
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("…", "...")
    s = s.lower().strip()
    for pat, rep in CONTRACTIONS:
        s = re.sub(pat, rep, s)
    s = re.sub(r"[^\w' ]+", " ", s, flags=re.UNICODE)
    s = s.replace("'", "'")
    return re.sub(r"\s+", " ", s).strip()


def _is_vietnamese(text: str) -> bool:
    return fold(text) != text.lower() or bool(re.search(r"\b(hoac|chap nhan|nhung|neu|khong|cung)\b", fold(text)))


def answer_variants(answer_md: str) -> set[str]:
    """All forms written in the key that count as a match."""
    raw = answer_md.replace("<br>", " / ")
    variants: set[str] = set()
    full = strip_md(raw)
    pieces = re.split(r"\s+/\s+|\s+hoặc\s+|;\s+", full)
    for p in [full, *pieces]:
        p = p.strip().lstrip("→").strip()
        if not p:
            continue
        no_paren = re.sub(r"\([^)]*\)", "", p).strip()
        with_paren = re.sub(r"[()]", "", p).strip()
        for v in (p, no_paren, with_paren):
            if v and not _is_vietnamese(v):
                variants.add(normalize(v))
        for inner in re.findall(r"\(([^)]*)\)", p):
            inner = re.sub(r"^(hoặc|or|cũng|also)\s+", "", inner.strip())
            if inner and len(inner.split()) <= 6 and not _is_vietnamese(inner):
                variants.add(normalize(inner))
    bolds = bold_segments(raw)
    if bolds:
        joined = " ".join(bolds)
        for v in [joined, *bolds]:
            for part in re.split(r"\s+/\s+", v):
                if part.strip() and not _is_vietnamese(part):
                    variants.add(normalize(re.sub(r"[()]", "", part)))
                    variants.add(normalize(re.sub(r"\([^)]*\)", "", part)))
    variants.discard("")
    return variants


def grade(item: ServerItem, response) -> dict:
    model, expl = item.model_md, item.explanation_md
    base = {"item_id": item.id, "model_md": model, "explanation_md": expl, "review": item.review,
            "correct_option": None, "auto": False}
    if item.kind in ("mc", "tfng", "choice"):
        value = str(response or "").strip()
        if item.correct_option is None:
            return {**base, "verdict": "submitted", "correct": None}
        ok = value.lower() == item.correct_option.lower()
        return {**base, "verdict": "correct" if ok else "incorrect", "correct": ok, "auto": True,
                "correct_option": item.correct_option}
    if item.kind == "multi":
        chosen = sorted(str(x) for x in (response or []))
        expected = sorted((item.correct_option or "").split(","))
        if not item.correct_option:
            return {**base, "verdict": "submitted", "correct": None}
        ok = chosen == expected
        return {**base, "verdict": "correct" if ok else "incorrect", "correct": ok, "auto": True,
                "correct_option": item.correct_option}
    text = response if isinstance(response, str) else " ".join(map(str, response or []))
    if item.kind in ("long", "speaking") or item.key is None or item.self_check_only:
        return {**base, "verdict": "submitted", "correct": None}
    if normalize(text) and normalize(text) in answer_variants(item.key.answer_md):
        return {**base, "verdict": "correct", "correct": True, "auto": True}
    return {**base, "verdict": "mismatch", "correct": None}
