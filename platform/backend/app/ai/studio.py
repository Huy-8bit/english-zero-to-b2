"""AI Listening and Reading studios (generation + TTS); grading reuses ExerciseService."""
from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..content.store import ContentStore
from ..models import ExerciseQuestion, ExerciseSet, ExerciseSubmission, QuestionResponse
from . import media, prompts
from .errors import AIBadInput, AIInvalidOutput
from .exercises import ExerciseService
from .gateway import AIGateway
from .knowledge import KnowledgeBase
from .schemas import ListeningGeneration, ReadingGeneration
from .validators import validate_batch

VOICES = ["marin", "cedar", "coral", "verse", "sage", "ash"]
LEVELS = ("A0", "A1", "A2", "B1", "B2")
READING_TYPES = {"multiple_choice", "true_false", "matching", "reading_comprehension"}
LISTENING_TYPES = {"multiple_choice", "true_false", "short_answer", "listening_comprehension"}


class StudioService:
    def __init__(self, gateway: AIGateway, store: ContentStore, kb: KnowledgeBase, exercises: ExerciseService):
        self.gw, self.store, self.kb, self.ex = gateway, store, kb, exercises

    # ---------------------------------------------------------------- listening
    def generate_listening(self, db: Session, user_id: int, *, level: str, topic: str, minutes: float, difficulty: str,
                           question_count: int, fmt: str, mode: str) -> ExerciseSet:
        if level not in LEVELS or not 0.5 <= minutes <= 4 or not 3 <= question_count <= 10:
            raise AIBadInput("Tham số bài nghe không hợp lệ.")
        words = int(minutes * {"A0": 90, "A1": 100, "A2": 115, "B1": 130, "B2": 145}[level])
        accepted, vocab, segments, title = [], [], [], ""
        for _ in range(2):
            gen = self.gw.structured(db, user_id, feature="listening_generate", task="exercise", instructions=prompts.LISTENING,
                                     input=f"Level {level}; difficulty {difficulty}; format: {fmt} (dialogue = 2 speakers, monologue = 1); "
                                           f"about {words} words; {question_count + 1} questions. Topic: <learner_text>{topic[:200]}</learner_text>. "
                                           "source_lesson_id: use 'listening'.",
                                     schema=ListeningGeneration, max_output_tokens=6000)
            transcript = "\n".join(s.text for s in gen.segments)
            if len(gen.segments) < 2 or len(transcript.split()) < 30:
                continue
            ok, _ = validate_batch(gen.questions, allowed_types=LISTENING_TYPES, avoid=[], passage=transcript)
            ok = [q for q in ok if q.evidence_quote]
            for q in ok:
                q.context_passage = transcript
            if self.gw.settings.verify_exercises and ok:
                ok, _, _ = self.ex._blind_verify(db, user_id, ok)
            if len(ok) >= question_count:
                accepted, vocab, segments, title = ok[:question_count], gen.vocabulary, gen.segments, gen.title
                speakers = gen.speakers
                break
        if not accepted:
            raise AIInvalidOutput("listening questions failed validation")
        set_id = str(uuid.uuid4())
        voice_of = {sp: VOICES[i % len(VOICES)] for i, sp in enumerate(dict.fromkeys([s.speaker for s in segments] or speakers))}
        audio = bytearray()
        model = self.gw.settings.model("tts")
        for seg in segments:  # one TTS call per segment, cached by text+voice; never repeated on replay
            rel = media.tts_name(model, voice_of[seg.speaker], seg.text, provider=self.gw.provider.name)
            if not media.exists(rel):
                media.write(rel, self.gw.speech(db, user_id, feature="listening_tts", text=seg.text, voice=voice_of[seg.speaker]))
            audio += media.resolve(rel).read_bytes()
        rel = media.write(f"listening/{set_id}.mp3", bytes(audio))
        es = ExerciseSet(id=set_id, user_id=user_id, kind="listening", title=title[:200], lesson_id=None, topic_ids=["listening"],
                         level=level, difficulty=difficulty, objectives=[f"Listening for details — {topic[:80]}"],
                         meta={"audio": rel, "mode": mode, "format": fmt, "topic": topic[:200], "estimated_seconds": int(len(" ".join(s.text for s in segments).split()) / 2.4),
                               "segments": [s.model_dump() for s in segments], "vocabulary": [v.model_dump() for v in vocab],
                               "voices": voice_of, "tts_model": model,
                               "generation": {"model": self.gw.settings.model("exercise"), "requested": question_count, "accepted": len(accepted)}})
        db.add(es)
        db.flush()  # parent row before questions (FK)
        for i, q in enumerate(accepted):
            db.add(ExerciseService._to_row(set_id, i, q, level))
        db.commit()
        return es

    def listening_public(self, db: Session, user_id: int, es: ExerciseSet, reveal: bool) -> dict:
        data = self.ex.public_set(db, es, hide_meta=("segments", "vocabulary", "voices", "audio"))
        submitted = db.scalar(select(ExerciseSubmission.id).where(ExerciseSubmission.set_id == es.id, ExerciseSubmission.user_id == user_id)) is not None
        data["audio_url"] = f"/api/media/{es.meta['audio']}"
        data["submitted"] = submitted
        allowed = submitted or (es.meta.get("mode") == "practice" and reveal)
        data["transcript"] = es.meta.get("segments") if allowed else None
        data["vocabulary"] = es.meta.get("vocabulary") if submitted else None
        data["transcript_policy"] = "after_submit" if es.meta.get("mode") == "test" else "toggle"
        return data

    # ---------------------------------------------------------------- reading
    def generate_reading(self, db: Session, user_id: int, *, level: str, topic: str, words: int, text_type: str,
                         question_count: int, question_types: list[str]) -> ExerciseSet:
        if level not in LEVELS or not 80 <= words <= 700 or not 3 <= question_count <= 10:
            raise AIBadInput("Tham số bài đọc không hợp lệ.")
        types = {t for t in question_types if t in READING_TYPES} or READING_TYPES
        accepted, gen = [], None
        for _ in range(2):
            gen = self.gw.structured(db, user_id, feature="reading_generate", task="exercise", instructions=prompts.READING,
                                     input=f"Level {level}; text type: {text_type}; about {words} words; {question_count + 1} questions; "
                                           f"question types: {sorted(types)}; topic: <learner_text>{topic[:200]}</learner_text>. "
                                           "source_lesson_id: use 'reading'.",
                                     schema=ReadingGeneration, max_output_tokens=7000)
            ok, _ = validate_batch(gen.questions, allowed_types=types, avoid=[], passage=gen.passage)
            ok = [q for q in ok if q.evidence_quote or q.question_type == "matching"]
            for q in ok:
                q.context_passage = gen.passage
            if self.gw.settings.verify_exercises and ok:
                ok, _, _ = self.ex._blind_verify(db, user_id, ok)
            if len(gen.passage.split()) >= 50 and len(ok) >= question_count:
                accepted = ok[:question_count]
                break
        if not accepted or gen is None:
            raise AIInvalidOutput("reading questions failed validation")
        set_id = str(uuid.uuid4())
        es = ExerciseSet(id=set_id, user_id=user_id, kind="reading", title=gen.title[:200], lesson_id=None, topic_ids=["reading"],
                         level=level, difficulty="normal", objectives=[f"Reading — {text_type}"],
                         meta={"passage": gen.passage, "vocabulary": [v.model_dump() for v in gen.vocabulary], "text_type": text_type,
                               "generation": {"model": self.gw.settings.model("exercise"), "requested": question_count, "accepted": len(accepted)}})
        db.add(es)
        db.flush()  # parent row before questions (FK)
        for i, q in enumerate(accepted):
            db.add(ExerciseService._to_row(set_id, i, q, level))
        db.commit()
        return es

    def reading_analytics(self, db: Session, user_id: int) -> dict:
        rows = db.execute(select(ExerciseQuestion.qtype, ExerciseQuestion.tags, QuestionResponse.score, QuestionResponse.time_ms)
                          .join(QuestionResponse, QuestionResponse.question_id == ExerciseQuestion.id)
                          .join(ExerciseSet, ExerciseSet.id == ExerciseQuestion.set_id)
                          .where(ExerciseSet.kind == "reading", QuestionResponse.user_id == user_id)).all()
        by: dict[str, list] = defaultdict(list)
        for qtype, tags, score, t in rows:
            label = (tags or [qtype])[0] if qtype in ("multiple_choice", "reading_comprehension") else qtype
            by[label or qtype].append((score, t))
        return {"total": len(rows), "by_type": [
            {"type": k, "answered": len(v), "accuracy": round(sum(s for s, _ in v) / len(v), 3),
             "avg_seconds": round(sum(t for _, t in v if t) / max(1, sum(1 for _, t in v if t)) / 1000, 1) if any(t for _, t in v) else None}
            for k, v in sorted(by.items(), key=lambda kv: -len(kv[1]))]}
