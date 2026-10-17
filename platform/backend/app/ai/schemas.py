"""Structured-output schemas (OpenAI Structured Outputs via Responses API `text_format`).

Kept compatible with strict JSON schema: no free-form dicts, no defaults; optional values are nullable.
JSON validity is not trusted as correctness — every result is checked again in code (validators.py).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["A0", "A1", "A2", "B1", "B2", "C1"]
Difficulty = Literal["easy", "normal", "hard"]
ErrorCategory = Literal[
    "tense", "subject_verb_agreement", "article", "preposition", "word_form", "word_order", "vocabulary",
    "collocation", "sentence_structure", "cohesion", "spelling", "punctuation", "meaning", "other",
]
QuestionType = Literal[
    "multiple_choice", "true_false", "fill_blank", "verb_conjugation", "error_correction", "sentence_transformation",
    "sentence_ordering", "matching", "translation_vi_en", "translation_en_vi", "short_answer", "sentence_writing",
    "reading_comprehension", "listening_comprehension", "contextual_grammar",
]


class MatchPair(BaseModel):
    left: str
    right: str


class GenQuestion(BaseModel):
    question_type: QuestionType
    question_text: str
    instructions_vi: str
    context_passage: str | None
    options: list[str]
    correct_option_index: int | None
    correct_answers: list[str]
    ordering_tokens: list[str]
    matching_pairs: list[MatchPair]
    answer_criteria: str | None
    explanation_vi: str
    wrong_option_explanations_vi: list[str]
    difficulty: Difficulty
    grammar_topic: str
    learning_objective: str
    related_grammar_rule: str
    source_lesson_id: str
    evidence_quote: str | None
    reading_strategy_vi: str | None


class ExerciseGeneration(BaseModel):
    title: str
    learning_objectives: list[str]
    questions: list[GenQuestion]


class SolvedAnswer(BaseModel):
    question_number: int
    answer: str
    is_ambiguous: bool
    has_error: bool
    note: str


class SolveResult(BaseModel):
    answers: list[SolvedAnswer]


class GradingErrorItem(BaseModel):
    category: ErrorCategory
    original: str
    correction: str
    explanation_vi: str


class AIGrade(BaseModel):
    question_number: int
    correctness: Literal["correct", "partially_correct", "incorrect", "needs_review"]
    score: float = Field(ge=0, le=1, allow_inf_nan=False)
    feedback_vi: str
    errors: list[GradingErrorItem]
    corrected_answer: str | None
    acceptable_alternatives: list[str]
    grammar_explanation_vi: str
    improvement_suggestion_vi: str
    follow_up_suggestion_vi: str
    confidence: Literal["high", "medium", "low"]


class GradingBatch(BaseModel):
    results: list[AIGrade]


class CriterionScore(BaseModel):
    criterion: Literal["task_fulfilment", "organization_coherence", "vocabulary", "grammar", "clarity_naturalness"]
    score: float = Field(ge=0, le=10, allow_inf_nan=False)
    comment_vi: str


class WritingErrorItem(BaseModel):
    original: str
    correction: str
    category: ErrorCategory
    explanation_vi: str
    severity: Literal["minor", "major"]


class UpgradeSuggestion(BaseModel):
    original: str
    suggestion: str
    why_vi: str


class VocabSuggestion(BaseModel):
    word_used: str
    better_choice: str
    example: str
    why_vi: str


class WritingFeedbackOut(BaseModel):
    overall_assessment_vi: str
    estimated_level: Level
    estimated_score_10: float | None = Field(ge=0, le=10, allow_inf_nan=False)
    criteria: list[CriterionScore]
    detected_errors: list[WritingErrorItem]
    minimal_corrections: str
    rewritten_version: str
    rewrite_changes_vi: list[str]
    b2_upgrade_suggestions: list[UpgradeSuggestion]
    vocabulary_suggestions: list[VocabSuggestion]
    organization_feedback_vi: str
    improvement_plan_vi: list[str]
    practice_topics: list[str]


class WritingPromptOut(BaseModel):
    title: str
    prompt_en: str
    instructions_vi: str
    requirements: list[str]
    word_min: int
    word_max: int
    suggested_minutes: int


class SpeakingQuestion(BaseModel):
    question_en: str
    hint_vi: str
    useful_expressions: list[str]


class SpeakingTurnFeedback(BaseModel):
    relevance_vi: str
    grammar_feedback: list[WritingErrorItem]
    vocabulary_feedback_vi: str
    natural_expressions: list[str]
    improved_answer: str
    completeness_vi: str
    next_question_en: str
    next_hint_vi: str
    should_end: bool


class SpeakingSummaryOut(BaseModel):
    overall_vi: str
    key_mistakes: list[WritingErrorItem]
    useful_expressions: list[str]
    improved_sample_answers: list[str]
    follow_up_practice_vi: list[str]
    practice_topics: list[str]


class ListeningSegment(BaseModel):
    speaker: str
    text: str


class VocabItem(BaseModel):
    word: str
    meaning_vi: str
    example: str


class ListeningGeneration(BaseModel):
    title: str
    speakers: list[str]
    segments: list[ListeningSegment]
    questions: list[GenQuestion]
    vocabulary: list[VocabItem]


class ReadingGeneration(BaseModel):
    title: str
    passage: str
    questions: list[GenQuestion]
    vocabulary: list[VocabItem]


class PlacementReportOut(BaseModel):
    estimated_level: Level
    strengths_vi: list[str]
    weaknesses_vi: list[str]
    recommended_lesson_ids: list[str]
    study_priorities_vi: list[str]
    plan_vi: list[str]


class WritingLevelEstimate(BaseModel):
    level: Level
    rationale_vi: str
