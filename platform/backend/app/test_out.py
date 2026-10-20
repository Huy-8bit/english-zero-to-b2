"""'Kiểm tra vượt bài' (lesson test-out): a learner who already knows a lesson proves it in about 8 questions and moves on.

Integrity: the server picks the questions and grades them from the learner's FIRST answer to each one after the test
started (normal quiz submissions; "Không biết" counts as wrong). One test-out per lesson per 24 h, so it cannot be
retaken until the answers are memorised. Exams are excluded.
"""
from __future__ import annotations

import random
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .content.store import ContentStore
from .models import Attempt, LessonProgress, LessonTestOut, User, utcnow
from .services import progress as P
from .services.grading import answer_variants

SIZE = 8  # "Kiểm tra vượt bài"; the grammar sprint uses 6
CLOSED = {"mc", "tfng", "choice", "multi", "order"}
COOLDOWN = timedelta(hours=24)


def pass_mark(total: int) -> int:
    """Correct answers needed: one slip allowed from 6 questions up (7/8, 5/6), all of them below."""
    return total - 1 if total >= 6 else total


def _candidates(store: ContentStore, unit_id: str) -> list[tuple[int, str, str]]:
    b = store.built(unit_id)
    if b is None or b.unit.kind == "exam":
        return []
    out = []
    for i, st in enumerate(b.steps):
        if st.get("type") != "quiz" or st.get("defer") or st.get("variant") == "knowledge":
            continue
        for x in st.get("items") or []:
            it = b.items.get(x["id"])
            if it is None or it.self_check_only:
                continue
            if it.kind in CLOSED and it.correct_option:
                out.append((i, x["id"], "closed"))
            elif it.kind == "text" and it.key is not None and not x.get("multiline") and answer_variants(it.key.answer_md):
                # typed answers only when the key has an English form the grader can match exactly
                out.append((i, x["id"], "text"))
    return out


def start(db: Session, user: User, store: ContentStore, unit_id: str, size: int = SIZE) -> dict:
    size = 6 if size <= 6 else SIZE
    cands = _candidates(store, unit_id)
    if len(cands) < 5:
        raise ValueError("Bài này không có đủ câu tự chấm để kiểm tra vượt bài.")
    last = db.scalar(select(LessonTestOut).where(LessonTestOut.user_id == user.id, LessonTestOut.unit_id == unit_id)
                     .order_by(LessonTestOut.id.desc()))
    if last is not None and utcnow() - last.started_at < COOLDOWN:
        if last.finished_at is None:  # resume the unfinished one
            return {"test_id": last.id, "items": last.items, "pass_mark": pass_mark(len(last.items))}
        raise PermissionError("Mỗi bài chỉ kiểm tra vượt bài một lần mỗi 24 giờ — hãy học bài để lấp phần còn thiếu.")
    rng = random.Random()
    # spread over the lesson's exercises; closed questions (exact grading) first, typed ones to fill up
    by_step: dict[int, list[tuple[int, str, str]]] = {}
    for c in cands:
        by_step.setdefault(c[0], []).append(c)
    for v in by_step.values():
        rng.shuffle(v)
        v.sort(key=lambda c: c[2] != "closed")
    picked: list[str] = []
    while len(picked) < size and any(by_step.values()):
        for k in list(by_step):
            if by_step[k] and len(picked) < size:
                picked.append(by_step[k].pop(0)[1])
    t = LessonTestOut(user_id=user.id, unit_id=unit_id, items=picked)
    db.add(t)
    db.commit()
    return {"test_id": t.id, "items": picked, "pass_mark": pass_mark(len(picked))}


def finish(db: Session, user: User, store: ContentStore, unit_id: str, test_id: int) -> dict:
    t = db.get(LessonTestOut, test_id)
    if t is None or t.user_id != user.id or t.unit_id != unit_id:
        raise LookupError("Không tìm thấy bài kiểm tra vượt bài.")
    if t.finished_at is not None:
        return _result(t)
    first: dict[str, Attempt] = {}
    for a in db.scalars(select(Attempt).where(Attempt.user_id == user.id, Attempt.item_id.in_(t.items), Attempt.created_at >= t.started_at)
                        .order_by(Attempt.id)):
        first.setdefault(a.item_id, a)
    if len(first) < len(t.items):
        raise ValueError(f"Còn {len(t.items) - len(first)} câu chưa trả lời.")
    ok = [i for i in t.items if first[i].verdict == "correct" or first[i].ai_correct is True]
    t.correct, t.total, t.finished_at = len(ok), len(t.items), utcnow()
    t.passed = t.correct >= pass_mark(t.total)
    xp = 0
    if t.passed:
        b = store.built(unit_id)
        p = db.scalar(select(LessonProgress).where(LessonProgress.user_id == user.id, LessonProgress.unit_id == unit_id))
        if p is None:
            p = LessonProgress(user_id=user.id, unit_id=unit_id, status="in_progress", current_step=0, max_step=0,
                               total_steps=len(b.steps), state={}, time_spent_sec=0, completions=0)
            db.add(p)
        score = round(100 * t.correct / t.total, 1)
        first_completion = p.completed_at is None
        p.status, p.score = "completed", score
        p.best_score = max(p.best_score or 0, score)
        p.max_step = max(p.max_step or 0, len(b.steps) - 1)
        p.completed_at = p.completed_at or utcnow()
        p.completions = (p.completions or 0) + 1
        xp = P.award(db, user.id, f"lesson:{unit_id}", "lesson_complete", P.XP_RULES["lesson_complete"])
        if first_completion:
            P.activity(db, user.id).lessons_completed += 1
        P.log_study(db, user.id, unit_id, completed=True, score=score)
    db.commit()
    return _result(t) | {"xp_gained": xp}


def _result(t: LessonTestOut) -> dict:
    return {"test_id": t.id, "passed": bool(t.passed), "correct": t.correct, "total": t.total, "pass_mark": pass_mark(t.total or len(t.items))}


# ------------------------------------------------------------------ grammar sprint
LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2"]


def sprint_overview(db: Session, user: User, store: ContentStore) -> dict:
    """Every grammar lesson A0→B2 in route order with its status, today's count and totals per level.

    done        lesson completed (full study, test-out or sprint)
    study       studied but not good enough (score below the pass mark, or a sprint/test-out within 24 h not
                passed) → study it fully later; it does not block the queue
    todo        not done yet (the queue)
    The queue continues from the lesson the learner worked on most recently (not from the first gap in the route).
    """
    from .vocabulary.service import day_bounds

    start_local, _ = day_bounds()  # the learner's day (local midnight, as naive UTC)
    prog = {p.unit_id: p for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id))}
    tests: dict[str, LessonTestOut] = {}
    for t in db.scalars(select(LessonTestOut).where(LessonTestOut.user_id == user.id).order_by(LessonTestOut.id)):
        tests[t.unit_id] = t
    units, levels = [], {}
    for u in store.unit_list:
        if u.kind != "grammar" or u.level not in LEVEL_ORDER:
            continue
        p, t = prog.get(u.id), tests.get(u.id)
        if p and p.completed_at and p.status == "completed":
            status = "done"
        elif (p and p.completed_at and p.status == "review") or (t and t.finished_at and not t.passed and utcnow() - t.started_at < COOLDOWN):
            status = "study"
        else:
            status = "todo"
        units.append({"id": u.id, "title": u.title, "level": u.level, "status": status, "minutes": u.minutes,
                      "done_today": bool(p and p.completed_at and p.completed_at >= start_local),
                      "in_progress": bool(p and not p.completed_at and (p.max_step or 0) > 0),
                      # last activity on this lesson: progress saved or a sprint/test-out started
                      "_touched": max([d for d in (p.updated_at if p else None, t.started_at if t else None) if d] or [None])})
        lv = levels.setdefault(u.level, {"level": u.level, "total": 0, "done": 0})
        lv["total"] += 1
        lv["done"] += status == "done"
    done = sum(1 for u in units if u["status"] == "done")
    # continue where the learner last worked: the most recently touched unfinished lesson, else the first one to do
    # after the most recently touched lesson, else the first one to do in the route
    touched = [u for u in units if u["_touched"]]
    nxt = None
    if touched:
        last = max(touched, key=lambda u: u["_touched"])  # the lesson the learner touched most recently
        if last["status"] == "todo":
            nxt = last
        else:
            i = units.index(last)
            nxt = next((u for u in units[i + 1:] if u["status"] == "todo"), None)
    nxt = nxt or next((u for u in units if u["status"] == "todo"), None)
    for u in units:
        u.pop("_touched")
    if nxt is not None:  # queue order: from the next lesson on, then the earlier gaps
        i = units.index(nxt)
        queue = [u["id"] for u in units[i:] + units[:i] if u["status"] == "todo"]
    else:
        queue = []
    return {"units": units, "queue": queue, "total": len(units), "done": done, "remaining": len(units) - done,
            "today": sum(1 for u in units if u["done_today"]), "study": [u for u in units if u["status"] == "study"],
            "next": nxt,
            "levels": [levels[lv] for lv in LEVEL_ORDER if lv in levels]}
