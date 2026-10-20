"""Progress persistence, quiz submission, completion, mistakes, writing history, notes, activity."""
from __future__ import annotations

import json
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..content.store import ContentStore
from ..models import Attempt, LessonProgress, Note, QuizSubmission, User, WritingEntry, utcnow
from ..schemas import HeartbeatIn, NoteIn, ProgressIn, QuizSubmitIn, SelfAssessIn, WritingIn
from ..content.md import strip_md
from ..services import adaptive
from ..services import progress as P
from ..services.grading import grade
from .deps import current_user, get_db, get_store
from .results import result_payload

router = APIRouter(prefix="/api", tags=["learning"])


def _progress(db: Session, user: User, unit_id: str, total: int) -> LessonProgress:
    p = db.scalar(select(LessonProgress).where(LessonProgress.user_id == user.id, LessonProgress.unit_id == unit_id))
    if p is None:
        p = LessonProgress(user_id=user.id, unit_id=unit_id, status="in_progress", current_step=0, max_step=0,
                           total_steps=total, state={}, time_spent_sec=0, completions=0)
        db.add(p)
        db.flush()
    p.total_steps = total
    return p


@router.get("/progress")
def all_progress(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [{"unit_id": p.unit_id, "status": p.status, "current_step": p.current_step, "max_step": p.max_step,
             "total_steps": p.total_steps, "score": p.score, "best_score": p.best_score, "time_spent_sec": p.time_spent_sec,
             "updated_at": p.updated_at.isoformat(), "completed_at": p.completed_at.isoformat() if p.completed_at else None}
            for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id))]


@router.put("/progress/{unit_id}")
def save_progress(unit_id: str, body: ProgressIn, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
                  user: User = Depends(current_user)):
    b = store.built(unit_id)
    if b is None:
        raise HTTPException(404, "Lesson not found")
    total = len(b.steps)
    step = min(body.current_step, max(0, total - 1))
    p = _progress(db, user, unit_id, total)
    previous_stamp = (p.state or {}).get("savedAt")
    incoming_stamp = (body.state or {}).get("savedAt")
    if isinstance(previous_stamp, (int, float)) and isinstance(incoming_stamp, (int, float)) and incoming_stamp < previous_stamp:
        # A keepalive save from a previous page must not replace a newer draft.
        return {"current_step": p.current_step, "max_step": p.max_step, "status": p.status}
    p.current_step = step
    p.max_step = max(p.max_step, step)
    if body.state is not None:
        p.state = body.state
    user.last_unit_id = unit_id
    db.commit()
    return {"current_step": p.current_step, "max_step": p.max_step, "status": p.status}


@router.get("/quizzes/{quiz_id}")
def get_quiz(quiz_id: str, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    unit_id = quiz_id.split(":", 1)[0]
    b = store.built(unit_id)
    step = next((s for s in (b.steps if b else []) if s.get("quiz_id") == quiz_id), None)
    if step is None:
        raise HTTPException(404, "Quiz not found")
    latest = P.latest_attempts(db, user.id, quiz_id=quiz_id)
    return {"unit_id": unit_id, "step": step, "results": {i: result_payload(b.items[i], a) for i, a in latest.items() if i in b.items}}


@router.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: str, body: QuizSubmitIn, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
                user: User = Depends(current_user)):
    request_hash = hashlib.sha256(json.dumps({"answers": body.answers, "reveal": sorted(body.reveal)} if body.reveal else body.answers,
                                             sort_keys=True, ensure_ascii=False).encode()).hexdigest()

    def previous_submission():
        if not body.client_submission_id:
            return None
        previous = db.scalar(select(QuizSubmission).where(QuizSubmission.user_id == user.id,
                                                         QuizSubmission.client_submission_id == body.client_submission_id))
        if previous and (previous.quiz_id != quiz_id or previous.request_hash != request_hash):
            raise HTTPException(409, "Mã nộp bài đã dùng cho nội dung khác.")
        return previous

    if previous := previous_submission():
        return {**previous.result, "xp_gained": 0, "new_achievements": []}
    unit_id = quiz_id.split(":", 1)[0]
    b = store.built(unit_id)
    if b is None:
        raise HTTPException(404, "Quiz not found")
    items = {iid: it for iid, it in b.items.items() if it.quiz_id == quiz_id}
    if not items:
        raise HTTPException(404, "Quiz not found")
    unknown = [k for k in [*body.answers, *body.reveal] if k not in items]
    if unknown:
        raise HTTPException(422, f"Items not in this quiz: {unknown[:5]}")
    reveal = [k for k in dict.fromkeys(body.reveal) if k not in body.answers]
    if reveal and any(s.get("quiz_id") == quiz_id and s.get("defer") for s in b.steps):
        raise HTTPException(409, "Bài kiểm tra chỉ hiện đáp án sau khi nộp cả bài.")
    first_time = not db.scalar(select(Attempt.id).where(Attempt.user_id == user.id, Attempt.quiz_id == quiz_id))
    results, xp = {}, 0
    for iid, value in body.answers.items():
        it = items[iid]
        g = grade(it, value)
        resp = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        a = Attempt(user_id=user.id, unit_id=unit_id, quiz_id=quiz_id, item_id=iid, response=resp or "",
                    verdict=g["verdict"], auto=g["auto"])
        db.add(a)
        db.flush()
        if g["verdict"] == "correct":
            xp += P.award(db, user.id, f"item:{iid}", "auto_correct", P.XP_RULES["auto_correct"])
        elif g["verdict"] == "submitted" and it.kind in ("long", "speaking") and str(value or "").strip():
            xp += P.award(db, user.id, f"item:{iid}", "production", P.XP_RULES["production"])
        results[iid] = result_payload(it, a)
        _learning_hooks(db, user.id, b, it, g["verdict"], resp or "")
    for iid in reveal:
        # "I don't know": show the answer now; it counts as not correct (mistake notebook, smart review, retry)
        it = items[iid]
        a = Attempt(user_id=user.id, unit_id=unit_id, quiz_id=quiz_id, item_id=iid, response="", verdict="revealed", auto=False)
        db.add(a)
        db.flush()
        results[iid] = result_payload(it, a)
        _learning_hooks(db, user.id, b, it, "incorrect", REVEALED_ANSWER)
    act = P.activity(db, user.id)
    act.items_answered += len(body.answers) + len(reveal)
    P.log_study(db, user.id, unit_id, items=len(body.answers) + len(reveal), correct=sum(1 for r in results.values() if r.get("verdict") == "correct"))
    auto = [r for r in results.values() if r["auto"]]
    new_badges = []
    if first_time and len(auto) >= 3 and len(auto) == len(items) and all(r["verdict"] == "correct" for r in auto):
        if P.grant_achievement(db, user.id, "perfect_quiz"):
            new_badges.append("perfect_quiz")
    p = _progress(db, user, unit_id, len(b.steps))
    if p.status == "not_started":
        p.status = "in_progress"
    user.last_unit_id = unit_id
    new_badges += P.check_achievements(db, user.id, store)
    payload = {"results": results, "xp_gained": xp, "new_achievements": new_badges}
    if body.client_submission_id:
        db.add(QuizSubmission(user_id=user.id, client_submission_id=body.client_submission_id,
                              quiz_id=quiz_id, request_hash=request_hash, result=payload))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if previous := previous_submission():
            return {**previous.result, "xp_gained": 0, "new_achievements": []}
        raise
    return payload


@router.post("/attempts/{attempt_id}/self-assess")
def self_assess(attempt_id: int, body: SelfAssessIn, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
                user: User = Depends(current_user)):
    a = db.get(Attempt, attempt_id)
    if a is None or a.user_id != user.id:
        raise HTTPException(404, "Attempt not found")
    if a.verdict not in ("mismatch", "submitted"):
        raise HTTPException(409, "This answer was graded automatically")
    if a.self_correct == body.correct:
        it = store.item(a.item_id)
        return {"result": result_payload(it, a) if it else None, "xp_gained": 0}
    newly_correct = body.correct and a.self_correct is not True
    a.self_correct = body.correct
    if newly_correct:
        P.log_study(db, user.id, a.unit_id, correct=1)
    it_sa = store.item(a.item_id)
    b_sa = store.built(a.unit_id)
    if it_sa is not None and b_sa is not None:
        _learning_hooks(db, user.id, b_sa, it_sa, "correct" if body.correct else "incorrect", a.response)
    xp = 0
    if body.correct:
        xp = P.award(db, user.id, f"item:{a.item_id}", "self_correct", P.XP_RULES["self_correct"])
    db.commit()
    it = store.item(a.item_id)
    return {"result": result_payload(it, a) if it else None, "xp_gained": xp}


@router.post("/lessons/{unit_id}/complete")
def complete(unit_id: str, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    b = store.built(unit_id)
    if b is None:
        raise HTTPException(404, "Lesson not found")
    p = _progress(db, user, unit_id, len(b.steps))
    if p.max_step < len(b.steps) - 1:
        raise HTTPException(409, f"Lesson not finished: reached step {p.max_step + 1}/{len(b.steps)}")
    score, correct, graded = P.unit_score(db, user.id, unit_id)
    p.score = score
    p.best_score = score if p.best_score is None or (score is not None and score > p.best_score) else p.best_score
    p.status = "review" if score is not None and score < P.PASS_SCORE else "completed"
    first = p.completed_at is None
    p.completed_at = p.completed_at or utcnow()
    p.completions += 1
    xp = P.award(db, user.id, f"lesson:{unit_id}", "lesson_complete", P.XP_RULES["lesson_complete"])
    if first:
        P.activity(db, user.id).lessons_completed += 1
    P.log_study(db, user.id, unit_id, completed=True, score=score)
    badges = P.check_achievements(db, user.id, store)
    db.commit()
    level_done = None
    if b.unit.kind == "grammar" and f"level_{b.unit.level}" in badges:
        level_done = b.unit.level
    return {"status": p.status, "score": score, "correct": correct, "graded": graded, "xp_gained": xp,
            "new_achievements": badges, "level_completed": level_done, "pass_score": P.PASS_SCORE}


@router.get("/grammar-sprint")
def grammar_sprint(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    """Grammar sprint: every grammar lesson A0→B2 with its status, the next one, today's count."""
    from .. import test_out

    return test_out.sprint_overview(db, user, store)


@router.post("/lessons/{unit_id}/test-out")
def test_out_start(unit_id: str, size: int = 8, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
                   user: User = Depends(current_user)):
    """'Kiểm tra vượt bài': the server picks the questions; answer them with the normal quiz endpoint, then call finish."""
    from .. import test_out

    if store.built(unit_id) is None:
        raise HTTPException(404, "Lesson not found")
    try:
        return test_out.start(db, user, store, unit_id, size=size)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    except PermissionError as e:
        raise HTTPException(429, str(e)) from None


@router.post("/lessons/{unit_id}/test-out/{test_id}/finish")
def test_out_finish(unit_id: str, test_id: int, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
                    user: User = Depends(current_user)):
    from .. import test_out

    try:
        return test_out.finish(db, user, store, unit_id, test_id)
    except LookupError as e:
        raise HTTPException(404, str(e)) from None
    except ValueError as e:
        raise HTTPException(409, str(e)) from None


@router.get("/mistakes")
def mistakes(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    out = []
    for m in P.recent_mistakes(db, user.id, store, limit=200):
        b = store.built(m["unit_id"])
        if not b:
            continue
        step = next((s for s in b.steps if s.get("quiz_id") == m["quiz_id"]), None)
        pub = next((i for i in (step or {}).get("items", []) if i["id"] == m["item_id"]), None)
        if pub:
            out.append({**m, "item": pub, "step_title": step["title"]})
    return {"mistakes": out}


@router.post("/activity/heartbeat")
def activity_heartbeat(body: HeartbeatIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    seconds = P.heartbeat(db, user, body.unit_id, body.activity)
    db.commit()
    return {"counted_seconds": seconds}


@router.post("/writing")
def save_writing(body: WritingIn, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    if store.item(body.item_id) is None:
        raise HTTPException(404, "Task not found")
    words = len(body.text.split())
    e = WritingEntry(user_id=user.id, unit_id=body.unit_id, item_id=body.item_id, text=body.text, word_count=words,
                     seconds=body.seconds, rubric=body.rubric)
    db.add(e)
    db.commit()
    return {"id": e.id, "word_count": words, "created_at": e.created_at.isoformat()}


@router.get("/writing")
def writing_history(item_id: str | None = None, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
                    user: User = Depends(current_user)):
    q = select(WritingEntry).where(WritingEntry.user_id == user.id)
    if item_id:
        q = q.where(WritingEntry.item_id == item_id)
    rows = db.scalars(q.order_by(WritingEntry.created_at.desc()).limit(200))
    return [{"id": e.id, "unit_id": e.unit_id, "unit_title": store.units[e.unit_id].title if e.unit_id in store.units else e.unit_id,
             "item_id": e.item_id, "text": e.text, "word_count": e.word_count, "seconds": e.seconds, "rubric": e.rubric,
             "created_at": e.created_at.isoformat()} for e in rows]


@router.get("/notes/{unit_id}")
def get_note(unit_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    n = db.scalar(select(Note).where(Note.user_id == user.id, Note.unit_id == unit_id))
    return {"unit_id": unit_id, "text": n.text if n else "", "updated_at": n.updated_at.isoformat() if n else None}


@router.put("/notes/{unit_id}")
def put_note(unit_id: str, body: NoteIn, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
             user: User = Depends(current_user)):
    if store.unit(unit_id) is None:
        raise HTTPException(404, "Lesson not found")
    n = db.scalar(select(Note).where(Note.user_id == user.id, Note.unit_id == unit_id))
    if n is None:
        n = Note(user_id=user.id, unit_id=unit_id, text=body.text)
        db.add(n)
    else:
        n.text = body.text
    db.commit()
    return {"unit_id": unit_id, "text": n.text, "updated_at": n.updated_at.isoformat()}



REVEALED_ANSWER = "(không biết — đã xem đáp án)"


def _learning_hooks(db: Session, user_id: int, built, item, verdict: str, response: str) -> None:
    """Curriculum answers feed the knowledge model and the mistake notebook (graded results only)."""
    if verdict not in ("correct", "incorrect") or item.kind in ("long", "speaking"):
        return
    ok = verdict == "correct"
    adaptive.record_result(db, user_id, built.unit.id, 1.0 if ok else 0.0, "normal", None)
    key = f"cur:{item.id}"
    if ok:
        adaptive.record_mistake_success(db, user_id, key)
        return
    prompt = next((x["prompt_md"] for st in built.steps for x in st.get("items") or [] if x["id"] == item.id), "")
    if item.options and item.correct_option:
        corrected = next((f"{o['key']}. {strip_md(o['text'])}" for o in item.options if o["key"] == item.correct_option), item.correct_option)
    else:
        corrected = strip_md(item.model_md)[:500]
    adaptive.record_mistake(db, user_id, key=key, source_type="curriculum", source_ref=item.id, question_text=strip_md(prompt)[:1000],
                            student_answer=response, corrected_answer=corrected, error_type="other",
                            explanation=strip_md(item.explanation_md)[:1000], topic_id=built.unit.id)
