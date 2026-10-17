"""Learning data. One row per (user, thing) where duplicates would corrupt progress."""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), default="Learner")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    daily_goal_minutes: Mapped[int] = mapped_column(Integer, default=20)
    weekly_goal_lessons: Mapped[int] = mapped_column(Integer, default=5)
    last_unit_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("user_id", "unit_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")  # in_progress | completed | review
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    max_step: Mapped[int] = mapped_column(Integer, default=0)
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    state: Mapped[dict] = mapped_column(JSON, default=dict)  # unsent drafts, checklist, highlights
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    best_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    time_spent_sec: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completions: Mapped[int] = mapped_column(Integer, default=0)


class Attempt(Base):
    __tablename__ = "attempts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[str] = mapped_column(String(64), index=True)
    quiz_id: Mapped[str] = mapped_column(String(80), index=True)
    item_id: Mapped[str] = mapped_column(String(96), index=True)
    response: Mapped[str] = mapped_column(Text, default="")
    verdict: Mapped[str] = mapped_column(String(16))  # correct | incorrect | mismatch | submitted
    auto: Mapped[bool] = mapped_column(Boolean, default=False)
    self_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class XPEvent(Base):
    __tablename__ = "xp_events"
    __table_args__ = (UniqueConstraint("user_id", "key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    key: Mapped[str] = mapped_column(String(160))
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Achievement(Base):
    __tablename__ = "achievements"
    __table_args__ = (UniqueConstraint("user_id", "key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    key: Mapped[str] = mapped_column(String(64))
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class VocabCard(Base):
    __tablename__ = "vocab_cards"
    __table_args__ = (UniqueConstraint("user_id", "card_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    card_id: Mapped[str] = mapped_column(String(128), index=True)
    ease: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    lapses: Mapped[int] = mapped_column(Integer, default=0)
    due: Mapped[date] = mapped_column(Date, index=True)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class VocabReview(Base):
    __tablename__ = "vocab_reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    card_id: Mapped[str] = mapped_column(String(128), index=True)
    grade: Mapped[int] = mapped_column(Integer)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class ActivityDay(Base):
    __tablename__ = "activity_days"
    __table_args__ = (UniqueConstraint("user_id", "day"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    items_answered: Mapped[int] = mapped_column(Integer, default=0)
    lessons_completed: Mapped[int] = mapped_column(Integer, default=0)
    cards_reviewed: Mapped[int] = mapped_column(Integer, default=0)


class WritingEntry(Base):
    __tablename__ = "writing_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[str] = mapped_column(String(64), index=True)
    item_id: Mapped[str] = mapped_column(String(96), index=True)
    text: Mapped[str] = mapped_column(Text)
    word_count: Mapped[int] = mapped_column(Integer)
    seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rubric: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (UniqueConstraint("user_id", "unit_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[str] = mapped_column(String(64))
    text: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
