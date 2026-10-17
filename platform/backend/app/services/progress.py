"""Progress, XP, streaks, achievements, spaced repetition and recommendations.

All numbers are derived from stored learner actions; nothing is mocked.
XP is written through `award()` with a unique key per (user, action), so a
reload or a duplicated request can never add XP twice.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..content.catalog import LEVELS, LEVEL_NAMES
from ..content.md import fold, parse_tables, strip_md
from ..content.store import ContentStore
from ..models import Achievement, ActivityDay, Attempt, LessonProgress, User, VocabCard, VocabEntry, VocabProgress, VocabReview, XPEvent, utcnow

XP_RULES = {"auto_correct": 10, "self_correct": 6, "production": 8, "lesson_complete": 50, "vocab_review": 2, "daily_goal": 20}
PASS_SCORE = 60.0

ACHIEVEMENTS = {
    "first_lesson": ("Bài học đầu tiên", "Hoàn thành bài học đầu tiên"),
    "lessons_10": ("Chăm chỉ", "Hoàn thành 10 bài học"),
    "lessons_50": ("Bền bỉ", "Hoàn thành 50 bài học"),
    "perfect_quiz": ("Không sai câu nào", "Đúng toàn bộ câu tự chấm trong một bài tập ngay lần đầu"),
    "streak_3": ("Chuỗi 3 ngày", "Học 3 ngày liên tiếp"),
    "streak_7": ("Chuỗi 7 ngày", "Học 7 ngày liên tiếp"),
    "streak_30": ("Chuỗi 30 ngày", "Học 30 ngày liên tiếp"),
    "cards_100": ("100 lượt ôn từ", "Ôn 100 lượt flashcard"),
    "xp_1000": ("1000 XP", "Đạt 1000 XP"),
    **{f"level_{lv}": (f"Hoàn thành ngữ pháp {lv}", f"Hoàn thành mọi bài ngữ pháp {lv}") for lv in LEVELS},
}


def today() -> date:
    return date.today()


# ------------------------------------------------------------------ basics

def get_user(db: Session) -> User:
    user = db.get(User, 1)
    if user is None:
        user = User(id=1)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # The dashboard launches several requests on first load. Another
            # request may have created the single local profile in the meantime.
            db.rollback()
            user = db.get(User, 1)
            if user is None:
                raise
    return user


def award(db: Session, user_id: int, key: str, reason: str, amount: int) -> int:
    """Insert an XP event once per key. Returns the XP actually added (0 if duplicate)."""
    if db.scalar(select(XPEvent.id).where(XPEvent.user_id == user_id, XPEvent.key == key)):
        return 0
    try:
        with db.begin_nested():
            db.add(XPEvent(user_id=user_id, key=key, reason=reason, amount=amount))
    except IntegrityError:
        return 0
    return amount


def activity(db: Session, user_id: int, d: date | None = None) -> ActivityDay:
    d = d or today()
    row = db.scalar(select(ActivityDay).where(ActivityDay.user_id == user_id, ActivityDay.day == d))
    if row is None:
        try:
            with db.begin_nested():
                row = ActivityDay(user_id=user_id, day=d, seconds=0, items_answered=0, lessons_completed=0, cards_reviewed=0)
                db.add(row)
        except IntegrityError:
            row = db.scalar(select(ActivityDay).where(ActivityDay.user_id == user_id, ActivityDay.day == d))
    return row


def total_xp(db: Session, user_id: int, since: datetime | None = None) -> int:
    q = select(func.coalesce(func.sum(XPEvent.amount), 0)).where(XPEvent.user_id == user_id)
    if since:
        q = q.where(XPEvent.created_at >= since)
    return int(db.scalar(q) or 0)


def streak(db: Session, user_id: int) -> int:
    days = {r.day for r in db.scalars(select(ActivityDay).where(ActivityDay.user_id == user_id)) if
            r.seconds >= 60 or r.items_answered or r.cards_reviewed or r.lessons_completed}
    d = today()
    if d not in days:
        d -= timedelta(days=1)
    n = 0
    while d in days:
        n += 1
        d -= timedelta(days=1)
    return n


def heartbeat(db: Session, user: User, unit_id: str | None) -> int:
    """Count study time from the gap between heartbeats (clamped, so idle tabs don't inflate it)."""
    now = utcnow()
    last = user.last_heartbeat
    delta = 0 if last is None else (now - last).total_seconds()
    seconds = int(delta) if 0 < delta <= 75 else 15
    user.last_heartbeat = now
    act = activity(db, user.id)
    act.seconds += seconds
    if unit_id:
        prog = db.scalar(select(LessonProgress).where(LessonProgress.user_id == user.id, LessonProgress.unit_id == unit_id))
        if prog:
            prog.time_spent_sec += seconds
    goal = user.daily_goal_minutes * 60
    if act.seconds >= goal:
        award(db, user.id, f"goal:{today().isoformat()}", "daily_goal", XP_RULES["daily_goal"])
    return seconds


def check_achievements(db: Session, user_id: int, store: ContentStore) -> list[str]:
    have = set(db.scalars(select(Achievement.key).where(Achievement.user_id == user_id)))
    earned = []
    done = list(db.scalars(select(LessonProgress).where(LessonProgress.user_id == user_id, LessonProgress.completed_at.is_not(None))))
    n = len(done)
    st = streak(db, user_id)
    from ..models import VocabReviewLog

    reviews = (db.scalar(select(func.count(VocabReview.id)).where(VocabReview.user_id == user_id)) or 0) + (
        db.scalar(select(func.count(VocabReviewLog.id)).where(VocabReviewLog.user_id == user_id, VocabReviewLog.rating.is_not(None))) or 0)
    candidates = {
        "first_lesson": n >= 1, "lessons_10": n >= 10, "lessons_50": n >= 50,
        "streak_3": st >= 3, "streak_7": st >= 7, "streak_30": st >= 30,
        "cards_100": reviews >= 100, "xp_1000": total_xp(db, user_id) >= 1000,
    }
    done_ids = {p.unit_id for p in done}
    for lv in LEVELS:
        ids = [u.id for u in store.unit_list if u.kind == "grammar" and u.level == lv]
        candidates[f"level_{lv}"] = bool(ids) and all(i in done_ids for i in ids)
    for key, ok in candidates.items():
        if ok and key not in have:
            db.add(Achievement(user_id=user_id, key=key))
            earned.append(key)
    return earned


def grant_achievement(db: Session, user_id: int, key: str) -> bool:
    if db.scalar(select(Achievement.id).where(Achievement.user_id == user_id, Achievement.key == key)):
        return False
    db.add(Achievement(user_id=user_id, key=key))
    return True


# ------------------------------------------------------------------ scoring

def latest_attempts(db: Session, user_id: int, unit_id: str | None = None, quiz_id: str | None = None) -> dict[str, Attempt]:
    q = select(Attempt).where(Attempt.user_id == user_id)
    if unit_id:
        q = q.where(Attempt.unit_id == unit_id)
    if quiz_id:
        q = q.where(Attempt.quiz_id == quiz_id)
    out: dict[str, Attempt] = {}
    for a in db.scalars(q.order_by(Attempt.id)):
        out[a.item_id] = a
    return out


def attempt_is_correct(a: Attempt) -> bool | None:
    if a.verdict == "correct":
        return True
    if a.verdict == "incorrect":
        return False
    if a.self_correct is not None:
        return a.self_correct
    return a.ai_correct


def unit_score(db: Session, user_id: int, unit_id: str) -> tuple[float | None, int, int]:
    graded = correct = 0
    for a in latest_attempts(db, user_id, unit_id).values():
        ok = attempt_is_correct(a)
        if ok is None:
            continue
        graded += 1
        correct += int(ok)
    return (round(100 * correct / graded, 1) if graded else None), correct, graded


# ------------------------------------------------------------------ spaced repetition (SM-2)

def vocab_due_count(db: Session, user_id: int) -> int:
    """Words due now in the (single) FSRS vocabulary schedule."""
    return db.scalar(select(func.count(VocabProgress.id)).where(
        VocabProgress.user_id == user_id, VocabProgress.state != "new", VocabProgress.due <= utcnow(),
        VocabProgress.suspended.is_(False), VocabProgress.known.is_(False))) or 0


def sm2(card: VocabCard, grade: int) -> VocabCard:
    """Legacy SM-2 (kept for reading old vocab_cards rows; new reviews use FSRS in app.vocabulary.srs)."""
    return _sm2(card, grade)


def _sm2(card: VocabCard, grade: int) -> VocabCard:
    """SuperMemo-2: grade 0–5. <3 resets the card; ease never drops below 1.3."""
    grade = max(0, min(5, grade))
    if grade < 3:
        card.repetitions = 0
        card.interval_days = 1
        card.lapses += 1
    else:
        if card.repetitions == 0:
            card.interval_days = 1
        elif card.repetitions == 1:
            card.interval_days = 6
        else:
            card.interval_days = max(1, round(card.interval_days * card.ease))
        card.repetitions += 1
    card.ease = max(1.3, card.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)))
    card.due = today() + timedelta(days=card.interval_days)
    card.last_reviewed = utcnow()
    return card


# ------------------------------------------------------------------ placement

def placement_bands(store: ContentStore) -> list[tuple[int, int, str]]:
    """Read the score → level table from PLACEMENT-ANSWERS.md (source of truth)."""
    p = store.root / "00-GETTING-STARTED" / "PLACEMENT-ANSWERS.md"
    if not p.exists():
        return []
    bands = []
    for t in parse_tables(p.read_text(encoding="utf-8")):
        if not t.header or "diem" not in fold(strip_md(t.header[0])):
            continue
        for row in t.rows:
            m = re.search(r"(\d+)\s*[–-]\s*(\d+)", strip_md(row[0]))
            lv = re.search(r"\b(A0|A1|A2|B1|B2)\b", " ".join(row[1:]))
            if m and lv:
                bands.append((int(m.group(1)), int(m.group(2)), lv.group(1)))
        if bands:
            break
    return bands


def placement_parts(store: ContentStore) -> list[tuple[str, int, int]]:
    """Level sections of PLACEMENT-TEST.md, e.g. `## Part 2 — Beginner (A1) · Câu 16–30`."""
    p = store.root / "00-GETTING-STARTED" / "PLACEMENT-TEST.md"
    if not p.exists():
        return []
    parts = []
    for m in re.finditer(r"^##\s+Part\s+\d+.*?\((A0|A1|A2|B1|B2)\).*?(\d+)\s*[–-]\s*(\d+)", p.read_text(encoding="utf-8"), re.M):
        parts.append((m.group(1), int(m.group(2)), int(m.group(3))))
    return parts


def placement_level(db: Session, user_id: int, store: ContentStore) -> dict | None:
    """Apply the three steps written in PLACEMENT-ANSWERS.md: total score band, first level part
    under 11/15, then take the lower of the two."""
    prog = db.scalar(select(LessonProgress).where(LessonProgress.user_id == user_id, LessonProgress.unit_id == "PLACEMENT-TEST"))
    if not prog or not prog.completed_at:
        return None
    attempts = latest_attempts(db, user_id, "PLACEMENT-TEST")
    correct_labels = {a.item_id.split(":", 1)[1] for a in attempts.values() if a.verdict == "correct"}
    correct = len(correct_labels)
    by_total = next((lv for lo, hi, lv in placement_bands(store) if lo <= correct <= hi), None)
    by_parts = None
    part_scores = []
    for lv, lo, hi in placement_parts(store):
        got = sum(1 for n in range(lo, hi + 1) if str(n) in correct_labels)
        part_scores.append({"level": lv, "score": got, "total": hi - lo + 1})
        if by_parts is None and got < 11:
            by_parts = lv
    candidates = [x for x in (by_total, by_parts) if x]
    level = min(candidates, key=LEVELS.index) if candidates else None
    return {"score": correct, "level": level, "by_total": by_total, "by_parts": by_parts, "parts": part_scores}


# ------------------------------------------------------------------ dashboard

def prog_date(db: Session, user_id: int) -> str | None:
    p = db.scalar(select(LessonProgress).where(LessonProgress.user_id == user_id, LessonProgress.unit_id == "PLACEMENT-TEST"))
    return p.completed_at.isoformat() if p and p.completed_at else None


def progress_map(db: Session, user_id: int) -> dict[str, LessonProgress]:
    return {p.unit_id: p for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == user_id))}


def status_of(p: LessonProgress | None) -> str:
    if p is None:
        return "not_started"
    return p.status


def recommendations(db: Session, user: User, store: ContentStore) -> dict:
    pm = progress_map(db, user.id)
    units = store.unit_list
    in_progress = sorted((p for p in pm.values() if p.status == "in_progress"), key=lambda p: p.updated_at, reverse=True)
    review = [p for p in pm.values() if p.status == "review"]
    placement = placement_level(db, user.id, store)
    start_level = placement["level"] if placement and placement.get("level") else "A0"
    from ..models import LearningProfile

    prof = db.get(LearningProfile, user.id)
    ai_place = (prof.preferences or {}).get("placement") if prof else None
    if ai_place and ai_place.get("level") in LEVELS and (not placement or ai_place.get("date", "") > (prog_date(db, user.id) or "")):
        placement = {"score": None, "level": ai_place["level"], "source": "adaptive"}
        start_level = ai_place["level"]
    start_idx = LEVELS.index(start_level)
    next_lesson = None
    for u in units:
        if u.kind != "grammar" or LEVELS.index(u.level) < start_idx:
            continue
        if status_of(pm.get(u.id)) in ("completed",):
            continue
        if pm.get(u.id) and pm[u.id].status == "in_progress":
            continue
        next_lesson = u
        break
    level = next_lesson.level if next_lesson else start_level
    due = vocab_due_count(db, user.id)
    skills = None
    for lv in LEVELS:
        g = [u for u in units if u.kind == "grammar" and u.level == lv]
        if g and all(status_of(pm.get(u.id)) == "completed" for u in g):
            for u in units:
                if u.level == lv and u.kind in ("skills", "exam", "communication") and status_of(pm.get(u.id)) != "completed":
                    skills = u
                    break
    def brief(u):
        return None if u is None else {"id": u.id, "title": u.title, "title_vi": u.title_vi, "kind": u.kind, "level": u.level}
    return {
        "continue": [dict(brief(store.units[p.unit_id]), current_step=p.current_step, total_steps=p.total_steps)
                     for p in in_progress[:3] if p.unit_id in store.units],
        "next_lesson": brief(next_lesson),
        "review_lessons": [dict(brief(store.units[p.unit_id]), score=p.score) for p in review if p.unit_id in store.units][:5],
        "skills_or_test": brief(skills),
        "due_cards": due,
        "placement": placement,
        "current_level": level,
        "current_level_name": LEVEL_NAMES.get(level, ""),
        "placement_taken": placement is not None,
    }


def dashboard(db: Session, user: User, store: ContentStore) -> dict:
    pm = progress_map(db, user.id)
    units = store.unit_list
    grammar = [u for u in units if u.kind == "grammar"]
    completed = [p for p in pm.values() if p.completed_at is not None]
    t = today()
    week_start = t - timedelta(days=t.weekday())
    days = {r.day: r for r in db.scalars(select(ActivityDay).where(ActivityDay.user_id == user.id, ActivityDay.day >= t - timedelta(days=27)))}
    last7 = []
    for i in range(6, -1, -1):
        d = t - timedelta(days=i)
        r = days.get(d)
        last7.append({"day": d.isoformat(), "minutes": round((r.seconds if r else 0) / 60, 1),
                      "items": r.items_answered if r else 0, "cards": r.cards_reviewed if r else 0})
    total_seconds = db.scalar(select(func.coalesce(func.sum(ActivityDay.seconds), 0)).where(ActivityDay.user_id == user.id)) or 0
    week_completed = sum(1 for p in completed if p.completed_at and p.completed_at.date() >= week_start)
    mastery = []
    for lv in LEVELS:
        g = [u for u in grammar if u.level == lv]
        done = [pm[u.id] for u in g if u.id in pm and pm[u.id].completed_at]
        scores = [p.best_score for p in done if p.best_score is not None]
        mastery.append({"level": lv, "name": LEVEL_NAMES[lv], "total": len(g), "completed": len(done),
                        "avg_score": round(sum(scores) / len(scores), 1) if scores else None})
    cards_total = db.scalar(select(func.count(VocabEntry.id)).where(VocabEntry.published.is_(True), VocabEntry.owner_user_id.is_(None))) or len(store.cards())
    seen = db.scalar(select(func.count(VocabProgress.id)).where(VocabProgress.user_id == user.id, VocabProgress.state != "new")) or 0
    mature = db.scalar(select(func.count(VocabProgress.id)).where(VocabProgress.user_id == user.id, VocabProgress.state == "review",
                                                                  VocabProgress.stability >= 21)) or 0
    due = vocab_due_count(db, user.id)
    today_row = days.get(t)
    return {
        "user": {"name": user.name, "daily_goal_minutes": user.daily_goal_minutes, "weekly_goal_lessons": user.weekly_goal_lessons},
        "xp": {"total": total_xp(db, user.id), "today": total_xp(db, user.id, datetime.combine(t, datetime.min.time())),
               "week": total_xp(db, user.id, datetime.combine(week_start, datetime.min.time()))},
        "streak": streak(db, user.id),
        "today": {"minutes": round((today_row.seconds if today_row else 0) / 60, 1), "items": today_row.items_answered if today_row else 0},
        "lessons": {"completed": len(completed), "total": len(units), "grammar_completed": sum(1 for u in grammar if u.id in pm and pm[u.id].completed_at),
                    "grammar_total": len(grammar), "in_progress": sum(1 for p in pm.values() if p.status == "in_progress"),
                    "review": sum(1 for p in pm.values() if p.status == "review"), "week_completed": week_completed},
        "time": {"total_minutes": round(total_seconds / 60), "week_minutes": round(sum(r.seconds for d, r in days.items() if d >= week_start) / 60)},
        "weekly_activity": last7,
        "grammar_mastery": mastery,
        "vocabulary": {"total_cards": cards_total, "seen": seen, "mature": mature, "due": due},
        "recent_mistakes": recent_mistakes(db, user.id, store, limit=6),
        "recommendations": recommendations(db, user, store),
        "achievements": achievements(db, user.id),
    }


def achievements(db: Session, user_id: int) -> list[dict]:
    have = {a.key: a.earned_at for a in db.scalars(select(Achievement).where(Achievement.user_id == user_id))}
    return [{"key": k, "title": v[0], "description": v[1], "earned_at": have[k].isoformat() if k in have else None}
            for k, v in ACHIEVEMENTS.items()]


def recent_mistakes(db: Session, user_id: int, store: ContentStore, limit: int = 50) -> list[dict]:
    latest = latest_attempts(db, user_id)
    wrong = [a for a in latest.values() if attempt_is_correct(a) is False]
    wrong.sort(key=lambda a: a.created_at, reverse=True)
    out = []
    for a in wrong[:limit]:
        unit = store.units.get(a.unit_id)
        out.append({"item_id": a.item_id, "quiz_id": a.quiz_id, "unit_id": a.unit_id, "unit_title": unit.title if unit else a.unit_id,
                    "response": a.response, "created_at": a.created_at.isoformat()})
    return out
