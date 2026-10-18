"""Smart review: "what am I missing or getting wrong?" → one ordered review run across every source.

Order (error-based learning first, then spaced retrieval):
 1. curriculum questions answered wrong (re-answer the same item; graded by the normal quiz endpoint)
 2. corrections from Writing / Speaking / AI practice (type the corrected sentence; compared with the correction)
 3. vocabulary: words due today, words answered wrong and still unresolved, weak words (vocabulary session "gaps")
 4. lessons to redo: score < 60 % or due for spaced revision
"""
from __future__ import annotations

import difflib
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from .content.store import ContentStore
from .models import MistakeRecord, User, utcnow
from .services import adaptive
from .services import progress as P
from .services.grading import normalize
from .study_plan import gap_counts

SOURCE_VI = {"writing": "Bài viết", "speaking": "Luyện nói", "ai_exercise": "Bài tập AI", "curriculum": "Bài học"}


def diagnose(db: Session, user: User, store: ContentStore, quick: bool = False) -> dict:
    from .assistant import review_insight
    from .vocabulary.sessions import weak_entries

    gaps = gap_counts(db, user, store)
    wrong = P.recent_mistakes(db, user.id, store, limit=500)
    items = []
    for m in wrong:
        b = store.built(m["unit_id"])
        step = next((s for s in (b.steps if b else []) if s.get("quiz_id") == m["quiz_id"]), None)
        pub = next((i for i in (step or {}).get("items", []) if i["id"] == m["item_id"]), None)
        if pub:
            items.append({**m, "item": pub, "step_title": step["title"]})
    # quick, instantly graded retrieval first (multiple choice, gap fill, ordering); open writing/speaking prompts last
    rank = {"mc": 0, "tfng": 0, "choice": 0, "multi": 1, "text": 1, "order": 2, "long": 5, "speaking": 6}
    items.sort(key=lambda x: rank.get(x["item"].get("kind"), 3))
    items = items[: 6 if quick else 15]
    recs = list(db.scalars(select(MistakeRecord).where(
        MistakeRecord.user_id == user.id, MistakeRecord.review_status != "mastered", MistakeRecord.source_type != "curriculum",
        MistakeRecord.corrected_answer != "").order_by(MistakeRecord.frequency.desc(), MistakeRecord.last_seen.desc()).limit(5 if quick else 12)))
    corrections = [{"id": r.id, "source": SOURCE_VI.get(r.source_type, r.source_type), "context": r.question_text[:240], "wrong": r.student_answer,
                    "error_type": r.error_type, "times": r.frequency, "streak": r.correct_streak} for r in recs]
    rv = review_insight(db, user, store)
    by_unit: dict[str, int] = {}
    for m in wrong:
        by_unit[m["unit_id"]] = by_unit.get(m["unit_id"], 0) + 1
    hot = sorted(by_unit.items(), key=lambda kv: -kv[1])[:5]
    weak_words = len(weak_entries(db, user.id, 50))
    sections = [
        {"id": "curriculum", "title": "Câu làm sai trong bài học", "count": gaps["curriculum"],
         "why_vi": "Làm lại đúng câu đã sai giúp sửa hiểu lầm trước khi nó thành thói quen."},
        {"id": "corrections", "title": "Lỗi trong bài viết, luyện nói, bài tập AI", "count": gaps["corrections"],
         "why_vi": "Tự viết lại câu đúng (không nhìn đáp án) ghi nhớ tốt hơn đọc lại lời sửa."},
        {"id": "vocab", "title": "Từ vựng đến hạn, hay sai, hay quên", "count": gaps["vocab_due"] + max(gaps["vocab_mistakes"], weak_words),
         "why_vi": "Ôn đúng lúc sắp quên (lặp lại ngắt quãng) và luyện phân biệt từ dễ nhầm."},
        {"id": "lessons", "title": "Bài cần học lại", "count": rv["lessons_due_total"],
         "why_vi": "Bài điểm thấp hoặc đã lâu chưa ôn — học lại theo khoảng cách tăng dần."},
    ]
    return {"quick": quick, "total": sum(s["count"] for s in sections), "sections": sections, "curriculum_items": items,
            "corrections": corrections, "vocab": {"due": gaps["vocab_due"], "mistakes": gaps["vocab_mistakes"], "weak": weak_words},
            "lessons": rv["lessons"][: 3 if quick else 8], "weak_topics": rv["weak_topics"],
            "hot_units": [{"unit_id": u, "title": store.units[u].title if u in store.units else u, "wrong": n} for u, n in hot]}


def _clean(t: str) -> str:
    return re.sub(r"\s+", " ", normalize(t or "")).strip()


def check_correction(db: Session, user: User, record_id: int, answer: str) -> dict:
    r = db.get(MistakeRecord, record_id)
    if r is None or r.user_id != user.id:
        raise KeyError(record_id)
    a, target = _clean(answer), _clean(r.corrected_answer)
    ratio = difflib.SequenceMatcher(None, a, target).ratio() if a and target else 0.0
    ok = bool(a) and (a == target or ratio >= 0.9 or target in a and len(a) <= len(target) + 12)
    if ok:
        adaptive.record_mistake_success(db, user.id, r.key)
    else:
        r.correct_streak = 0
        r.review_status = "reviewing"
    r.last_seen = utcnow()
    P.log_study(db, user.id, "review", kind="module", items=1, correct=int(ok))
    return {"correct": ok, "similarity": round(ratio, 2), "expected": r.corrected_answer, "explanation": r.explanation,
            "status": r.review_status, "streak": r.correct_streak,
            "note_vi": "Đúng! Cần làm đúng 2 lần (ở các buổi ôn khác nhau) để lỗi được coi là đã sửa." if ok and r.review_status != "mastered"
            else "Lỗi này đã được sửa xong." if ok else "Chưa khớp với câu sửa — đọc lời giải thích rồi lần sau thử lại."}
