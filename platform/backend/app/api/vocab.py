"""Curriculum flashcards inside lessons (/api/vocabulary, card ids like "VOC-01:wake-up").

Kept for the lesson player and old clients, but backed by the single vocabulary system: each card id maps to a lexicon
entry (vocab_legacy_cards) and reviews are scheduled by FSRS in vocab_progress. Grades 1/3/4/5 from the old UI map to
Again/Hard/Good/Easy. The old SM-2 rows (vocab_cards) are kept read-only and were migrated once.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..content.store import ContentStore
from ..models import User, VocabLegacyCard, VocabProgress, VocabReviewLog
from ..schemas import VocabReviewIn
from ..services import progress as P
from ..vocabulary import lexicon, srs
from ..vocabulary.service import get_progress, mark_seen, settings
from .deps import current_user, get_db, get_store

router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])
GRADE_TO_RATING = {0: 1, 1: 1, 2: 1, 3: 2, 4: 3, 5: 4}


def _mapping(db: Session) -> dict[str, str]:
    lexicon.ensure_imported(db)
    return dict(db.execute(select(VocabLegacyCard.card_id, VocabLegacyCard.entry_id)).all())


def _state(p: VocabProgress | None) -> dict | None:
    if p is None or p.state == "new":
        return None
    days = round(p.stability, 1) if p.stability else 0
    return {"due": p.due.date().isoformat() if p.due else None, "interval_days": days, "repetitions": p.reps,
            "stability": p.stability, "difficulty": p.difficulty, "state": srs.label(p), "lapses": p.lapses, "algorithm": srs.ALGORITHM}


def _states(db: Session, user_id: int, mapping: dict[str, str]) -> dict[str, VocabProgress]:
    prog = {p.entry_id: p for p in db.scalars(select(VocabProgress).where(VocabProgress.user_id == user_id))}
    return {cid: prog[eid] for cid, eid in mapping.items() if eid in prog}


@router.get("")
def vocabulary(unit: str | None = None, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
               user: User = Depends(current_user)):
    mapping = _mapping(db)
    states = _states(db, user.id, mapping)
    cards = [c for c in store.cards() if unit is None or c["unit_id"] == unit]
    units = {}
    for c in store.cards():
        u = units.setdefault(c["unit_id"], {"id": c["unit_id"], "title": c["unit_title"], "cards": 0, "seen": 0})
        u["cards"] += 1
        u["seen"] += int(_state(states.get(c["id"])) is not None)
    return {"cards": [{**c, "entry_id": mapping.get(c["id"]), "srs": _state(states.get(c["id"]))} for c in cards],
            "units": list(units.values())}


@router.get("/due")
def due(limit: int = Query(20, ge=1, le=100), unit: str | None = None, new: int = Query(10, ge=0, le=50),
        db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    mapping = _mapping(db)
    by_id = {c["id"]: c for c in store.cards() if unit is None or c["unit_id"] == unit}
    states = _states(db, user.id, mapping)
    now = srs.naive(srs.now_utc())
    due_cards = sorted(((cid, p) for cid, p in states.items() if cid in by_id and p.state != "new" and p.due and p.due <= now
                        and not p.suspended and not p.known), key=lambda x: x[1].due)
    out = [{**by_id[cid], "entry_id": mapping.get(cid), "srs": _state(p)} for cid, p in due_cards[:limit]]
    if len(out) < limit and new:
        fresh = [c for cid, c in by_id.items() if _state(states.get(cid)) is None][: min(new, limit - len(out))]
        out += [{**c, "entry_id": mapping.get(c["id"]), "srs": None} for c in fresh]
    return {"cards": out, "due_total": len(due_cards)}


@router.post("/review")
def review(body: VocabReviewIn, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    eid = _mapping(db).get(body.card_id)
    if eid is None:
        raise HTTPException(404, "Card not found")
    p = get_progress(db, user.id, eid, source="lesson")
    mark_seen(p)
    was_learned = p.learned_at is not None
    rating = GRADE_TO_RATING.get(body.grade, 1)
    info = srs.review(p, rating, retention=float(settings(db, user.id)["retention"]))
    if rating >= 2:
        p.correct_count = (p.correct_count or 0) + 1
        p.first_correct_at = p.first_correct_at or p.last_review
        p.learned_at = p.learned_at or p.last_review
        if info["elapsed_days"] and info["elapsed_days"] >= 1:
            p.recalled_after_delay_at = p.recalled_after_delay_at or p.last_review
    else:
        p.incorrect_count = (p.incorrect_count or 0) + 1
    db.add(VocabReviewLog(user_id=user.id, entry_id=eid, mode="flashcard", rating=rating, correct=rating >= 2, verdict=srs.RATINGS[rating],
                          response={"card_id": body.card_id, "grade": body.grade}, state_before=info["state_before"], state_after=info["state_after"],
                          elapsed_days=info["elapsed_days"], due_after=info["due_after"]))
    P.activity(db, user.id).cards_reviewed += 1
    P.log_study(db, user.id, "vocab", kind="module", items=1, correct=int(rating >= 2), cards=1,
                learned=int(not was_learned and p.learned_at is not None))
    xp = P.award(db, user.id, f"vocab:{eid}:{P.today().isoformat()}", "vocab_review", P.XP_RULES["vocab_review"])
    badges = P.check_achievements(db, user.id, store)
    db.commit()
    return {"card_id": body.card_id, "entry_id": eid, "srs": _state(p), "xp_gained": xp, "new_achievements": badges}


@router.get("/stats")
def stats(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    states = list(_states(db, user.id, _mapping(db)).values())
    now = srs.naive(srs.now_utc())
    active = [s for s in states if s.state != "new"]
    return {"total": len(store.cards()), "seen": len(active), "due": sum(1 for s in active if s.due and s.due <= now),
            "mature": sum(1 for s in active if (s.stability or 0) >= 21), "learning": sum(1 for s in active if (s.stability or 0) < 21)}
