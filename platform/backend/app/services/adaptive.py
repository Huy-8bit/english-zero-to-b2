"""Student knowledge model, mistake notebook and data-driven study recommendations.

Mastery is not an average score: it blends an exponentially weighted score (newer answers count more,
hard items move it more when correct, easy items more when wrong), recent accuracy, a confidence factor
that keeps mastery low until enough answers exist, and forgetting since the last practice beyond the
scheduled review interval.
"""
from __future__ import annotations

import math
from collections import Counter
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..content.catalog import LEVELS
from ..content.store import ContentStore
from ..models import ExerciseSet, LessonProgress, MistakeRecord, TopicMastery, User, VocabCard, utcnow

DIFF_WEIGHT = {"easy": 0.8, "normal": 1.0, "hard": 1.25}
RECENT_N = 12


def _today() -> date:
    return date.today()


def topic_title(store: ContentStore, topic_id: str | None) -> str:
    u = store.units.get(topic_id or "")
    return f"{u.title}" if u else (topic_id or "")


def get_topic(db: Session, user_id: int, topic_id: str) -> TopicMastery:
    tm = db.scalar(select(TopicMastery).where(TopicMastery.user_id == user_id, TopicMastery.topic_id == topic_id))
    if tm is None:
        tm = TopicMastery(user_id=user_id, topic_id=topic_id, attempts=0, correct=0.0, ewma=0.5, recent=[],
                          mistake_categories={}, interval_days=1, ease=2.3, review_count=0)
        db.add(tm)
        db.flush()
    return tm


def record_result(db: Session, user_id: int, topic_id: str | None, score: float, difficulty: str = "normal",
                  category: str | None = None) -> None:
    if not topic_id:
        return
    score = max(0.0, min(1.0, float(score)))
    tm = get_topic(db, user_id, topic_id)
    w = DIFF_WEIGHT.get(difficulty, 1.0)
    # hard+correct and easy+wrong are the most informative answers
    alpha = 0.22 * (w if score >= 0.5 else 1 / w)
    tm.ewma = tm.ewma + alpha * (score - tm.ewma)
    tm.attempts += 1
    tm.correct += score
    recent = list(tm.recent or []) + [{"s": round(score, 2), "d": difficulty, "t": utcnow().isoformat(timespec="seconds")}]
    tm.recent = recent[-RECENT_N:]
    if category and score < 1:
        cats = dict(tm.mistake_categories or {})
        cats[category] = cats.get(category, 0) + 1
        tm.mistake_categories = cats
    tm.last_practiced = utcnow()
    _schedule(tm)


def _recent_accuracy(tm: TopicMastery, n: int = 6) -> float | None:
    r = (tm.recent or [])[-n:]
    if not r:
        return None
    wsum = sum(DIFF_WEIGHT.get(x.get("d", "normal"), 1.0) for x in r)
    return sum(x["s"] * DIFF_WEIGHT.get(x.get("d", "normal"), 1.0) for x in r) / wsum


def _schedule(tm: TopicMastery) -> None:
    acc = _recent_accuracy(tm, 5) or 0.0
    if tm.attempts >= 3 and acc >= 0.8:
        tm.interval_days = min(60, max(2, round(tm.interval_days * tm.ease)))
        tm.ease = min(3.0, tm.ease + 0.05)
    elif acc < 0.6:
        tm.interval_days = 1
        tm.ease = max(1.3, tm.ease - 0.15)
    tm.next_review = _today() + timedelta(days=tm.interval_days)


def mastery(tm: TopicMastery, now: datetime | None = None) -> float:
    now = now or utcnow()
    acc = _recent_accuracy(tm)
    if acc is None:
        return 0.0
    base = 0.5 * tm.ewma + 0.5 * acc
    confidence = 1 - math.exp(-tm.attempts / 6)
    days = (now - tm.last_practiced).days if tm.last_practiced else 0
    decay = math.exp(-max(0, days - tm.interval_days) / 45)
    return round(max(0.0, min(1.0, base * confidence * decay)), 3)


def mastery_label(m: float, attempts: int) -> str:
    if attempts < 3:
        return "chua_du_du_lieu"
    if m < 0.4:
        return "yeu"
    if m < 0.7:
        return "dang_tien_bo"
    if m < 0.85 or attempts < 8:
        return "kha"
    return "thanh_thao"


def topic_rows(db: Session, user_id: int, store: ContentStore) -> list[dict]:
    rows = []
    for tm in db.scalars(select(TopicMastery).where(TopicMastery.user_id == user_id)):
        m = mastery(tm)
        u = store.units.get(tm.topic_id)
        rows.append({
            "topic_id": tm.topic_id, "title": u.title if u else tm.topic_id, "title_vi": u.title_vi if u else "",
            "level": u.level if u else None, "kind": u.kind if u else None, "attempts": tm.attempts,
            "accuracy": round(tm.correct / tm.attempts, 3) if tm.attempts else None,
            "recent_accuracy": round(_recent_accuracy(tm) or 0, 3), "mastery": m, "label": mastery_label(m, tm.attempts),
            "mistake_categories": tm.mistake_categories or {}, "last_practiced": tm.last_practiced.isoformat() if tm.last_practiced else None,
            "next_review": tm.next_review.isoformat() if tm.next_review else None,
            "review_due": bool(tm.next_review and tm.next_review <= _today()),
        })
    rows.sort(key=lambda r: r["mastery"])
    return rows


def weaknesses(db: Session, user_id: int, store: ContentStore, limit: int = 8) -> list[dict]:
    return [r for r in topic_rows(db, user_id, store) if r["attempts"] >= 3 and r["mastery"] < 0.6][:limit]


# ----------------------------------------------------------------------------- mistakes

def record_mistake(db: Session, user_id: int, *, key: str, source_type: str, source_ref: str, question_text: str,
                   student_answer: str, corrected_answer: str, error_type: str, explanation: str, topic_id: str | None) -> None:
    rec = db.scalar(select(MistakeRecord).where(MistakeRecord.user_id == user_id, MistakeRecord.key == key))
    now = utcnow()
    if rec is None:
        db.add(MistakeRecord(user_id=user_id, key=key[:160], source_type=source_type, source_ref=source_ref[:96],
                             question_text=question_text[:2000], student_answer=student_answer[:2000],
                             corrected_answer=corrected_answer[:2000], error_type=error_type or "other",
                             explanation=explanation[:4000], topic_id=topic_id, frequency=1, correct_streak=0,
                             review_status="new", first_seen=now, last_seen=now))
        db.flush()
        return
    rec.frequency += 1
    rec.last_seen = now
    rec.correct_streak = 0
    rec.review_status = "reviewing" if rec.review_status == "mastered" else rec.review_status
    rec.student_answer = student_answer[:2000]
    if corrected_answer:
        rec.corrected_answer = corrected_answer[:2000]
    if explanation:
        rec.explanation = explanation[:4000]
    if error_type and error_type != "other":
        rec.error_type = error_type


def record_mistake_success(db: Session, user_id: int, key: str) -> None:
    rec = db.scalar(select(MistakeRecord).where(MistakeRecord.user_id == user_id, MistakeRecord.key == key))
    if rec is None:
        return
    rec.correct_streak += 1
    rec.review_status = "mastered" if rec.correct_streak >= 2 else "reviewing"


def topic_success(db: Session, user_id: int, topic_id: str | None) -> None:
    """A correct answer on a new question about a topic counts as review progress for that topic's mistakes."""
    if not topic_id:
        return
    for rec in db.scalars(select(MistakeRecord).where(MistakeRecord.user_id == user_id, MistakeRecord.topic_id == topic_id,
                                                      MistakeRecord.review_status != "mastered")
                          .order_by(MistakeRecord.last_seen).limit(1)):
        rec.correct_streak += 1
        if rec.correct_streak >= 3:
            rec.review_status = "mastered"
        elif rec.review_status == "new":
            rec.review_status = "reviewing"


def mistake_summary(db: Session, user_id: int, store: ContentStore) -> dict:
    recs = list(db.scalars(select(MistakeRecord).where(MistakeRecord.user_id == user_id).order_by(MistakeRecord.last_seen.desc())))
    by_cat = Counter()
    by_topic: dict[str, dict] = {}
    for r in recs:
        if r.review_status != "mastered":
            by_cat[r.error_type] += r.frequency
        if r.topic_id:
            t = by_topic.setdefault(r.topic_id, {"topic_id": r.topic_id, "title": topic_title(store, r.topic_id), "open": 0, "mastered": 0, "frequency": 0})
            t["frequency"] += r.frequency
            t["mastered" if r.review_status == "mastered" else "open"] += 1
    return {
        "records": [{
            "id": r.id, "source_type": r.source_type, "source_ref": r.source_ref, "question_text": r.question_text,
            "student_answer": r.student_answer, "corrected_answer": r.corrected_answer, "error_type": r.error_type,
            "explanation": r.explanation, "topic_id": r.topic_id, "topic_title": topic_title(store, r.topic_id),
            "frequency": r.frequency, "first_seen": r.first_seen.isoformat(), "last_seen": r.last_seen.isoformat(),
            "review_status": r.review_status, "correct_streak": r.correct_streak,
        } for r in recs[:300]],
        "by_category": dict(by_cat.most_common()),
        "by_topic": sorted(by_topic.values(), key=lambda t: -t["open"]),
        "open_count": sum(1 for r in recs if r.review_status != "mastered"),
    }


# ----------------------------------------------------------------------------- recommendations

def suggested_difficulty(db: Session, user_id: int, topic_id: str) -> str:
    tm = db.scalar(select(TopicMastery).where(TopicMastery.user_id == user_id, TopicMastery.topic_id == topic_id))
    if tm is None or tm.attempts < 3:
        return "normal"
    m = mastery(tm)
    return "easy" if m < 0.4 else "normal" if m < 0.75 else "hard"


def daily_plan(db: Session, user: User, store: ContentStore, ai_enabled: bool) -> list[dict]:
    """LearningRecommendation items, each justified by stored learner data."""
    recs: list[dict] = []
    in_prog = db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id, LessonProgress.status == "in_progress")
                         .order_by(LessonProgress.updated_at.desc()).limit(1)).first()
    if in_prog and in_prog.unit_id in store.units:
        u = store.units[in_prog.unit_id]
        recs.append({"topic_id": u.id, "recommendation_type": "continue_lesson", "priority": 1,
                     "weakness_reason": f"Bạn đang học dở ở slide {in_prog.current_step + 1}/{in_prog.total_steps}.",
                     "recommended_lesson_id": u.id, "title": f"Học tiếp {u.id} · {u.title}", "suggested_exercise_parameters": None})
    for w in weaknesses(db, user.id, store, limit=2):
        cats = ", ".join(list(w["mistake_categories"])[:2])
        recs.append({"topic_id": w["topic_id"], "recommendation_type": "practice_weak_topic", "priority": 2,
                     "weakness_reason": f"Độ thành thạo {round(w['mastery'] * 100)}% sau {w['attempts']} câu" + (f"; lỗi hay gặp: {cats}" if cats else ""),
                     "recommended_lesson_id": w["topic_id"] if w["topic_id"] in store.units else None,
                     "title": f"Ôn chủ điểm yếu: {w['title']}",
                     "suggested_exercise_parameters": {"lesson_id": w["topic_id"], "count": 10, "scope": "lesson",
                                                       "difficulty": "easy" if w["mastery"] < 0.4 else "normal"} if ai_enabled else None})
    due_topics = [r for r in topic_rows(db, user.id, store) if r["review_due"] and r["attempts"] >= 3 and r["mastery"] >= 0.6][:2]
    for d in due_topics:
        recs.append({"topic_id": d["topic_id"], "recommendation_type": "spaced_review", "priority": 3,
                     "weakness_reason": f"Đến lịch ôn (lần ôn trước cách đây {d['last_practiced'][:10] if d['last_practiced'] else '?'}).",
                     "recommended_lesson_id": d["topic_id"] if d["topic_id"] in store.units else None, "title": f"Ôn lại: {d['title']}",
                     "suggested_exercise_parameters": {"lesson_id": d["topic_id"], "count": 5, "scope": "lesson", "difficulty": "adaptive"} if ai_enabled else None})
    from ..models import VocabProgress
    from .progress import vocab_due_count

    due_cards = vocab_due_count(db, user.id)
    seen_cards = db.scalar(select(func.count(VocabProgress.id)).where(VocabProgress.user_id == user.id, VocabProgress.state != "new")) or 0
    recs.append({"topic_id": "vocabulary", "recommendation_type": "vocabulary_review", "priority": 3,
                 "weakness_reason": f"{due_cards} thẻ đến hạn ôn." if due_cards else ("Bắt đầu học 10 từ mới." if seen_cards == 0 else "Thêm 10 từ mới hôm nay."),
                 "recommended_lesson_id": None, "title": "Luyện 10 từ vựng", "suggested_exercise_parameters": None})
    yesterday = utcnow() - timedelta(days=1)
    open_recent = db.scalar(select(func.count(MistakeRecord.id)).where(
        MistakeRecord.user_id == user.id, MistakeRecord.review_status != "mastered", MistakeRecord.last_seen >= yesterday - timedelta(days=1))) or 0
    if open_recent:
        recs.append({"topic_id": "mistakes", "recommendation_type": "retry_mistakes", "priority": 2,
                     "weakness_reason": f"{open_recent} lỗi gần đây chưa được ôn lại.", "recommended_lesson_id": None,
                     "title": "Làm lại lỗi sai gần đây", "suggested_exercise_parameters": {"scope": "mistakes", "count": 10} if ai_enabled else None})
    if ai_enabled:
        recent_listen = db.scalar(select(func.count(ExerciseSet.id)).where(
            ExerciseSet.user_id == user.id, ExerciseSet.kind == "listening", ExerciseSet.created_at >= utcnow() - timedelta(days=3))) or 0
        if not recent_listen:
            recs.append({"topic_id": "listening", "recommendation_type": "listening_practice", "priority": 4,
                         "weakness_reason": "Chưa luyện nghe trong 3 ngày qua.", "recommended_lesson_id": None,
                         "title": "Một bài nghe ngắn (AI)", "suggested_exercise_parameters": None})
    return sorted(recs, key=lambda r: r["priority"])


def current_level(db: Session, user_id: int, store: ContentStore) -> str:
    done = {p.unit_id for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == user_id, LessonProgress.completed_at.is_not(None)))}
    level = "A0"
    for lv in LEVELS:
        g = [u.id for u in store.unit_list if u.kind == "grammar" and u.level == lv]
        if g and sum(1 for x in g if x in done) >= len(g) * 0.5:
            level = lv
    return level
