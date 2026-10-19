"""Request bodies (validated by Pydantic). Responses are plain JSON built in the routers."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_TEXT = 10_000


class ProgressIn(BaseModel):
    current_step: int = Field(ge=0, le=2000)
    state: dict[str, Any] | None = None

    @field_validator("state")
    @classmethod
    def small_state(cls, v):
        if v is not None and len(str(v)) > 200_000:
            raise ValueError("state too large")
        return v


class QuizSubmitIn(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict, max_length=200)
    # items the learner could not answer and asked to see the answer for (graded as not correct)
    reveal: list[str] = Field(default_factory=list, max_length=200)
    client_submission_id: str | None = Field(default=None, min_length=8, max_length=64)

    @model_validator(mode="after")
    def something_to_grade(self):
        if not self.answers and not self.reveal:
            raise ValueError("no answers")
        if any(len(k) > 120 for k in self.reveal):
            raise ValueError("bad item id")
        return self

    @field_validator("answers")
    @classmethod
    def check_values(cls, v):
        for key, val in v.items():
            if len(key) > 120:
                raise ValueError("bad item id")
            if isinstance(val, list):
                if len(val) > 50 or any(len(str(x)) > 500 for x in val):
                    raise ValueError("answer too long")
            elif val is not None and len(str(val)) > MAX_TEXT:
                raise ValueError("answer too long")
        return v


class SelfAssessIn(BaseModel):
    correct: bool


class VocabReviewIn(BaseModel):
    card_id: str = Field(min_length=3, max_length=128)
    grade: int = Field(ge=0, le=5)


class HeartbeatIn(BaseModel):
    unit_id: str | None = Field(default=None, max_length=64)
    activity: str | None = Field(default=None, pattern="^(vocab|writing-studio|speaking-studio|reading-studio|listening-studio|ai-practice|placement|mistakes|review|reference)$")


class WritingIn(BaseModel):
    unit_id: str = Field(max_length=64)
    item_id: str = Field(max_length=96)
    text: str = Field(min_length=1, max_length=MAX_TEXT)
    seconds: int | None = Field(default=None, ge=0, le=36_000)
    rubric: dict[str, bool] | None = None


class NoteIn(BaseModel):
    text: str = Field(max_length=MAX_TEXT)


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    daily_goal_minutes: int | None = Field(default=None, ge=5, le=240)
    weekly_goal_lessons: int | None = Field(default=None, ge=1, le=50)


class TutorIn(BaseModel):
    unit_id: str = Field(max_length=64)
    step_index: int | None = Field(default=None, ge=0, le=2000)
    action: str = Field(pattern="^(explain|example|simpler|why_wrong|practice|quiz_me|free)$")
    message: str = Field(default="", max_length=2000)
    item_id: str | None = Field(default=None, max_length=96)
