"""Spaced repetition with FSRS — the open-spaced-repetition `fsrs` Python package (py-fsrs, MIT licence).

The scheduling maths is entirely the library's (default FSRS-6 parameters). This module only maps between our
database row and py-fsrs `Card`, and defines product-level labels on top of the library state:
  new         no review yet
  learning / review / relearning   py-fsrs State
  mastered    product criterion (not an FSRS state): in Review, stability ≥ 21 days, ≥ 3 successful reviews,
              last rating Good/Easy
Retention figures are FSRS retrievability estimates from review history — estimates, not measurements.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache

from fsrs import Card, Rating, Scheduler, State

from ..models import VocabProgress

ALGORITHM = "FSRS-6 (py-fsrs)"
RATINGS = {1: "again", 2: "hard", 3: "good", 4: "easy"}
STATE_NAMES = {State.Learning: "learning", State.Review: "review", State.Relearning: "relearning"}
MASTERED_STABILITY_DAYS = 21
DEFAULT_RETENTION = 0.9


def utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def naive(dt: datetime | None) -> datetime | None:
    return None if dt is None else utc(dt).replace(tzinfo=None)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


@lru_cache(maxsize=16)
def scheduler(desired_retention: float = DEFAULT_RETENTION) -> Scheduler:
    # One 10-minute learning step: a word answered well after being taught graduates to day-level intervals;
    # a forgotten word comes back after 10 minutes (relearning). Fuzzing is off so schedules are reproducible.
    return Scheduler(desired_retention=max(0.7, min(0.97, desired_retention)),
                     learning_steps=(timedelta(minutes=10),), relearning_steps=(timedelta(minutes=10),),
                     enable_fuzzing=False)


def card_of(p: VocabProgress) -> Card:
    if p.fsrs:
        return Card.from_dict(p.fsrs)
    return Card(card_id=p.id or None)


def apply_card(p: VocabProgress, card: Card) -> None:
    p.fsrs = card.to_dict()
    p.state = STATE_NAMES.get(card.state, "learning")
    p.due = naive(card.due)
    p.stability = card.stability
    p.difficulty = card.difficulty
    p.last_review = naive(card.last_review)


def review(p: VocabProgress, rating: int, *, now: datetime | None = None, retention: float = DEFAULT_RETENTION,
           duration_ms: int | None = None) -> dict:
    """Apply one rating (1–4). Returns before/after info for the review log."""
    if rating not in RATINGS:
        raise ValueError("rating must be 1–4")
    now = utc(now) or now_utc()
    before_state = p.state or "new"
    before_review = utc(p.last_review)
    card, _log = scheduler(retention).review_card(card_of(p), Rating(rating), review_datetime=now, review_duration=duration_ms)
    if before_state == "review" and rating == 1:
        p.lapses = (p.lapses or 0) + 1
    p.reps = (p.reps or 0) + 1
    p.last_rating = rating
    apply_card(p, card)
    elapsed = (now - before_review).total_seconds() / 86400 if before_review else None
    return {"state_before": before_state, "state_after": p.state, "elapsed_days": elapsed, "due_after": p.due}


def retrievability(p: VocabProgress, now: datetime | None = None, retention: float = DEFAULT_RETENTION) -> float | None:
    if not p.fsrs or p.state == "new":
        return None
    return float(scheduler(retention).get_card_retrievability(card_of(p), current_datetime=utc(now) or now_utc()))


def preview(p: VocabProgress, now: datetime | None = None, retention: float = DEFAULT_RETENTION) -> dict[str, str]:
    """Next due time for each rating (shown under the flashcard buttons). Pure computation; nothing is saved."""
    now = utc(now) or now_utc()
    out = {}
    for r, name in RATINGS.items():
        card, _ = scheduler(retention).review_card(card_of(p), Rating(r), review_datetime=now)
        out[name] = naive(card.due).isoformat()
    return out


def is_mastered(p: VocabProgress) -> bool:
    return (p.state == "review" and (p.stability or 0) >= MASTERED_STABILITY_DAYS and (p.correct_count or 0) >= 3
            and (p.last_rating or 0) >= 3)


def label(p: VocabProgress | None) -> str:
    if p is None or p.state in (None, "new"):
        return "new"
    return "mastered" if is_mastered(p) else p.state


def from_sm2(p: VocabProgress, *, ease: float, interval_days: int, repetitions: int, lapses: int, due, last_reviewed) -> None:
    """Approximate conversion of an old SM-2 card (kept in vocab_cards) into an FSRS card.

    Stability ≈ the SM-2 interval (the time the card was expected to stay recallable); difficulty from ease
    (ease 2.5 → 5, 1.3 → 9.8). Cards never passed (repetitions 0) become relearning/learning cards due now.
    """
    last = utc(last_reviewed) or now_utc()
    due_dt = datetime(due.year, due.month, due.day, tzinfo=timezone.utc) if due else now_utc()
    difficulty = max(1.0, min(10.0, 5.0 + (2.5 - (ease or 2.5)) * 4.0))
    if repetitions and interval_days >= 1:
        card = Card(state=State.Review, step=None, stability=float(max(interval_days, 1)), difficulty=difficulty,
                    due=due_dt, last_review=last)
    else:
        card = Card(state=State.Relearning if lapses else State.Learning, step=0, stability=1.0, difficulty=difficulty,
                    due=due_dt, last_review=last)
    p.reps = repetitions + lapses
    p.lapses = lapses
    p.last_rating = 3 if repetitions else 1
    p.correct_count = repetitions
    apply_card(p, card)
