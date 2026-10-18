"""AI exercise generation, validation, persistence and two-layer grading."""
from __future__ import annotations

import json
import random
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..content.store import ContentStore
from ..models import ExerciseQuestion, ExerciseSet, ExerciseSubmission, MistakeRecord, QuestionResponse, utcnow
from ..services import adaptive
from ..services import progress as P
from ..services.grading import normalize
from . import prompts
from .errors import AIBadInput, AIInvalidOutput
from .gateway import AIGateway
from .knowledge import KnowledgeBase
from .schemas import AIGrade, ExerciseGeneration, GenQuestion, GradingBatch, SolveResult
from .validators import MC_TYPES, OPEN_TYPES, SHORT_DET_TYPES, validate_batch

ALL_TYPES = [
    "multiple_choice", "true_false", "fill_blank", "verb_conjugation", "error_correction", "sentence_transformation",
    "sentence_ordering", "matching", "translation_vi_en", "translation_en_vi", "short_answer", "sentence_writing",
    "reading_comprehension", "contextual_grammar",
]
LETTERS = "ABCDEFGH"


@dataclass
class GenParams:
    lesson_id: str | None
    scope: str = "lesson"          # lesson | previous | weak | mistakes
    count: int = 10
    difficulty: str = "normal"     # easy | normal | hard | adaptive
    question_types: list[str] | None = None  # None/["mixed"] = mixed
    focus: list[str] | None = None  # extra focus (e.g. writing error categories)
    kind: str = "practice"
    parent_set_id: str | None = None


class ExerciseService:
    def __init__(self, gateway: AIGateway, store: ContentStore, kb: KnowledgeBase):
        self.gw = gateway
        self.store = store
        self.kb = kb

    # ------------------------------------------------------------------ topics
    def _topics(self, db: Session, user_id: int, p: GenParams) -> tuple[list[str], list[dict]]:
        mistakes: list[dict] = []
        if p.scope == "mistakes":
            recs = list(db.scalars(select(MistakeRecord).where(MistakeRecord.user_id == user_id, MistakeRecord.review_status != "mastered")
                                  .order_by(MistakeRecord.frequency.desc(), MistakeRecord.last_seen.desc()).limit(12)))
            if not recs:
                raise AIBadInput("Sổ lỗi chưa có lỗi nào cần ôn.")
            mistakes = [{"question": r.question_text[:300], "learner_answer": r.student_answer[:200], "correct": r.corrected_answer[:200],
                         "error_type": r.error_type, "topic": r.topic_id} for r in recs]
            topics = []
            for r in recs:
                if r.topic_id and r.topic_id in self.store.units and r.topic_id not in topics:
                    topics.append(r.topic_id)
            return topics[:3] or ([p.lesson_id] if p.lesson_id else []), mistakes
        if p.scope == "weak":
            weak = [w["topic_id"] for w in adaptive.weaknesses(db, user_id, self.store) if w["topic_id"] in self.store.units]
            if weak:
                return weak[:3], []
        if not p.lesson_id or p.lesson_id not in self.store.units:
            raise AIBadInput("Cần chọn bài học hợp lệ.")
        if p.scope == "previous":
            u = self.store.units[p.lesson_id]
            same = [x.id for x in self.store.unit_list if x.kind == u.kind and x.level == u.level and x.order < u.order]
            return [p.lesson_id] + same[-3:], []
        return [p.lesson_id], []

    def _avoid(self, db: Session, user_id: int, topics: list[str]) -> list[str]:
        rows = db.scalars(select(ExerciseQuestion.question_text).join(ExerciseSet, ExerciseSet.id == ExerciseQuestion.set_id)
                          .where(ExerciseSet.user_id == user_id, ExerciseQuestion.topic_id.in_(topics))
                          .order_by(ExerciseSet.created_at.desc()).limit(60))
        return list(rows)

    # ------------------------------------------------------------------ generate
    def generate(self, db: Session, user_id: int, p: GenParams) -> ExerciseSet:
        limits = self.gw.limits(db, user_id)
        if not 1 <= p.count <= limits["max_exercise_count"]:
            raise AIBadInput(f"Số câu phải từ 1 đến {limits['max_exercise_count']}.")
        types = None if not p.question_types or "mixed" in p.question_types else [t for t in p.question_types if t in ALL_TYPES]
        topics, mistakes = self._topics(db, user_id, p)
        if not topics:
            raise AIBadInput("Không xác định được chủ điểm để tạo bài.")
        primary = self.store.units[topics[0]]
        level = primary.level or "B1"
        difficulty = adaptive.suggested_difficulty(db, user_id, topics[0]) if p.difficulty == "adaptive" else p.difficulty
        budget = 7000 // len(topics)
        curriculum = "\n\n".join(
            f'<curriculum lesson="{t}" title="{self.store.units[t].title}" level="{self.store.units[t].level}">\n'
            f"{self.kb.lesson_sections(t, limit=budget)}\n</curriculum>" for t in topics)
        samples = self.kb.lesson_exercise_samples(topics[0])
        avoid = self._avoid(db, user_id, topics)
        accepted: list[GenQuestion] = []
        rejected_all: list[dict] = []
        verified = 0
        attempts = 0
        while len(accepted) < p.count and attempts < 2:
            attempts += 1
            need = p.count - len(accepted)
            ask = need + (2 if need >= 4 else 1)  # small buffer for questions dropped by validation
            payload = {
                "task": "Create exercises", "count": ask, "cefr_level": level, "difficulty": difficulty,
                "question_types": types or "mixed (choose a varied, suitable mix; at least 40% auto-gradable types)",
                "allowed_source_lesson_ids": topics, "focus": p.focus or [],
                "learner_mistakes_to_target": mistakes,
                "note": "For learner_mistakes_to_target, write NEW questions that test the same rule; never copy the old question.",
            }
            user_input = (f"{json.dumps(payload, ensure_ascii=False)}\n\n{curriculum}\n\n"
                          f"<curriculum section=\"style examples from the lesson\">\n{samples}\n</curriculum>\n\n"
                          f"<avoid>\n" + "\n".join(f"- {a}" for a in (avoid + [q.question_text for q in accepted])[-80:]) + "\n</avoid>")
            gen = self.gw.structured(db, user_id, feature="exercise_generate", task="exercise", instructions=prompts.EXERCISE,
                                     input=user_input, schema=ExerciseGeneration, max_output_tokens=min(16000, 900 + ask * 450))
            ok, rejected = validate_batch(gen.questions, allowed_types=set(types) if types else None,
                                          avoid=avoid + [q.question_text for q in accepted])
            rejected_all += rejected
            if self.gw.settings.verify_exercises and ok:
                ok, bad, n = self._blind_verify(db, user_id, ok)
                verified += n
                rejected_all += bad
            for q in ok:
                if q.source_lesson_id not in topics:
                    q.source_lesson_id = topics[0]
            accepted += ok
            title = gen.title
            objectives = gen.learning_objectives
        if not accepted:
            raise AIInvalidOutput("all generated questions failed validation")
        accepted = accepted[: p.count]
        set_id = str(uuid.uuid4())
        es = ExerciseSet(id=set_id, user_id=user_id, kind=p.kind, title=(title or f"Luyện tập {primary.title}")[:200],
                         lesson_id=topics[0], topic_ids=topics, level=level, difficulty=difficulty, objectives=objectives[:6],
                         parent_set_id=p.parent_set_id,
                         meta={"generation": {"model": self.gw.settings.model("exercise"), "requested": p.count, "accepted": len(accepted),
                                              "rejected": rejected_all[:40], "blind_verified": verified, "attempts": attempts,
                                              "scope": p.scope, "question_types": types or ["mixed"], "focus": p.focus or []}})
        db.add(es)
        db.flush()  # parent row before questions (FK)
        for i, q in enumerate(accepted):
            db.add(self._to_row(set_id, i, q, level))
        db.commit()
        return es

    def _blind_verify(self, db: Session, user_id: int, qs: list[GenQuestion]) -> tuple[list[GenQuestion], list[dict], int]:
        """Independent check: a separate call solves deterministic questions without the key."""
        idx = [i for i, q in enumerate(qs) if (q.question_type in MC_TYPES and q.options) or q.question_type in ("true_false", *SHORT_DET_TYPES)]
        if not idx:
            return qs, [], 0
        lines = []
        for n, i in enumerate(idx, 1):
            q = qs[i]
            opts = "  ".join(f"{LETTERS[k]}. {o}" for k, o in enumerate(q.options)) if q.options else ""
            ctx = f" [Context: {q.context_passage}]" if q.context_passage else ""
            lines.append(f"{n}. {q.question_text}{ctx} {opts}".strip())
        res = self.gw.structured(db, user_id, feature="exercise_verify", task="grading", instructions=prompts.SOLVER,
                                 input="<learner_text>\n" + "\n".join(lines) + "\n</learner_text>", schema=SolveResult,
                                 max_output_tokens=200 + 60 * len(idx))
        answers = {a.question_number: a for a in res.answers}
        keep = set(range(len(qs))) - set(idx)
        bad = []
        for n, i in enumerate(idx, 1):
            q, a = qs[i], answers.get(n)
            if a is None:
                bad.append({"index": i, "reason": "verifier skipped question", "question": q.question_text[:160]})
                continue
            if a.is_ambiguous or a.has_error:
                bad.append({"index": i, "reason": f"verifier: {'ambiguous' if a.is_ambiguous else 'question error'} — {a.note[:120]}", "question": q.question_text[:160]})
                continue
            if q.options:
                letter = normalize(a.answer)[:1].upper()
                expected = LETTERS[q.correct_option_index or 0]
                matches = letter == expected or normalize(a.answer) == normalize(q.options[q.correct_option_index or 0])
            else:
                matches = normalize(a.answer) in {normalize(x) for x in q.correct_answers}
            if not matches:
                bad.append({"index": i, "reason": f"verifier answered '{a.answer[:40]}' — key disagrees", "question": q.question_text[:160]})
                continue
            keep.add(i)
        return [qs[i] for i in sorted(keep)], bad, len(idx)

    @staticmethod
    def _to_row(set_id: str, i: int, q: GenQuestion, level: str) -> ExerciseQuestion:
        extra: dict = {"instructions_vi": q.instructions_vi, "context_passage": q.context_passage}
        if q.question_type == "sentence_ordering":
            toks = list(q.ordering_tokens)
            random.Random(set_id + str(i)).shuffle(toks)
            extra["tokens"] = toks
        if q.question_type == "matching":
            rights = [p.right for p in q.matching_pairs]
            random.Random(set_id + str(i)).shuffle(rights)
            extra["left"] = [p.left for p in q.matching_pairs]
            extra["right"] = rights
        key = {"correct_index": q.correct_option_index, "answers": q.correct_answers, "criteria": q.answer_criteria,
               "pairs": [p.model_dump() for p in q.matching_pairs], "wrong_explanations": q.wrong_option_explanations_vi,
               "evidence": q.evidence_quote, "strategy": q.reading_strategy_vi}
        return ExerciseQuestion(id=f"{set_id[:8]}-{i + 1}-{uuid.uuid4().hex[:6]}", set_id=set_id, position=i, qtype=q.question_type,
                                level=level, topic_id=q.source_lesson_id, question_text=q.question_text, options=q.options,
                                extra=extra, answer_key=key, explanation_vi=q.explanation_vi, difficulty=q.difficulty,
                                learning_objective=q.learning_objective, grammar_rule=q.related_grammar_rule,
                                tags=[q.grammar_topic, q.question_type])

    # ------------------------------------------------------------------ views
    def questions(self, db: Session, set_id: str) -> list[ExerciseQuestion]:
        return list(db.scalars(select(ExerciseQuestion).where(ExerciseQuestion.set_id == set_id).order_by(ExerciseQuestion.position)))

    @staticmethod
    def public_question(q: ExerciseQuestion) -> dict:
        """No answer key, no explanation."""
        return {"id": q.id, "position": q.position, "qtype": q.qtype, "question_text": q.question_text, "options": q.options,
                "instructions_vi": q.extra.get("instructions_vi", ""), "context_passage": q.extra.get("context_passage"),
                "tokens": q.extra.get("tokens"), "left": q.extra.get("left"), "right": q.extra.get("right"),
                "level": q.level, "difficulty": q.difficulty, "topic_id": q.topic_id, "learning_objective": q.learning_objective}

    def public_set(self, db: Session, es: ExerciseSet, hide_meta: tuple[str, ...] = ("transcript", "segments")) -> dict:
        meta = {k: v for k, v in (es.meta or {}).items() if k not in hide_meta and k != "generation"}
        questions = [self.public_question(q) for q in self.questions(db, es.id)]
        if es.kind in ("listening", "reading"):
            # Model-generated questions may copy the transcript into their context.
            # All public routes must obey the listening transcript policy.
            # Reading already displays its shared passage alongside the questions.
            for q in questions:
                q["context_passage"] = None
        gen = (es.meta or {}).get("generation", {})
        topic = self.store.units.get(es.lesson_id or "")
        return {"id": es.id, "kind": es.kind, "title": es.title, "lesson_id": es.lesson_id, "lesson_title": topic.title if topic else None,
                "topic_ids": es.topic_ids, "level": es.level, "difficulty": es.difficulty, "objectives": es.objectives,
                "created_at": es.created_at.isoformat(), "meta": meta,
                "generation": {"accepted": gen.get("accepted"), "requested": gen.get("requested"), "rejected": len(gen.get("rejected", [])),
                               "blind_verified": gen.get("blind_verified"), "scope": gen.get("scope")},
                "questions": questions}

    # ------------------------------------------------------------------ grading
    @staticmethod
    def _deterministic(q: ExerciseQuestion, answer) -> dict | None:
        key = q.answer_key
        t = q.qtype
        if answer in (None, "", []):
            return {"correctness": "unanswered", "score": 0.0}
        if (t in MC_TYPES and q.options) or t == "true_false":
            try:
                chosen = int(answer)
            except (TypeError, ValueError):
                return {"correctness": "incorrect", "score": 0.0}
            ok = chosen == key.get("correct_index")
            return {"correctness": "correct" if ok else "incorrect", "score": 1.0 if ok else 0.0, "chosen_index": chosen}
        if t == "matching":
            if not isinstance(answer, dict):
                return {"correctness": "incorrect", "score": 0.0}
            pairs = key.get("pairs", [])
            good = sum(1 for p in pairs if normalize(str(answer.get(p["left"], ""))) == normalize(p["right"]))
            score = good / max(1, len(pairs))
            return {"correctness": "correct" if score == 1 else "partially_correct" if score > 0 else "incorrect", "score": round(score, 2)}
        if t == "sentence_ordering":
            ok = normalize(str(answer)) in {normalize(a) for a in key.get("answers", [])}
            return {"correctness": "correct" if ok else "incorrect", "score": 1.0 if ok else 0.0}
        if t in SHORT_DET_TYPES:
            ok = normalize(str(answer)) in {normalize(a) for a in key.get("answers", [])}
            # a mismatch may still be a valid alternative → learner can request an AI review
            return {"correctness": "correct" if ok else "incorrect", "score": 1.0 if ok else 0.0, "reviewable": not ok}
        if t in OPEN_TYPES or t in MC_TYPES:
            if normalize(str(answer)) in {normalize(a) for a in key.get("answers", [])}:
                return {"correctness": "correct", "score": 1.0}
            return None  # needs semantic grading
        return None

    def _ai_grade(self, db: Session, user_id: int, items: list[tuple[ExerciseQuestion, str]], complex_: bool = False) -> dict[str, dict]:
        lines = []
        for n, (q, ans) in enumerate(items, 1):
            lines.append(json.dumps({
                "question_number": n, "type": q.qtype, "level": q.level, "question": q.question_text,
                "context": q.extra.get("context_passage"), "reference_answers": q.answer_key.get("answers", []),
                "criteria": q.answer_key.get("criteria"), "rule": q.grammar_rule}, ensure_ascii=False)
                + f"\n<learner_answer n=\"{n}\">{ans[:1500]}</learner_answer>")
        long_answers = any(len(a.split()) > 25 for _, a in items)
        task = "complex_grading" if complex_ or long_answers else "grading"
        batch = self.gw.structured(db, user_id, feature="exercise_grade", task=task, instructions=prompts.GRADER,
                                   input="\n\n".join(lines), schema=GradingBatch, max_output_tokens=400 + 450 * len(items))
        out: dict[str, dict] = {}
        by_n = {r.question_number: r for r in batch.results}
        if len(batch.results) != len(items) or set(by_n) != set(range(1, len(items) + 1)):
            raise AIInvalidOutput("grading batch missing or duplicating question numbers")
        for n, (q, _) in enumerate(items, 1):
            r = by_n[n]
            if r.correctness == "needs_review":
                raise AIInvalidOutput("grading did not reach a verdict")
            out[q.id] = self._grade_dict(r)
        return out

    @staticmethod
    def _grade_dict(r: AIGrade) -> dict:
        score = max(0.0, min(1.0, r.score))
        correctness = r.correctness
        if correctness == "correct" and score < 0.75:
            correctness = "partially_correct"
        if correctness == "incorrect" and score > 0.5:
            score = 0.5
        if correctness == "partially_correct":
            correctness = "partial"
        return {"correctness": correctness, "score": round(score, 2), "feedback_vi": r.feedback_vi,
                "errors": [e.model_dump() for e in r.errors], "corrected_answer": r.corrected_answer,
                "acceptable_alternatives": r.acceptable_alternatives, "grammar_explanation_vi": r.grammar_explanation_vi,
                "improvement_suggestion_vi": r.improvement_suggestion_vi, "follow_up_suggestion_vi": r.follow_up_suggestion_vi,
                "confidence": r.confidence, "needs_manual_review": r.correctness == "needs_review" or r.confidence == "low"}

    def _review_entry(self, q: ExerciseQuestion, resp: QuestionResponse | None) -> dict:
        key = q.answer_key
        expected = (q.options[key["correct_index"]] if key.get("correct_index") is not None and q.options else
                    (key.get("answers") or [None])[0])
        lesson = self.store.units.get(q.topic_id or "")
        return {**self.public_question(q), "answer_key": {"correct_index": key.get("correct_index"), "answers": key.get("answers", []),
                                                          "pairs": key.get("pairs", []), "criteria": key.get("criteria")},
                "expected_answer": expected, "explanation_vi": q.explanation_vi, "grammar_rule": q.grammar_rule,
                "wrong_option_explanations_vi": key.get("wrong_explanations") or [], "evidence_quote": key.get("evidence"),
                "reading_strategy_vi": key.get("strategy"),
                "related_lesson": {"id": lesson.id, "title": lesson.title} if lesson else None,
                "response": None if resp is None else {"answer": resp.answer, "correctness": resp.correctness, "score": resp.score,
                                                       "grader": resp.grader, "feedback": resp.feedback, "time_ms": resp.time_ms}}

    def review(self, db: Session, user_id: int, es: ExerciseSet, submission_id: int | None = None) -> dict | None:
        query = select(ExerciseSubmission).where(ExerciseSubmission.set_id == es.id, ExerciseSubmission.user_id == user_id)
        if submission_id is not None:
            query = query.where(ExerciseSubmission.id == submission_id)
        sub = db.scalars(query.order_by(ExerciseSubmission.id.desc()).limit(1)).first()
        if sub is None:
            return None
        resps = {r.question_id: r for r in db.scalars(select(QuestionResponse).where(QuestionResponse.submission_id == sub.id))}
        return {"submission_id": sub.id, "score": sub.score, "max_score": sub.max_score, "created_at": sub.created_at.isoformat(),
                "attempt_count": len(list(db.scalars(select(ExerciseSubmission.id).where(ExerciseSubmission.set_id == es.id)))),
                "questions": [self._review_entry(q, resps.get(q.id)) for q in self.questions(db, es.id)]}

    def submit(self, db: Session, user_id: int, es: ExerciseSet, answers: dict, times: dict, client_id: str) -> dict:
        existing = db.scalar(select(ExerciseSubmission).where(ExerciseSubmission.user_id == user_id,
                                                              ExerciseSubmission.client_submission_id == client_id))
        if existing is not None:  # idempotent retry of the same submission
            if existing.set_id != es.id:
                raise AIBadInput("Mã nộp bài đã dùng cho bộ bài khác.")
            return self.review(db, user_id, es, existing.id)
        qs = self.questions(db, es.id)
        unknown = set(answers) - {q.id for q in qs}
        if unknown:
            raise AIBadInput("Câu trả lời không thuộc bộ bài này.")
        results: dict[str, dict] = {}
        pending: list[tuple[ExerciseQuestion, str]] = []
        for q in qs:
            ans = answers.get(q.id)
            det = self._deterministic(q, ans)
            if det is None:
                pending.append((q, str(ans)))
            else:
                results[q.id] = {**det, "grader": "deterministic"}
        if pending:
            ai = self._ai_grade(db, user_id, pending)  # raises AIError → nothing is saved, answers stay in the browser
            for qid, r in ai.items():
                results[qid] = {**r, "grader": "ai"}
        sub = ExerciseSubmission(user_id=user_id, set_id=es.id, client_submission_id=client_id, meta={})
        db.add(sub)
        db.flush()
        total = 0.0
        for q in qs:
            r = results[q.id]
            fb = dict(r)
            if r["grader"] == "deterministic":
                fb.setdefault("feedback_vi", self._det_feedback(q, r))
            ans = answers.get(q.id)
            db.add(QuestionResponse(submission_id=sub.id, question_id=q.id, user_id=user_id,
                                    answer=ans if isinstance(ans, str) else json.dumps(ans, ensure_ascii=False) if ans is not None else "",
                                    correctness=r["correctness"], score=r["score"], grader=r["grader"], feedback=fb,
                                    time_ms=int(times.get(q.id)) if str(times.get(q.id, "")).isdigit() else None))
            total += r["score"]
            self._learning_updates(db, user_id, q, ans, r)
        sub.score = round(total, 2)
        sub.max_score = float(len(qs))
        act = P.activity(db, user_id)
        answered = sum(1 for q in qs if answers.get(q.id) not in (None, "", []))
        act.items_answered += answered
        P.log_study(db, user_id, {"listening": "listening-studio", "reading": "reading-studio"}.get(es.kind, "ai-practice"), kind="module",
                    items=answered, correct=int(round(total)))
        P.check_achievements(db, user_id, self.store)
        db.commit()
        return self.review(db, user_id, es)

    @staticmethod
    def _det_feedback(q: ExerciseQuestion, r: dict) -> str:
        key = q.answer_key
        if r["correctness"] == "unanswered":
            return "Chưa trả lời."
        if r["correctness"] == "correct":
            return "Chính xác!"
        exp = q.options[key["correct_index"]] if key.get("correct_index") is not None and q.options else ", ".join(key.get("answers", [])[:3])
        return f"Chưa đúng. Đáp án: {exp}."

    def _learning_updates(self, db: Session, user_id: int, q: ExerciseQuestion, ans, r: dict) -> None:
        if r["correctness"] in ("unanswered", "needs_review"):
            return
        cat = (r.get("errors") or [{}])[0].get("category") if r.get("errors") else None
        adaptive.record_result(db, user_id, q.topic_id, r["score"], q.difficulty, cat)
        if r["score"] >= 0.75:
            P.award(db, user_id, f"item:ai:{q.id}", "auto_correct", P.XP_RULES["auto_correct"])
            adaptive.record_mistake_success(db, user_id, f"ai:{q.id}")
            adaptive.topic_success(db, user_id, q.topic_id)
        else:
            key = q.answer_key
            corrected = r.get("corrected_answer") or (q.options[key["correct_index"]] if key.get("correct_index") is not None and q.options
                                                      else ", ".join(key.get("answers", [])[:2]))
            adaptive.record_mistake(db, user_id, key=f"ai:{q.id}", source_type="ai_exercise", source_ref=q.id,
                                    question_text=q.question_text, student_answer=ans if isinstance(ans, str) else json.dumps(ans, ensure_ascii=False),
                                    corrected_answer=corrected or "", error_type=cat or "other",
                                    explanation=r.get("feedback_vi") or q.explanation_vi, topic_id=q.topic_id)

    def regrade(self, db: Session, user_id: int, es: ExerciseSet, question_id: str) -> dict:
        """Learner asks for an AI review of an uncertain or rejected answer (uses the stronger model)."""
        sub = db.scalars(select(ExerciseSubmission).where(ExerciseSubmission.set_id == es.id, ExerciseSubmission.user_id == user_id)
                         .order_by(ExerciseSubmission.id.desc()).limit(1)).first()
        resp = sub and db.scalar(select(QuestionResponse).where(QuestionResponse.submission_id == sub.id, QuestionResponse.question_id == question_id))
        q = db.get(ExerciseQuestion, question_id)
        if not resp or not q or q.set_id != es.id:
            raise AIBadInput("Chưa có câu trả lời để xem xét lại.")
        if resp.feedback.get("reviewed_by_ai"):
            return self.review(db, user_id, es)
        r = self._ai_grade(db, user_id, [(q, resp.answer)], complex_=True)[q.id]
        old = resp.score
        resp.correctness, resp.score, resp.grader = r["correctness"], r["score"], "ai"
        resp.feedback = {**r, "reviewed_by_ai": True, "previous": {"correctness": resp.feedback.get("correctness"), "score": old}}
        sub.score = round(sub.score - old + r["score"], 2)
        if r["score"] >= 0.75:
            adaptive.record_mistake_success(db, user_id, f"ai:{q.id}")
            P.award(db, user_id, f"item:ai:{q.id}", "auto_correct", P.XP_RULES["auto_correct"])
        db.commit()
        return self.review(db, user_id, es)


def history(db: Session, user_id: int, store: ContentStore, kind: str | None = None, limit: int = 50) -> list[dict]:
    q = select(ExerciseSet).where(ExerciseSet.user_id == user_id)
    if kind:
        q = q.where(ExerciseSet.kind == kind)
    out = []
    for es in db.scalars(q.order_by(ExerciseSet.created_at.desc()).limit(limit)):
        subs = list(db.scalars(select(ExerciseSubmission).where(ExerciseSubmission.set_id == es.id).order_by(ExerciseSubmission.id)))
        n = len(list(db.scalars(select(ExerciseQuestion.id).where(ExerciseQuestion.set_id == es.id))))
        u = store.units.get(es.lesson_id or "")
        out.append({"id": es.id, "kind": es.kind, "title": es.title, "lesson_id": es.lesson_id, "lesson_title": u.title if u else None,
                    "level": es.level, "difficulty": es.difficulty, "questions": n, "created_at": es.created_at.isoformat(),
                    "attempts": len(subs), "best_score": max((s.score for s in subs), default=None),
                    "last_score": subs[-1].score if subs else None})
    return out


