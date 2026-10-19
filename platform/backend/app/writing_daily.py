"""Daily writing practice: a ladder from sentences to paragraphs, built on the words the learner has studied.

  1. translate — short real sentences (Tatoeba, Vietnamese → English) that use studied words; exact/word-order check,
     then the AI judge for other valid translations (or self-assessment without AI);
  2. use — write your own sentence with a studied word (AI feedback);
  3. paragraph — a short text at the learner's level in Writing Studio (AI feedback, rewrite loop).
Every number here comes from stored attempts; nothing is estimated by the AI.
"""
from __future__ import annotations

from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .content.catalog import LEVELS
from .content.store import ContentStore
from .models import User, VocabMistake, VocabReviewLog, WritingSubmission
from .services import progress as P
from .vocabulary.service import day_bounds

ERROR_VI = {"grammar": "ngữ pháp", "vocabulary": "từ vựng", "spelling": "chính tả", "word_order": "trật tự từ", "tense": "thì",
            "article": "mạo từ", "preposition": "giới từ", "agreement": "hòa hợp chủ–vị", "punctuation": "dấu câu", "collocation": "kết hợp từ",
            "wrong_order": "trật tự từ", "incorrect": "dịch sai ý", "self_wrong": "dịch sai ý", "other": "khác"}
# paragraph length that fits the level (words)
LENGTH = {"A0": (25, 50), "A1": (40, 70), "A2": (60, 100), "B1": (100, 150), "B2": (150, 220)}


def _attempts(db: Session, user_id: int, mode: str, since) -> tuple[int, int]:
    rows = list(db.scalars(select(VocabReviewLog.correct).where(VocabReviewLog.user_id == user_id, VocabReviewLog.mode == mode,
                                                               VocabReviewLog.reviewed_at >= since)))
    return len(rows), sum(1 for c in rows if c)


def status(db: Session, user: User, store: ContentStore) -> dict:
    level = P.recommendations(db, user, store).get("current_level") or "A1"
    level = level if level in LEVELS else "A1"
    start, _ = day_bounds()
    week = start - timedelta(days=6)
    t_today, t_ok = _attempts(db, user.id, "translate", start)
    t_week, t_week_ok = _attempts(db, user.id, "translate", week)
    u_today, u_ok = _attempts(db, user.id, "use_it", start)
    essays = list(db.scalars(select(WritingSubmission).where(WritingSubmission.user_id == user.id).order_by(WritingSubmission.created_at)))
    essays_today = [s for s in essays if s.created_at >= start]
    cats: Counter = Counter()
    for s in essays[-10:]:
        cats.update(e.get("category", "other") for e in (s.feedback or {}).get("detected_errors", []))
    for m in db.scalars(select(VocabMistake).where(VocabMistake.user_id == user.id, VocabMistake.mode == "translate",
                                                   VocabMistake.created_at >= week)):
        cats[m.error_type] += 1
    recent = [{"vi": m.prompt, "answer": m.answer, "expected": m.expected, "explanation_vi": m.explanation_vi}
              for m in db.scalars(select(VocabMistake).where(VocabMistake.user_id == user.id, VocabMistake.mode == "translate",
                                                            VocabMistake.resolved_at.is_(None)).order_by(VocabMistake.created_at.desc()).limit(5))]
    last = essays[-1].feedback if essays else None
    lo, hi = LENGTH.get(level, (40, 70))
    steps = [
        {"key": "translate", "title": "Dịch câu Việt → Anh", "goal": 8, "done": t_today, "correct": t_ok,
         "why_vi": "Câu thật, ngắn, có từ bạn đã học: luyện ghép từ thành câu đúng ngữ pháp và đúng trật tự."},
        {"key": "use", "title": "Tự đặt câu với từ đã học", "goal": 5, "done": u_today, "correct": u_ok,
         "why_vi": "Biến từ “nhận ra được” thành từ “dùng được”; AI chỉ ra lỗi và cho câu sửa."},
        {"key": "paragraph", "title": f"Viết đoạn {lo}–{hi} từ (trình độ {level})", "goal": 1, "done": len(essays_today), "correct": None,
         "why_vi": "Nối câu thành đoạn: mở ý, 2–3 câu chi tiết, câu kết. Sửa lại theo góp ý rồi nộp lần 2 để thấy tiến bộ."},
    ]
    return {"level": level, "paragraph_words": [lo, hi], "steps": steps, "done_today": all(s["done"] >= s["goal"] for s in steps),
            "week": {"translations": t_week, "accuracy": round(100 * t_week_ok / t_week) if t_week else None,
                     "paragraphs": sum(1 for s in essays if s.created_at >= week)},
            "common_errors": [{"type": ERROR_VI.get(k, k), "count": n} for k, n in cats.most_common(5)],
            "recent_translation_mistakes": recent,
            "last_paragraph": {"score_10": last.get("estimated_score_10"), "level": last.get("estimated_level")} if last else None}
