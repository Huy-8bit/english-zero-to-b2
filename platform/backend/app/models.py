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


class QuizSubmission(Base):
    __tablename__ = "quiz_submissions"
    __table_args__ = (UniqueConstraint("user_id", "client_submission_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    client_submission_id: Mapped[str] = mapped_column(String(64))
    quiz_id: Mapped[str] = mapped_column(String(80))
    request_hash: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


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
    # set when the learner asks the AI to grade an open answer (see grading_feedback)
    ai_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    ai_score: Mapped[float | None] = mapped_column(Float, nullable=True)
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


# ============================================================================ AI-powered learning

class LearningProfile(Base):
    """Per-user learning preferences and AI limits (one row per user)."""
    __tablename__ = "learning_profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    target_level: Mapped[str] = mapped_column(String(4), default="B2")
    explanation_language: Mapped[str] = mapped_column(String(8), default="vi")  # vi | vi_en
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_request_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_budget_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_audio_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_exercise_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    feature: Mapped[str] = mapped_column(String(40), index=True)
    model: Mapped[str] = mapped_column(String(80))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    audio_seconds: Mapped[float] = mapped_column(Float, default=0)
    characters: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="ok")  # ok | error | cached
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class AICache(Base):
    __tablename__ = "ai_cache"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    feature: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(80))
    payload: Mapped[dict] = mapped_column(JSON)
    hits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ExerciseSet(Base):
    """A persisted set of generated questions (practice, listening, reading, placement, mistakes review)."""
    __tablename__ = "exercise_sets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16), default="practice", index=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    lesson_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    topic_ids: Mapped[list] = mapped_column(JSON, default=list)
    level: Mapped[str | None] = mapped_column(String(4), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(12), default="normal")
    objectives: Mapped[list] = mapped_column(JSON, default=list)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)  # passage, transcript, audio, vocabulary, generation info
    parent_set_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class ExerciseQuestion(Base):
    __tablename__ = "exercise_questions"
    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    set_id: Mapped[str] = mapped_column(ForeignKey("exercise_sets.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    qtype: Mapped[str] = mapped_column(String(32))
    level: Mapped[str | None] = mapped_column(String(4), nullable=True)
    topic_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    question_text: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(JSON, default=list)
    extra: Mapped[dict] = mapped_column(JSON, default=dict)  # tokens, pairs, evidence…
    answer_key: Mapped[dict] = mapped_column(JSON)  # never sent before submission
    explanation_vi: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String(12), default="normal")
    learning_objective: Mapped[str] = mapped_column(Text, default="")
    grammar_rule: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)


class ExerciseSubmission(Base):
    __tablename__ = "exercise_submissions"
    __table_args__ = (UniqueConstraint("user_id", "client_submission_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    set_id: Mapped[str] = mapped_column(ForeignKey("exercise_sets.id", ondelete="CASCADE"), index=True)
    client_submission_id: Mapped[str] = mapped_column(String(64))
    score: Mapped[float] = mapped_column(Float, default=0)
    max_score: Mapped[float] = mapped_column(Float, default=0)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class QuestionResponse(Base):
    __tablename__ = "question_responses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("exercise_submissions.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("exercise_questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    answer: Mapped[str] = mapped_column(Text, default="")
    correctness: Mapped[str] = mapped_column(String(16))  # correct | partial | incorrect | needs_review | unanswered
    score: Mapped[float] = mapped_column(Float, default=0)
    grader: Mapped[str] = mapped_column(String(16))  # deterministic | ai
    feedback: Mapped[dict] = mapped_column(JSON, default=dict)
    time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FeedbackMessage(Base):
    """Follow-up AI explanations attached to one question/attempt (why wrong, another example…)."""
    __tablename__ = "feedback_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_type: Mapped[str] = mapped_column(String(16))  # question | attempt | writing
    target_id: Mapped[str] = mapped_column(String(96), index=True)
    action: Mapped[str] = mapped_column(String(24))
    content: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class GradingFeedback(Base):
    """AI grading of a curriculum attempt (open answers in lessons)."""
    __tablename__ = "grading_feedback"
    __table_args__ = (UniqueConstraint("attempt_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"))
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TopicMastery(Base):
    __tablename__ = "topic_mastery"
    __table_args__ = (UniqueConstraint("user_id", "topic_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    topic_id: Mapped[str] = mapped_column(String(64), index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[float] = mapped_column(Float, default=0)
    ewma: Mapped[float] = mapped_column(Float, default=0.5)
    recent: Mapped[list] = mapped_column(JSON, default=list)  # last results [{s, d, t}]
    mistake_categories: Mapped[dict] = mapped_column(JSON, default=dict)
    last_practiced: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    ease: Mapped[float] = mapped_column(Float, default=2.3)
    next_review: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)


class MistakeRecord(Base):
    __tablename__ = "mistake_records"
    __table_args__ = (UniqueConstraint("user_id", "key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    key: Mapped[str] = mapped_column(String(160))
    source_type: Mapped[str] = mapped_column(String(16))  # curriculum | ai_exercise | writing | speaking
    source_ref: Mapped[str] = mapped_column(String(96))
    question_text: Mapped[str] = mapped_column(Text, default="")
    student_answer: Mapped[str] = mapped_column(Text, default="")
    corrected_answer: Mapped[str] = mapped_column(Text, default="")
    error_type: Mapped[str] = mapped_column(String(40), default="grammar", index=True)
    explanation: Mapped[str] = mapped_column(Text, default="")
    topic_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    frequency: Mapped[int] = mapped_column(Integer, default=1)
    correct_streak: Mapped[int] = mapped_column(Integer, default=0)
    review_status: Mapped[str] = mapped_column(String(16), default="new")  # new | reviewing | mastered
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class WritingSubmission(Base):
    __tablename__ = "writing_submissions"
    __table_args__ = (UniqueConstraint("user_id", "client_submission_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    client_submission_id: Mapped[str] = mapped_column(String(64))
    prompt: Mapped[dict] = mapped_column(JSON)
    mode: Mapped[str] = mapped_column(String(16))  # minimal | natural | b2
    task_type: Mapped[str] = mapped_column(String(32), default="paragraph")
    level: Mapped[str] = mapped_column(String(4), default="B1")
    text: Mapped[str] = mapped_column(Text)
    word_count: Mapped[int] = mapped_column(Integer)
    feedback: Mapped[dict] = mapped_column(JSON)
    parent_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class SpeakingSession(Base):
    __tablename__ = "speaking_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    mode: Mapped[str] = mapped_column(String(24))
    topic: Mapped[str] = mapped_column(String(200))
    level: Mapped[str] = mapped_column(String(4))
    status: Mapped[str] = mapped_column(String(12), default="active")
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class SpeakingTurn(Base):
    __tablename__ = "speaking_turns"
    __table_args__ = (UniqueConstraint("session_id", "client_turn_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("speaking_sessions.id", ondelete="CASCADE"), index=True)
    client_turn_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    role: Mapped[str] = mapped_column(String(8))  # ai | user
    text: Mapped[str] = mapped_column(Text)
    audio_file: Mapped[str | None] = mapped_column(String(120), nullable=True)
    audio_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class LessonTestOut(Base):
    """'Kiểm tra vượt bài': questions picked by the server; passed from the learner's first answers after started_at."""
    __tablename__ = "lesson_test_outs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    unit_id: Mapped[str] = mapped_column(String(64))
    items: Mapped[list] = mapped_column(JSON)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    correct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class PronunciationAttempt(Base):
    """One recording checked word by word against a reference sentence or word (see app/ai/pronunciation.py)."""
    __tablename__ = "pronunciation_attempts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    source: Mapped[str] = mapped_column(String(24))  # read_aloud | conversation | practice | word
    source_ref: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reference: Mapped[str] = mapped_column(Text)
    heard: Mapped[str] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer)  # % of reference words heard clearly
    words: Mapped[list] = mapped_column(JSON)
    audio_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class TutorConversation(Base):
    __tablename__ = "tutor_conversations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class TutorMessage(Base):
    __tablename__ = "tutor_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("tutor_conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10))  # user | assistant
    action: Mapped[str] = mapped_column(String(24), default="chat")
    content: Mapped[str] = mapped_column(Text)
    step_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PlacementSession(Base):
    __tablename__ = "placement_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    state: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ====================================================================== vocabulary
# Lexicon tables are imported idempotently from app/vocabulary/data/lexicon.jsonl.gz (origin="dataset").
# Rows with origin "ai" (enrichment, status needs_review until approved) or "user" (personal notebook entries)
# are never touched by a dataset re-import. Learner progress lives in vocab_progress / vocab_review_log.

class VocabDataset(Base):
    __tablename__ = "vocab_dataset"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[str] = mapped_column(String(32))
    counts: Mapped[dict] = mapped_column(JSON, default=dict)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class VocabEntry(Base):
    __tablename__ = "vocab_entries"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    lemma: Mapped[str] = mapped_column(String(200), index=True)
    headword: Mapped[str] = mapped_column(String(200))
    search_key: Mapped[str] = mapped_column(String(400), index=True)
    kind: Mapped[str] = mapped_column(String(16), index=True)  # word | phrasal_verb | phrase | collocation | pattern
    cefr: Mapped[str | None] = mapped_column(String(2), index=True, nullable=True)
    cefr_source: Mapped[str | None] = mapped_column(String(80), nullable=True)
    pos: Mapped[list] = mapped_column(JSON, default=list)
    variants: Mapped[list] = mapped_column(JSON, default=list)
    forms: Mapped[list] = mapped_column(JSON, default=list)
    ipa_uk: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ipa_us: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ipa_source: Mapped[str | None] = mapped_column(String(80), nullable=True)
    ipa_status: Mapped[str] = mapped_column(String(32), default="missing")
    ipa_curriculum: Mapped[str | None] = mapped_column(String(120), nullable=True)
    freq_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tier: Mapped[int | None] = mapped_column(Integer, nullable=True)
    academic: Mapped[bool] = mapped_column(Boolean, default=False)
    topics: Mapped[list] = mapped_column(JSON, default=list)
    topic_sources: Mapped[list] = mapped_column(JSON, default=list)
    family: Mapped[list] = mapped_column(JSON, default=list)
    synonyms: Mapped[list] = mapped_column(JSON, default=list)
    antonyms: Mapped[list] = mapped_column(JSON, default=list)
    confused_with: Mapped[list] = mapped_column(JSON, default=list)
    mistakes: Mapped[list] = mapped_column(JSON, default=list)
    focus: Mapped[list] = mapped_column(JSON, default=list)
    legacy_ids: Mapped[list] = mapped_column(JSON, default=list)
    units: Mapped[list] = mapped_column(JSON, default=list)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), index=True)  # curriculum | sourced | needs_review | user
    review_flags: Mapped[list] = mapped_column(JSON, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    origin: Mapped[str] = mapped_column(String(16), default="dataset")  # dataset | user
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class VocabSense(Base):
    __tablename__ = "vocab_senses"
    id: Mapped[str] = mapped_column(String(140), primary_key=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("vocab_entries.id", ondelete="CASCADE"), index=True)
    idx: Mapped[int] = mapped_column(Integer, default=0)
    pos: Mapped[str | None] = mapped_column(String(16), nullable=True)
    meaning_vi: Mapped[str] = mapped_column(Text)
    definition_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    cefr: Mapped[str | None] = mapped_column(String(2), nullable=True)
    usage: Mapped[list] = mapped_column(JSON, default=list)
    pattern: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16))
    origin: Mapped[str] = mapped_column(String(16), default="dataset")


class VocabExample(Base):
    __tablename__ = "vocab_examples"
    id: Mapped[str] = mapped_column(String(140), primary_key=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("vocab_entries.id", ondelete="CASCADE"), index=True)
    sense_id: Mapped[str | None] = mapped_column(String(140), nullable=True)
    en: Mapped[str] = mapped_column(Text)
    vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(80))
    ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="sourced")
    origin: Mapped[str] = mapped_column(String(16), default="dataset")
    idx: Mapped[int] = mapped_column(Integer, default=0)


class VocabCollocation(Base):
    __tablename__ = "vocab_collocations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("vocab_entries.id", ondelete="CASCADE"), index=True)
    phrase: Mapped[str] = mapped_column(String(240))
    meaning_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    focus: Mapped[str | None] = mapped_column(String(80), nullable=True)
    linked_entry_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16), default="curriculum")
    origin: Mapped[str] = mapped_column(String(16), default="dataset")


class VocabTopic(Base):
    __tablename__ = "vocab_topics"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    name_vi: Mapped[str] = mapped_column(String(120))
    band: Mapped[str] = mapped_column(String(2))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class VocabEntryTopic(Base):
    __tablename__ = "vocab_entry_topics"
    entry_id: Mapped[str] = mapped_column(ForeignKey("vocab_entries.id", ondelete="CASCADE"), primary_key=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("vocab_topics.id"), primary_key=True, index=True)


class VocabLegacyCard(Base):
    """Curriculum flashcard ids (e.g. VOC-01:wake-up) → lexicon entry, so lesson slides and old progress keep working."""
    __tablename__ = "vocab_legacy_cards"
    card_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    entry_id: Mapped[str] = mapped_column(String(120), index=True)


class VocabProgress(Base):
    """VocabularyMastery: one row per (user, entry). FSRS state from the py-fsrs library (stored as Card.to_dict())."""
    __tablename__ = "vocab_progress"
    __table_args__ = (UniqueConstraint("user_id", "entry_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("vocab_entries.id"), index=True)
    state: Mapped[str] = mapped_column(String(12), default="new", index=True)  # new | learning | review | relearning
    fsrs: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    due: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    stability: Mapped[float | None] = mapped_column(Float, nullable=True)
    difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    reps: Mapped[int] = mapped_column(Integer, default=0)
    lapses: Mapped[int] = mapped_column(Integer, default=0)
    last_review: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # distinct learning milestones (never conflated)
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    learned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    first_correct_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recalled_after_delay_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_correctly_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    incorrect_count: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    used_in: Mapped[dict] = mapped_column(JSON, default=dict)  # {"writing": n, "speaking": n, "practice": n}
    saved: Mapped[bool] = mapped_column(Boolean, default=False)
    known: Mapped[bool] = mapped_column(Boolean, default=False)
    difficult: Mapped[bool] = mapped_column(Boolean, default=False)
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    own_example: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_from: Mapped[str | None] = mapped_column(String(24), nullable=True)
    legacy_migrated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class VocabReviewLog(Base):
    """VocabularyReview: every graded interaction (scheduling and non-scheduling)."""
    __tablename__ = "vocab_review_log"
    __table_args__ = (UniqueConstraint("user_id", "client_review_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    entry_id: Mapped[str] = mapped_column(String(120), index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    client_review_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mode: Mapped[str] = mapped_column(String(20))
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1 Again 2 Hard 3 Good 4 Easy (when scheduled)
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    verdict: Mapped[str | None] = mapped_column(String(24), nullable=True)
    response: Mapped[dict] = mapped_column(JSON, default=dict)
    state_before: Mapped[str | None] = mapped_column(String(12), nullable=True)
    state_after: Mapped[str | None] = mapped_column(String(12), nullable=True)
    elapsed_days: Mapped[float | None] = mapped_column(Float, nullable=True)
    due_after: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class VocabMistake(Base):
    """VocabularyMistake: a wrong answer kept for error-based review (resolved after later correct recalls)."""
    __tablename__ = "vocab_mistakes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    entry_id: Mapped[str] = mapped_column(String(120), index=True)
    mode: Mapped[str] = mapped_column(String(20))
    error_type: Mapped[str] = mapped_column(String(24))
    prompt: Mapped[str] = mapped_column(Text, default="")
    answer: Mapped[str] = mapped_column(Text, default="")
    expected: Mapped[str] = mapped_column(Text, default="")
    explanation_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    confused_with: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class VocabSession(Base):
    """VocabularyLearningSession. `items` holds answer keys and stays on the server; the API returns public items only."""
    __tablename__ = "vocab_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    items: Mapped[list] = mapped_column(JSON, default=list)
    results: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(12), default="active", index=True)
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class VocabCollection(Base):
    __tablename__ = "vocab_collections"
    __table_args__ = (UniqueConstraint("user_id", "system_key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class VocabCollectionItem(Base):
    __tablename__ = "vocab_collection_items"
    __table_args__ = (UniqueConstraint("collection_id", "entry_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey("vocab_collections.id", ondelete="CASCADE"), index=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("vocab_entries.id"), index=True)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_module: Mapped[str | None] = mapped_column(String(24), nullable=True)
    source_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class VocabEnrichmentJob(Base):
    """AI enrichment checkpoints: one row per (entry key, task). Re-runs skip done rows; failures keep the error."""
    __tablename__ = "vocab_enrichment_jobs"
    __table_args__ = (UniqueConstraint("entry_key", "task"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_key: Mapped[str] = mapped_column(String(200), index=True)
    task: Mapped[str] = mapped_column(String(24))
    batch_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)  # queued|done|failed|rejected|approved
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    validation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class VocabDialogue(Base):
    __tablename__ = "vocab_dialogues"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    situation: Mapped[str] = mapped_column(String(40))
    entry_ids: Mapped[list] = mapped_column(JSON, default=list)
    turns: Mapped[list] = mapped_column(JSON, default=list)
    used: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(12), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class StudyLog(Base):
    """Study journal: one row per (learner, local day, lesson or module). Feeds the journal page and the assistant.

    activity_key is a curriculum unit id (e.g. A1-G003) or a module key (vocab, writing-studio, …).
    Rows with source="backfill" were reconstructed from older records (time could not be attributed to lessons).
    """
    __tablename__ = "study_log"
    __table_args__ = (UniqueConstraint("user_id", "day", "activity_key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    activity_key: Mapped[str] = mapped_column(String(64), index=True)
    kind: Mapped[str] = mapped_column(String(12), default="lesson")  # lesson | module
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    items_answered: Mapped[int] = mapped_column(Integer, default=0)
    items_correct: Mapped[int] = mapped_column(Integer, default=0)
    cards_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    words_learned: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(12), default="live")  # live | backfill
    first_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FocusSession(Base):
    """Self-imposed study lock: the computer stays locked (by the macOS Focus Lock app) until the goals are met.

    Progress is accumulated by services.progress.log_study while the session is active (study seconds, lessons completed).
    Safety: max_minutes auto-unlocks; emergency unlock after a 60-second wait (PIN if configured).
    """
    __tablename__ = "focus_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)  # active | completed | expired | emergency | cancelled
    goal_lessons: Mapped[int] = mapped_column(Integer, default=0)
    goal_minutes: Mapped[int] = mapped_column(Integer, default=0)
    max_minutes: Mapped[int] = mapped_column(Integer, default=180)
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    lessons_done: Mapped[list] = mapped_column(JSON, default=list)
    emergency_requested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
