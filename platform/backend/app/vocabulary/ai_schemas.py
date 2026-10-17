"""Structured-output schemas for vocabulary AI calls (strict-schema friendly: every field required)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["A1", "A2", "B1", "B2", "C1"]
Pos = Literal["noun", "verb", "adj", "adv", "prep", "conj", "pron", "det", "num", "intj", "phrase"]


class VocabAnswerJudge(BaseModel):
    acceptable: bool
    verdict: Literal["correct", "acceptable", "wrong_form", "wrong_meaning", "incorrect"]
    explanation_vi: str


class SentenceIssue(BaseModel):
    original: str
    correction: str
    explanation_vi: str


class VocabSentenceGrade(BaseModel):
    uses_target: bool
    target_used_correctly: bool
    grammar_ok: bool
    natural: bool
    meaning_clear: bool
    verdict: Literal["correct", "minor_issues", "incorrect"]
    issues: list[SentenceIssue]
    corrected_sentence: str
    explanation_vi: str
    better_example: str


class VocabContextMeaning(BaseModel):
    lemma: str
    pos: str
    sense_index: int = Field(ge=-1, le=10)
    meaning_vi_in_context: str
    explanation_vi: str


class DialogueCorrection(BaseModel):
    original: str
    correction: str
    explanation_vi: str


class VocabDialogueTurn(BaseModel):
    reply_en: str
    hint_vi: str
    target_words_used: list[str]
    corrections: list[DialogueCorrection]
    feedback_vi: str
    should_end: bool


class VocabExerciseItem(BaseModel):
    type: Literal["cloze", "collocation", "confusable"]
    target_word: str
    sentence: str
    sentence_vi: str
    options: list[str]
    answer_index: int = Field(ge=0, le=5)
    explanation_vi: str


class VocabExerciseSet(BaseModel):
    items: list[VocabExerciseItem]


class EnrichSense(BaseModel):
    pos: Pos
    meaning_vi: str
    definition_en: str


class EnrichExample(BaseModel):
    en: str
    vi: str


class VocabEnrichment(BaseModel):
    lemma: str
    exists: bool
    senses: list[EnrichSense]
    cefr_estimate: Level
    examples: list[EnrichExample]
    collocations: list[str]
    word_family: list[str]
    usage_vi: str
    common_mistake_vi: str


class VocabEnrichmentBatch(BaseModel):
    entries: list[VocabEnrichment]
