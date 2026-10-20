"""REST endpoints for AI features and adaptive learning. All AI calls go through app.state.ai (gateway)."""
from __future__ import annotations

import json
from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai import media
from ..ai.errors import AIBadInput
from ..ai.exercises import ALL_TYPES, GenParams, history
from ..ai.services import AIServices
from ..ai.speaking import MODES as SPEAKING_MODES
from ..ai.speaking import ROLEPLAYS
from ..ai.writing import MODES as WRITING_MODES
from ..ai.writing import TASK_TYPES
from ..content.md import strip_md
from ..content.store import ContentStore
from ..models import (
    AIUsageLog, Attempt, ExerciseSet, FeedbackMessage, GradingFeedback, LearningProfile, PlacementSession, QuestionResponse,
    SpeakingSession, SpeakingTurn, User, WritingSubmission, utcnow,
)
from ..services import adaptive
from .deps import current_user, get_db, get_store

router = APIRouter(prefix="/api", tags=["ai"])


def get_ai(request: Request) -> AIServices:
    return request.app.state.ai


def owned_set(db: Session, user: User, set_id: str) -> ExerciseSet:
    es = db.get(ExerciseSet, set_id)
    if es is None or es.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy bộ bài tập")
    return es


# ============================================================================ status, usage, settings

@router.get("/ai/status")
def ai_status(db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    s = ai.settings
    lim = ai.gateway.limits(db, user.id)
    return {"configured": s.enabled, "enabled": s.enabled and lim["ai_enabled"], "provider": s.provider if s.enabled else None,
            "simulated": s.provider == "fake", "models": s.models if s.enabled else None, "limits": lim,
            "features": {"realtime": s.enabled, "embeddings": s.use_embeddings, "verify_exercises": s.verify_exercises}}


@router.get("/ai/usage")
def ai_usage(days: int = Query(30, ge=1, le=366), db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    since = utcnow() - timedelta(days=days)
    rows = list(db.scalars(select(AIUsageLog).where(AIUsageLog.user_id == user.id, AIUsageLog.created_at >= since)))
    by_feature: dict[str, dict] = {}
    by_day: dict[str, dict] = {}
    for r in rows:
        f = by_feature.setdefault(r.feature, {"feature": r.feature, "requests": 0, "cached": 0, "errors": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})
        f["requests"] += r.status != "cached"
        f["cached"] += r.status == "cached"
        f["errors"] += r.status == "error"
        f["input_tokens"] += r.input_tokens
        f["output_tokens"] += r.output_tokens
        f["cost_usd"] += r.cost_usd
        d = by_day.setdefault(r.created_at.date().isoformat(), {"day": r.created_at.date().isoformat(), "requests": 0, "cost_usd": 0.0})
        d["requests"] += r.status != "cached"
        d["cost_usd"] += r.cost_usd
    for f in by_feature.values():
        f["cost_usd"] = round(f["cost_usd"], 5)
    return {"summary": ai.gateway.usage_summary(db, user.id), "limits": ai.gateway.limits(db, user.id),
            "totals": {"requests": sum(r.status != "cached" for r in rows), "input_tokens": sum(r.input_tokens for r in rows),
                       "output_tokens": sum(r.output_tokens for r in rows), "cost_usd": round(sum(r.cost_usd for r in rows), 5)},
            "by_feature": sorted(by_feature.values(), key=lambda x: -x["cost_usd"]),
            "by_day": [{**d, "cost_usd": round(d["cost_usd"], 5)} for d in sorted(by_day.values(), key=lambda d: d["day"])],
            "pricing_note": "Chi phí là ước tính theo bảng giá cấu hình (OPENAI_PRICING_JSON); hóa đơn thực tế xem trên trang OpenAI."}


@router.get("/ai/limits")
def ai_limits(db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return {"limits": ai.gateway.limits(db, user.id), "usage": ai.gateway.usage_summary(db, user.id)}


@router.get("/ai/models/check")
def ai_models_check(db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    """Which configured models the API key can actually access (one models.list call)."""
    ai.gateway.check(db, user.id)
    available = set(ai.gateway.provider.list_models())
    return {"models": {task: {"model": m, "available": m in available} for task, m in ai.settings.models.items()}}


class LearningSettingsIn(BaseModel):
    target_level: str | None = Field(default=None, pattern="^(A1|A2|B1|B2|C1)$")
    explanation_language: str | None = Field(default=None, pattern="^(vi|vi_en)$")
    ai_enabled: bool | None = None
    daily_request_limit: int | None = Field(default=None, ge=1, le=5000)
    monthly_budget_usd: float | None = Field(default=None, ge=0, le=1000)
    max_audio_seconds: int | None = Field(default=None, ge=10, le=600)
    max_exercise_count: int | None = Field(default=None, ge=5, le=50)


def get_profile(db: Session, user_id: int) -> LearningProfile:
    p = db.get(LearningProfile, user_id)
    if p is None:
        p = LearningProfile(user_id=user_id, preferences={})
        db.add(p)
        db.flush()
    return p


@router.get("/learning/settings")
def learning_settings(db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = get_profile(db, user.id)
    db.commit()
    return {"target_level": p.target_level, "explanation_language": p.explanation_language, "ai_enabled": p.ai_enabled,
            "daily_request_limit": p.daily_request_limit, "monthly_budget_usd": p.monthly_budget_usd, "max_audio_seconds": p.max_audio_seconds,
            "max_exercise_count": p.max_exercise_count, "placement": (p.preferences or {}).get("placement")}


@router.put("/learning/settings")
def update_learning_settings(body: LearningSettingsIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = get_profile(db, user.id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    return learning_settings(db, user)


# ============================================================================ tutor

class TutorChatIn(BaseModel):
    unit_id: str = Field(max_length=64)
    action: str = Field(pattern="^(explain_simply|more_examples|compare|why|common_mistakes|explain_mistake|chat)$")
    message: str = Field(default="", max_length=2000)
    step_index: int | None = Field(default=None, ge=0, le=2000)
    item_id: str | None = Field(default=None, max_length=96)


@router.post("/ai/tutor/chat")
def tutor_chat(body: TutorChatIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.tutor.ask(db, user.id, unit_id=body.unit_id, action=body.action, message=body.message, step_index=body.step_index, item_id=body.item_id)


@router.post("/ai/tutor/explain")
def tutor_explain(body: TutorChatIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.tutor.ask(db, user.id, unit_id=body.unit_id, action="explain_simply", message=body.message, step_index=body.step_index, item_id=None)


@router.post("/ai/tutor/examples")
def tutor_examples(body: TutorChatIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.tutor.ask(db, user.id, unit_id=body.unit_id, action="more_examples", message=body.message, step_index=body.step_index, item_id=None)


@router.get("/ai/tutor/history")
def tutor_history(unit_id: str = Query(max_length=64), db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return {"messages": ai.tutor.history(db, user.id, unit_id)}


# ============================================================================ exercises

class GenerateIn(BaseModel):
    lesson_id: str | None = Field(default=None, max_length=64)
    scope: str = Field(default="lesson", pattern="^(lesson|previous|weak|mistakes)$")
    count: int = Field(default=10, ge=1, le=50)
    difficulty: str = Field(default="normal", pattern="^(easy|normal|hard|adaptive)$")
    question_types: list[str] = Field(default_factory=lambda: ["mixed"], max_length=14)
    focus: list[str] = Field(default_factory=list, max_length=8)


@router.post("/ai/exercises/generate")
def generate_exercises(body: GenerateIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    bad = [t for t in body.question_types if t != "mixed" and t not in ALL_TYPES]
    if bad:
        raise HTTPException(422, f"Unknown question types: {bad}")
    es = ai.exercises.generate(db, user.id, GenParams(lesson_id=body.lesson_id, scope=body.scope, count=body.count,
                                                      difficulty=body.difficulty, question_types=body.question_types,
                                                      focus=[f[:60] for f in body.focus]))
    return ai.exercises.public_set(db, es)


@router.post("/ai/exercises/{set_id}/similar")
def similar_exercises(set_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    es = owned_set(db, user, set_id)
    gen = (es.meta or {}).get("generation", {})
    n = len(ai.exercises.questions(db, es.id))
    new = ai.exercises.generate(db, user.id, GenParams(lesson_id=es.lesson_id, scope="lesson" if gen.get("scope") != "mistakes" else "mistakes",
                                                       count=n, difficulty=es.difficulty, question_types=gen.get("question_types"),
                                                       focus=gen.get("focus"), parent_set_id=es.id))
    return ai.exercises.public_set(db, new)


@router.get("/exercises")
def list_exercises(kind: str | None = Query(None, pattern="^(practice|listening|reading)$"), db: Session = Depends(get_db),
                   store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    return {"sets": history(db, user.id, store, kind)}


@router.get("/exercises/{set_id}")
def get_exercise(set_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    es = owned_set(db, user, set_id)
    data = ai.exercises.public_set(db, es, hide_meta=("segments", "vocabulary", "voices", "audio", "transcript"))
    data["review"] = ai.exercises.review(db, user.id, es)
    if es.kind == "reading" and data["review"]:
        data["meta"]["vocabulary"] = es.meta.get("vocabulary", [])
    return data


class SubmitIn(BaseModel):
    answers: dict[str, str | int | list | dict | None] = Field(max_length=60)
    times_ms: dict[str, int] = Field(default_factory=dict, max_length=60)
    client_submission_id: str = Field(min_length=8, max_length=64)

    @field_validator("answers")
    @classmethod
    def bounded_answers(cls, answers):
        if any(len(key) > 64 or len(json.dumps(value, ensure_ascii=False)) > 10_000 for key, value in answers.items()):
            raise ValueError("answer too long")
        return answers


@router.post("/exercises/{set_id}/submit")
def submit_exercises(set_id: str, body: SubmitIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    es = owned_set(db, user, set_id)
    for v in body.answers.values():
        if isinstance(v, str) and len(v) > 3000:
            raise HTTPException(422, "Answer too long")
    return ai.exercises.submit(db, user.id, es, body.answers, body.times_ms, body.client_submission_id)


@router.get("/exercises/{set_id}/review")
def review_exercises(set_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    es = owned_set(db, user, set_id)
    r = ai.exercises.review(db, user.id, es)
    if r is None:
        raise HTTPException(409, "Chưa nộp bài — đáp án chỉ hiện sau khi nộp.")
    return r


@router.post("/exercises/{set_id}/questions/{question_id}/regrade")
def regrade(set_id: str, question_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.exercises.regrade(db, user.id, owned_set(db, user, set_id), question_id)


class FollowUpIn(BaseModel):
    target_type: str = Field(pattern="^(question|attempt)$")
    target_id: str = Field(max_length=96)
    action: str = Field(pattern="^(why_wrong|explain_again|another_example)$")


@router.post("/ai/feedback")
def follow_up(body: FollowUpIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), store: ContentStore = Depends(get_store),
              user: User = Depends(current_user)):
    if body.target_type == "question":
        resp = db.scalars(select(QuestionResponse).where(QuestionResponse.question_id == body.target_id, QuestionResponse.user_id == user.id)
                          .order_by(QuestionResponse.id.desc()).limit(1)).first()
        if resp is None:
            raise HTTPException(409, "Hãy nộp câu trả lời trước.")
        from ..models import ExerciseQuestion

        q = db.get(ExerciseQuestion, body.target_id)
        ctx = (f"Question ({q.qtype}, level {q.level}): {q.question_text}\nOptions: {q.options}\nKey: {q.answer_key.get('answers') or q.answer_key.get('correct_index')}\n"
               f"Rule: {q.grammar_rule}\nExplanation: {q.explanation_vi}\nLearner answer: <learner_answer>{resp.answer[:800]}</learner_answer>\n"
               f"Grading: {resp.correctness}")
    else:
        a = db.get(Attempt, int(body.target_id)) if body.target_id.isdigit() else None
        if a is None or a.user_id != user.id:
            raise HTTPException(404, "Không tìm thấy câu trả lời")
        it = store.item(a.item_id)
        ctx = (f"Curriculum exercise {a.item_id}: answer key {strip_md(it.model_md)[:500] if it else ''}; explanation {strip_md(it.explanation_md)[:300] if it else ''}\n"
               f"Learner answer: <learner_answer>{a.response[:800]}</learner_answer> (verdict {a.verdict})")
    return ai.tutor.follow_up(db, user.id, target_type=body.target_type, target_id=body.target_id, action=body.action, context=ctx)


@router.get("/ai/feedback")
def follow_up_history(target_type: str, target_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(FeedbackMessage).where(FeedbackMessage.user_id == user.id, FeedbackMessage.target_type == target_type,
                                                    FeedbackMessage.target_id == target_id).order_by(FeedbackMessage.id))
    return {"messages": [{"id": m.id, "action": m.action, "content": m.content, "created_at": m.created_at.isoformat()} for m in rows]}


@router.post("/ai/grade-attempt/{attempt_id}")
def grade_attempt(attempt_id: int, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), store: ContentStore = Depends(get_store),
                  user: User = Depends(current_user)):
    """AI grading of an open answer in a curriculum lesson (translation, writing, transformation…)."""
    a = db.get(Attempt, attempt_id)
    if a is None or a.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy câu trả lời")
    existing = db.scalar(select(GradingFeedback).where(GradingFeedback.attempt_id == a.id))
    if existing:
        return existing.result
    if a.verdict not in ("mismatch", "submitted"):
        raise HTTPException(409, "Câu này đã được chấm tự động.")
    it = store.item(a.item_id)
    if it is None:
        raise HTTPException(404, "Bài tập không còn trong giáo trình")
    unit = store.units[a.unit_id]
    b = store.built(a.unit_id)
    prompt = next((x["prompt_md"] for st in b.steps for x in st.get("items") or [] if x["id"] == a.item_id), "")
    # what the learner was asked to do: the item's group instruction (e.g. "Write Wh- questions"), else the step intro
    task = next(((x.get("group_md") or st.get("intro_md") or "") for st in b.steps for x in st.get("items") or [] if x["id"] == a.item_id), "")
    from ..ai import prompts
    from ..ai.schemas import GradingBatch

    batch = ai.gateway.structured(db, user.id, feature="curriculum_grade", task="complex_grading" if len(a.response.split()) > 25 else "grading",
                                  instructions=prompts.GRADER,
                                  input=json.dumps({"question_number": 1, "lesson": unit.id, "level": unit.level, "instructions": strip_md(task)[:600], "question": strip_md(prompt)[:1500],
                                                    "reference_answers": [strip_md(it.model_md)[:1500]], "criteria": strip_md(it.explanation_md)[:500]},
                                                   ensure_ascii=False) + f"\n<learner_answer n=\"1\">{a.response[:3000]}</learner_answer>",
                                  schema=GradingBatch, max_output_tokens=1500)
    if len(batch.results) != 1 or batch.results[0].question_number != 1 or batch.results[0].correctness == "needs_review":
        from ..ai.errors import AIInvalidOutput

        raise AIInvalidOutput("curriculum grading did not return one valid verdict")
    r = ai.exercises._grade_dict(batch.results[0])
    db.add(GradingFeedback(user_id=user.id, attempt_id=a.id, result=r))
    if r["correctness"] != "needs_review":
        a.ai_correct = r["score"] >= 0.75
        a.ai_score = r["score"]
        adaptive.record_result(db, user.id, a.unit_id, r["score"], "normal", (r.get("errors") or [{}])[0].get("category") if r.get("errors") else None)
        if r["score"] < 0.75:
            adaptive.record_mistake(db, user.id, key=f"cur:{a.item_id}", source_type="curriculum", source_ref=a.item_id,
                                    question_text=strip_md(prompt)[:1000], student_answer=a.response, corrected_answer=r.get("corrected_answer") or strip_md(it.model_md)[:500],
                                    error_type=(r.get("errors") or [{"category": "other"}])[0]["category"], explanation=r.get("feedback_vi", ""), topic_id=a.unit_id)
        else:
            adaptive.record_mistake_success(db, user.id, f"cur:{a.item_id}")
    db.commit()
    return r


@router.get("/ai/grade-attempt/{attempt_id}")
def get_attempt_grade(attempt_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    g = db.scalar(select(GradingFeedback).where(GradingFeedback.attempt_id == attempt_id, GradingFeedback.user_id == user.id))
    return {"result": g.result if g else None}


# ============================================================================ writing

@router.get("/writing-studio/options")
def writing_options(ai: AIServices = Depends(get_ai)):
    return {"task_types": TASK_TYPES, "modes": WRITING_MODES, "curriculum_prompts": ai.writing.curriculum_prompts()}


class WritingPromptIn(BaseModel):
    level: str = Field(pattern="^(A1|A2|B1|B2)$")
    task_type: str = Field(max_length=32)
    topic: str = Field(default="", max_length=200)


@router.post("/ai/writing/generate-prompt")
def writing_prompt(body: WritingPromptIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.writing.generate_prompt(db, user.id, level=body.level, task_type=body.task_type, topic=body.topic)


class WritingEvalIn(BaseModel):
    text: str = Field(min_length=5, max_length=8000)
    prompt: dict
    mode: str = Field(pattern="^(minimal|natural|b2)$")
    task_type: str = Field(max_length=32)
    level: str = Field(pattern="^(A1|A2|B1|B2)$")
    client_submission_id: str = Field(min_length=8, max_length=64)
    parent_id: int | None = None


@router.post("/ai/writing/evaluate")
def writing_evaluate(body: WritingEvalIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    if len(str(body.prompt)) > 5000:
        raise HTTPException(422, "Prompt too large")
    sub = ai.writing.evaluate(db, user.id, text=body.text, prompt=body.prompt, mode=body.mode, task_type=body.task_type, level=body.level,
                              client_submission_id=body.client_submission_id, parent_id=body.parent_id)
    return ai.writing.public(sub)


@router.get("/writing/history")
def writing_history_ai(db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    subs = db.scalars(select(WritingSubmission).where(WritingSubmission.user_id == user.id).order_by(WritingSubmission.created_at.desc()).limit(100))
    return {"submissions": [ai.writing.public(s) for s in subs], "stats": ai.writing.stats(db, user.id)}


@router.delete("/writing/history/{sub_id}")
def writing_delete(sub_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = db.get(WritingSubmission, sub_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(s)
    db.commit()
    return {"deleted": sub_id}


# ============================================================================ speaking

@router.get("/speaking-studio/options")
def speaking_options(ai: AIServices = Depends(get_ai)):
    return {"modes": SPEAKING_MODES, "roleplays": ROLEPLAYS, "max_audio_seconds": ai.settings.max_audio_seconds,
            "realtime_max_seconds": ai.settings.realtime_max_seconds, "store_user_audio": ai.settings.store_user_audio}


class SpeakingStartIn(BaseModel):
    mode: str = Field(max_length=24)
    topic: str = Field(default="", max_length=200)
    level: str = Field(pattern="^(A0|A1|A2|B1|B2)$")


@router.post("/ai/speaking/session")
def speaking_start(body: SpeakingStartIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    s = ai.speaking.start(db, user.id, mode=body.mode, topic=body.topic, level=body.level)
    return ai.speaking.public(db, s)


@router.post("/ai/speaking/session/{session_id}/answer")
async def speaking_answer(session_id: str, audio: UploadFile = File(...), seconds: float | None = Form(None, gt=0, le=600),
                          client_turn_id: str = Form(..., min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"), db: Session = Depends(get_db),
                          ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    data = await audio.read(ai.settings.max_audio_bytes + 1)
    if len(data) > ai.settings.max_audio_bytes:
        raise HTTPException(413, "File ghi âm quá lớn")
    s = await run_in_threadpool(ai.speaking.answer, db, user.id, session_id, audio=data, content_type=audio.content_type or "", seconds=seconds, client_turn_id=client_turn_id)
    return ai.speaking.public(db, s)


@router.post("/ai/speaking/transcribe")
async def speaking_transcribe(audio: UploadFile = File(...), seconds: float | None = Form(None, gt=0, le=600), db: Session = Depends(get_db),
                              ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    data = await audio.read(ai.settings.max_audio_bytes + 1)
    if not data or len(data) > ai.settings.max_audio_bytes:
        raise HTTPException(413, "File ghi âm rỗng hoặc quá lớn")
    from ..ai.speaking import ALLOWED_AUDIO, EXT, fluency_indicators

    ctype = (audio.content_type or "").split(";")[0]
    if ctype not in ALLOWED_AUDIO:
        raise HTTPException(415, "Định dạng âm thanh không được hỗ trợ")
    text = await run_in_threadpool(ai.gateway.transcribe, db, user.id, feature="speaking_transcribe", audio=data, filename=f"a.{EXT[ctype]}", duration_hint=seconds)
    return {"transcript": text, "indicators": fluency_indicators(text, seconds)}


# ------------------------------------------------------------------ help for a lesson question
@router.post("/quizzes/help/{item_id}")
def quiz_help(item_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), store: ContentStore = Depends(get_store),
              user: User = Depends(current_user)):
    """Words in the question with dictionary meanings + an AI hint that never contains the answer."""
    from .. import quiz_help as H
    from ..ai.errors import AIError

    if store.item(item_id) is None:
        raise HTTPException(404, "Không có câu hỏi này")
    from ..models import LessonTestOut

    open_tests = db.scalars(select(LessonTestOut).where(LessonTestOut.user_id == user.id, LessonTestOut.finished_at.is_(None),
                                                        LessonTestOut.unit_id == item_id.split(":", 1)[0]))
    if any(item_id in t.items for t in open_tests):
        raise HTTPException(409, "Không dùng gợi ý trong lúc kiểm tra vượt bài.")
    words = H.glossary(db, store, item_id)
    db.commit()  # the lexicon import (first use only) must not hold the write lock during the AI call
    hint, ai_ok = None, True
    try:
        hint = H.ai_hint(db, ai.gateway, store, user.id, item_id)
    except AIError:
        ai_ok = False
    db.commit()
    return {"words": words, "hint_vi": hint, "ai": ai_ok}


# ------------------------------------------------------------------ pronunciation & natural voice
@router.post("/pronunciation/assess")
async def pronunciation_assess(audio: UploadFile = File(...), reference: str = Form(..., min_length=1, max_length=400),
                               source: str = Form("practice", max_length=24), source_ref: str | None = Form(None, max_length=80),
                               seconds: float | None = Form(None, gt=0, le=600), level: str = Form("A1", pattern="^(A0|A1|A2|B1|B2)$"),
                               db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    """Read a sentence or a word aloud → which words were not heard as intended, with dictionary IPA and how to fix them."""
    data = await audio.read(ai.settings.max_audio_bytes + 1)
    if not data or len(data) > ai.settings.max_audio_bytes:
        raise HTTPException(413, "File ghi âm rỗng hoặc quá lớn")
    def run():  # DB writes and the commit stay off the event loop
        out = ai.pronunciation.assess(db, user.id, audio=data, content_type=audio.content_type or "", reference=reference,
                                      source=source, source_ref=source_ref, seconds=seconds, level=level)
        db.commit()
        return out
    return await run_in_threadpool(run)


@router.get("/pronunciation/summary")
def pronunciation_summary(db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.pronunciation.summary(db, user.id)


TTS_VOICES = ("marin", "cedar", "coral", "sage", "verse", "ash", "ballad", "alloy", "echo", "fable", "nova", "onyx", "shimmer")


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=800)
    voice: str | None = Field(None, max_length=16)
    accent: str = Field("us", pattern="^(us|uk)$")
    slow: bool = False


@router.post("/tts")
def tts(body: TTSIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    """Natural AI voice for any English text in the app (OpenAI TTS). Each (text, voice, style) is generated once and cached."""
    gw = ai.gateway
    if not gw.settings.enabled:
        raise HTTPException(503, "Giọng đọc AI chưa được bật")
    voice = body.voice if body.voice in TTS_VOICES else gw.settings.tts_voice
    accent = "a British accent" if body.accent == "uk" else "an American accent"
    instructions = (f"Read this English text for a learner: natural, warm, clear, with {accent}. "
                    + ("Speak slowly, pausing slightly between words and articulating every sound, including final consonants."
                       if body.slow else "Use a natural, moderate pace."))
    text = " ".join(body.text.split())
    model = gw.settings.model("tts")
    rel = media.tts_name(model, voice, text, instructions, provider=gw.provider.name)
    if not media.exists(rel):  # only the first play of a text costs a TTS request
        audio = gw.speech(db, user.id, feature="app_tts", text=text, voice=voice, instructions=instructions)
        media.write(rel, audio)
    db.commit()
    return {"url": f"/api/media/{rel}", "voice": voice, "ai_voice": True}


@router.post("/ai/speaking/session/{session_id}/end")
def speaking_end(session_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.speaking.public(db, ai.speaking.end(db, user.id, session_id))


@router.post("/ai/speaking/evaluate")
def speaking_evaluate(session_id: str = Query(max_length=36), db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.speaking.public(db, ai.speaking.end(db, user.id, session_id))


@router.get("/speaking/sessions")
def speaking_list(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(SpeakingSession).where(SpeakingSession.user_id == user.id).order_by(SpeakingSession.created_at.desc()).limit(100))
    out = []
    for s in rows:
        n = db.scalar(select(func.count(SpeakingTurn.id)).where(SpeakingTurn.session_id == s.id, SpeakingTurn.role == "user")) or 0
        out.append({"id": s.id, "mode": SPEAKING_MODES.get(s.mode, s.mode), "topic": s.topic, "level": s.level, "status": s.status,
                    "answers": n, "created_at": s.created_at.isoformat()})
    return {"sessions": out}


@router.get("/speaking/sessions/{session_id}")
def speaking_get(session_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    s = db.get(SpeakingSession, session_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy")
    return ai.speaking.public(db, s)


@router.delete("/speaking/sessions/{session_id}")
def speaking_delete(session_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    ai.speaking.delete(db, user.id, session_id)
    return {"deleted": session_id}


class RealtimeIn(BaseModel):
    mode: str = Field(default="free", max_length=24)
    topic: str = Field(default="", max_length=200)
    level: str = Field(pattern="^(A0|A1|A2|B1|B2)$")


@router.post("/ai/speaking/realtime-session")
def realtime_session(body: RealtimeIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    """Short-lived client secret for WebRTC; the standard API key never leaves the server."""
    secret = ai.speaking.realtime(db, user.id, mode=body.mode, topic=body.topic, level=body.level)
    return {"client_secret": secret["value"], "expires_at": secret["expires_at"], "model": secret["model"],
            "max_seconds": secret["max_seconds"], "calls_url": "https://api.openai.com/v1/realtime/calls"}


class RealtimeEndIn(BaseModel):
    seconds: float = Field(ge=0, le=3600)


@router.post("/ai/speaking/realtime-session/end")
def realtime_end(body: RealtimeEndIn, ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    ai.gateway.log_realtime_minutes(user.id, min(body.seconds, ai.settings.realtime_max_seconds))
    return {"logged_seconds": min(body.seconds, ai.settings.realtime_max_seconds)}


# ============================================================================ listening & reading

class ListeningIn(BaseModel):
    level: str = Field(pattern="^(A0|A1|A2|B1|B2)$")
    topic: str = Field(default="daily life", max_length=200)
    minutes: float = Field(default=1.5, ge=0.5, le=4)
    difficulty: str = Field(default="normal", pattern="^(easy|normal|hard)$")
    question_count: int = Field(default=5, ge=3, le=10)
    format: str = Field(default="dialogue", pattern="^(dialogue|monologue)$")
    mode: str = Field(default="practice", pattern="^(practice|test)$")


@router.post("/ai/listening/generate")
def listening_generate(body: ListeningIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    es = ai.studio.generate_listening(db, user.id, level=body.level, topic=body.topic, minutes=body.minutes, difficulty=body.difficulty,
                                      question_count=body.question_count, fmt=body.format, mode=body.mode)
    return ai.studio.listening_public(db, user.id, es, reveal=False)


@router.get("/listening/{set_id}")
def listening_get(set_id: str, reveal_transcript: bool = False, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai),
                  user: User = Depends(current_user)):
    es = owned_set(db, user, set_id)
    if es.kind != "listening":
        raise HTTPException(404, "Không phải bài nghe")
    data = ai.studio.listening_public(db, user.id, es, reveal=reveal_transcript)
    data["review"] = ai.exercises.review(db, user.id, es)
    return data


@router.post("/listening/{set_id}/submit")
def listening_submit(set_id: str, body: SubmitIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    es = owned_set(db, user, set_id)
    review = ai.exercises.submit(db, user.id, es, body.answers, body.times_ms, body.client_submission_id)
    return {"review": review, **ai.studio.listening_public(db, user.id, es, reveal=True)}


class ReadingIn(BaseModel):
    level: str = Field(pattern="^(A0|A1|A2|B1|B2)$")
    topic: str = Field(default="", max_length=200)
    words: int = Field(default=250, ge=80, le=700)
    text_type: str = Field(default="article", pattern="^(short_passage|article|dialogue|opinion|long_b2)$")
    question_count: int = Field(default=5, ge=3, le=10)
    question_types: list[str] = Field(default_factory=lambda: ["multiple_choice", "true_false"], max_length=4)


@router.post("/ai/reading/generate")
def reading_generate(body: ReadingIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    es = ai.studio.generate_reading(db, user.id, level=body.level, topic=body.topic or "everyday life", words=body.words,
                                    text_type=body.text_type, question_count=body.question_count, question_types=body.question_types)
    return ai.exercises.public_set(db, es)


@router.get("/reading/analytics")
def reading_analytics(db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    return ai.studio.reading_analytics(db, user.id)


# ============================================================================ placement

class PlacementStartIn(BaseModel):
    include_writing: bool = True


@router.post("/placement/start")
def placement_start(body: PlacementStartIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    s = ai.placement.start(db, user.id, body.include_writing)
    cur = ai.placement.current(s)
    db.commit()
    return {"session_id": s.id, **cur}


def owned_placement(db: Session, user: User, sid: str) -> PlacementSession:
    s = db.get(PlacementSession, sid)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy bài kiểm tra")
    return s


@router.get("/placement/{session_id}")
def placement_get(session_id: str, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    s = owned_placement(db, user, session_id)
    if s.result:
        return {"session_id": s.id, "done": True, "result": s.result, "review": ai.placement.review(s)}
    cur = ai.placement.current(s)
    db.commit()
    return {"session_id": s.id, **cur}


class PlacementAnswerIn(BaseModel):
    item_id: str = Field(max_length=96)
    answer: str = Field(max_length=3000)


@router.post("/placement/{session_id}/answer")
def placement_answer(session_id: str, body: PlacementAnswerIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    s = owned_placement(db, user, session_id)
    out = ai.placement.answer(db, user.id, s, body.item_id, body.answer)
    if out.get("ready_to_finish"):
        out = ai.placement.finish(db, user.id, s)
    return {"session_id": s.id, **out}


@router.get("/placement")
def placement_list(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(PlacementSession).where(PlacementSession.user_id == user.id).order_by(PlacementSession.created_at.desc()).limit(20))
    return {"sessions": [{"id": s.id, "created_at": s.created_at.isoformat(), "finished": s.finished_at is not None,
                          "overall": (s.result or {}).get("overall")} for s in rows]}


# ============================================================================ adaptive learning

@router.get("/learning/recommendations")
def learning_recommendations(db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), store: ContentStore = Depends(get_store),
                             user: User = Depends(current_user)):
    enabled = ai.settings.enabled and ai.gateway.limits(db, user.id)["ai_enabled"]
    return {"plan": adaptive.daily_plan(db, user, store, enabled), "ai_enabled": enabled}


@router.get("/learning/weaknesses")
def learning_weaknesses(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    return {"weak_topics": adaptive.weaknesses(db, user.id, store, limit=20), "topics": adaptive.topic_rows(db, user.id, store)}


@router.get("/learning/mistakes")
def learning_mistakes(db: Session = Depends(get_db), store: ContentStore = Depends(get_store), user: User = Depends(current_user)):
    return adaptive.mistake_summary(db, user.id, store)


class ReviewSessionIn(BaseModel):
    scope: str = Field(default="mistakes", pattern="^(mistakes|weak)$")
    count: int = Field(default=10, ge=3, le=20)


@router.post("/learning/review-session")
def learning_review_session(body: ReviewSessionIn, db: Session = Depends(get_db), ai: AIServices = Depends(get_ai), user: User = Depends(current_user)):
    """Practice my mistakes / weak topics: a NEW AI exercise set targeting recorded errors."""
    es = ai.exercises.generate(db, user.id, GenParams(lesson_id=None, scope=body.scope, count=body.count, difficulty="adaptive", kind="practice"))
    return ai.exercises.public_set(db, es)


# ============================================================================ media & privacy

@router.get("/media/{path:path}")
def media_file(path: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = media.resolve(path)
    if p is None:
        raise HTTPException(404, "Không tìm thấy file")
    if path.startswith("listening/"):
        es = db.get(ExerciseSet, path.split("/", 1)[1].rsplit(".", 1)[0])
        if es is None or es.user_id != user.id:
            raise HTTPException(404, "Không tìm thấy file")
    if path.startswith("speaking/"):
        s = db.get(SpeakingSession, path.split("/")[1])
        if s is None or s.user_id != user.id:
            raise HTTPException(404, "Không tìm thấy file")
    return FileResponse(p, media_type="audio/mpeg" if path.endswith(".mp3") else "audio/webm",
                        headers={"Cache-Control": "private, max-age=86400"})


@router.delete("/privacy/practice-history")
def delete_practice_history(what: str = Query(pattern="^(writing|speaking|all)$"), db: Session = Depends(get_db), ai: AIServices = Depends(get_ai),
                            user: User = Depends(current_user)):
    n = 0
    if what in ("writing", "all"):
        for s in db.scalars(select(WritingSubmission).where(WritingSubmission.user_id == user.id)):
            db.delete(s)
            n += 1
    db.commit()
    if what in ("speaking", "all"):
        for s in list(db.scalars(select(SpeakingSession).where(SpeakingSession.user_id == user.id))):
            ai.speaking.delete(db, user.id, s.id)
            n += 1
    return {"deleted": n}


