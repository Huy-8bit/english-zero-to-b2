"""Vocabulary cards (parsed from 07-VOCABULARY tables) and SM-2 reviews."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..content.store import ContentStore
from ..models import User, VocabCard, VocabReview
from ..schemas import VocabReviewIn
from ..services import progress as P
from .deps import current_user, get_db, get_store

router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])


def _state(c: VocabCard | None) -> dict | None:
    if c is None:
        return None
    return {"due": c.due.isoformat(), "interval_days": c.interval_days, "repetitions": c.repetitions, "ease": round(c.ease, 2),
            "lapses": c.lapses}


@router.get("")
def vocabulary(unit: str | None = None, db: Session = Depends(get_db), store: ContentStore = Depends(get_store),
               user: User = Depends(current_user)):
    states = {c.card_id: c for c in db.scalars(select(VocabCard).where(VocabCard.user_id == user.id))}
    cards = [c for c in store.cards() if unit is None or c["unit_id"] == unit]
    units = {}
    for c in store.cards():
        u = units.setdefault(c["unit_id"], {"id": c["unit_id"], "title": c["unit_title"], "cards": 0, "seen": 0})
        u["cards"] += 1
        u["seen"] += int(c["id"] in states)
    return {"cards": [{**c, "srs": _state(states.get(c["id"]))} for c in cards], "units": list(units.values())}


@router.get("/due")
def due(limit: int = Query(20, ge=1, le=100), unit: str | None = None, new: int = Query(10, ge=0, le=50),
        db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    """Due cards first (oldest first), then up to `new` unseen cards in curriculum order."""
    by_id = {c["id"]: c for c in store.cards() if unit is None or c["unit_id"] == unit}
    states = {c.card_id: c for c in db.scalars(select(VocabCard).where(VocabCard.user_id == user.id))}
    due_cards = sorted((s for s in states.values() if s.due <= P.today() and s.card_id in by_id), key=lambda s: s.due)
    out = [{**by_id[s.card_id], "srs": _state(s)} for s in due_cards[:limit]]
    if len(out) < limit and new:
        fresh = [c for cid, c in by_id.items() if cid not in states][: min(new, limit - len(out))]
        out += [{**c, "srs": None} for c in fresh]
    return {"cards": out, "due_total": len(due_cards)}


@router.post("/review")
def review(body: VocabReviewIn, db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    if not any(c["id"] == body.card_id for c in store.cards()):
        raise HTTPException(404, "Card not found")
    card = db.scalar(select(VocabCard).where(VocabCard.user_id == user.id, VocabCard.card_id == body.card_id))
    if card is None:
        card = VocabCard(user_id=user.id, card_id=body.card_id, ease=2.5, interval_days=0, repetitions=0, lapses=0, due=P.today())
        db.add(card)
    P.sm2(card, body.grade)
    db.add(VocabReview(user_id=user.id, card_id=body.card_id, grade=body.grade))
    P.activity(db, user.id).cards_reviewed += 1
    xp = P.award(db, user.id, f"vocab:{body.card_id}:{P.today().isoformat()}", "vocab_review", P.XP_RULES["vocab_review"])
    badges = P.check_achievements(db, user.id, store)
    db.commit()
    return {"card_id": body.card_id, "srs": _state(card), "xp_gained": xp, "new_achievements": badges}


@router.get("/stats")
def stats(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    states = list(db.scalars(select(VocabCard).where(VocabCard.user_id == user.id)))
    return {"total": len(store.cards()), "seen": len(states), "due": sum(1 for s in states if s.due <= P.today()),
            "mature": sum(1 for s in states if s.interval_days >= 21), "learning": sum(1 for s in states if 0 < s.interval_days < 21)}
