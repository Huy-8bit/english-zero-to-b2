"""AI Speaking Coach: record → transcribe → feedback → next question (TTS), plus session summaries.

Read Aloud is a pronunciation check (app/ai/pronunciation.py): an unprompted transcription with word confidences is
compared with the target sentence word by word, and every word not heard as intended gets dictionary IPA and a fix.
Conversation turns are transcribed the same way, so words the recogniser could not hear clearly are listed too.
Intonation and accent are not scored.
"""
from __future__ import annotations

import random
import re
import uuid
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..content.md import strip_md
from ..content.store import ContentStore
from ..models import SpeakingSession, SpeakingTurn, utcnow
from ..services import adaptive
from ..services import progress as P
from . import media, prompts
from .errors import AIBadInput
from .gateway import AIGateway
from .schemas import SpeakingQuestion, SpeakingSummaryOut, SpeakingTurnFeedback

MODES = {
    "read_aloud": "Read aloud", "guided": "Guided conversation", "roleplay": "Role-play", "free": "Free conversation",
    "vstep1": "VSTEP-style Speaking Part 1 (social interaction)", "vstep2": "VSTEP-style Speaking Part 2 (solution discussion)",
    "vstep3": "VSTEP-style Speaking Part 3 (topic development)",
}
ROLEPLAYS = {
    "ordering_food": "Ordering food in a restaurant (AI = waiter)", "job_interview": "Job interview (AI = interviewer)",
    "directions": "Asking for directions (AI = local person)", "hobbies": "Talking about hobbies (AI = new friend)",
    "workplace": "Workplace conversation (AI = colleague)", "technology": "Discussing technology (AI = friend)",
}
FILLERS = re.compile(r"\b(um+|uh+|er+|erm|hmm+|you know|i mean|like)\b", re.I)
MAX_TURNS = 12
ALLOWED_AUDIO = {"audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a"}
EXT = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav",
       "audio/m4a": "m4a", "audio/x-m4a": "m4a"}


def fluency_indicators(text: str, seconds: float | None) -> dict:
    words = re.findall(r"[A-Za-z']+", text)
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    return {
        "words": len(words), "seconds": round(seconds, 1) if seconds else None,
        "words_per_minute": round(len(words) / (seconds / 60), 0) if seconds and seconds > 2 else None,
        "fillers": len(FILLERS.findall(text)), "sentences": len(sentences),
        "avg_words_per_sentence": round(len(words) / max(1, len(sentences)), 1),
        "note_vi": "Chỉ số tính từ bản chép lời tự động và thời lượng ghi âm — không phải chấm phát âm.",
    }


def read_aloud_match(target: str, said: str) -> dict:
    t = re.findall(r"[a-z']+", target.lower())
    s = re.findall(r"[a-z']+", said.lower())
    sm = SequenceMatcher(a=t, b=s)
    missing, extra = [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op in ("delete", "replace"):
            missing += t[i1:i2]
        if op in ("insert", "replace"):
            extra += s[j1:j2]
    matched = sum(b.size for b in sm.get_matching_blocks())
    return {"target": target, "recognised": said, "word_match_percent": round(100 * matched / max(1, len(t))),
            "missing_words": missing[:20], "different_words": extra[:20],
            "note_vi": "So khớp từ mà hệ thống nhận diện được với câu mẫu. Từ bị thiếu có thể do bạn đọc sót hoặc do máy nhận "
                       "diện chưa chuẩn — hãy nghe lại bản ghi của bạn. Đây không phải điểm phát âm."}


class SpeakingService:
    def __init__(self, gateway: AIGateway, store: ContentStore, pronunciation=None):
        from .pronunciation import PronunciationService

        self.gw, self.store = gateway, store
        self.pron = pronunciation or PronunciationService(gateway)

    # ------------------------------------------------------------ helpers
    def _tts(self, db: Session, user_id: int, text: str) -> str | None:
        model, voice = self.gw.settings.model("tts"), self.gw.settings.tts_voice
        rel = media.tts_name(model, voice, text, provider=self.gw.provider.name)
        if media.exists(rel):  # replay / repeated text never costs a new TTS request
            return rel
        try:
            audio = self.gw.speech(db, user_id, feature="speaking_tts", text=text, voice=voice)
        except Exception:  # noqa: BLE001 — the conversation still works with text only
            return None
        return media.write(rel, audio)

    def _read_aloud_sentence(self, level: str, topic: str, used: set[str]) -> str:
        pool = []
        for u in self.store.unit_list:
            if u.kind != "grammar" or (level and u.level != level):
                continue
            for st in self.store.built(u.id).steps:
                for ex in st.get("examples", []) or []:
                    s = strip_md(ex["en"]).strip(' "')
                    if 4 <= len(s.split()) <= 18 and re.fullmatch(r"[A-Za-z0-9 ,.'’?!\-—:;]+", s) and s not in used:
                        pool.append(s)
        if topic:
            ranked = [s for s in pool if any(w in s.lower() for w in topic.lower().split())]
            pool = ranked or pool
        if not pool:
            raise AIBadInput("Không tìm được câu mẫu cho cấp độ này.")
        return random.choice(pool)

    def _owned(self, db: Session, user_id: int, session_id: str) -> SpeakingSession:
        s = db.get(SpeakingSession, session_id)
        if s is None or s.user_id != user_id:
            raise AIBadInput("Không tìm thấy phiên luyện nói.")
        return s

    def turns(self, db: Session, session_id: str) -> list[SpeakingTurn]:
        return list(db.scalars(select(SpeakingTurn).where(SpeakingTurn.session_id == session_id).order_by(SpeakingTurn.id)))

    # ------------------------------------------------------------ flow
    def start(self, db: Session, user_id: int, *, mode: str, topic: str, level: str) -> SpeakingSession:
        if mode not in MODES:
            raise AIBadInput("Chế độ luyện nói không hợp lệ.")
        if mode == "roleplay" and topic not in ROLEPLAYS:
            raise AIBadInput("Chọn một tình huống role-play.")
        s = SpeakingSession(id=str(uuid.uuid4()), user_id=user_id, mode=mode, topic=(ROLEPLAYS.get(topic) or topic or "everyday life")[:200], level=level)
        db.add(s)
        db.flush()
        if mode == "read_aloud":
            sentence = self._read_aloud_sentence(level, topic, set())
            db.add(SpeakingTurn(session_id=s.id, role="ai", text=sentence, audio_file=self._tts(db, user_id, sentence),
                                feedback={"type": "read_aloud_target"}))
        else:
            q = self.gw.structured(db, user_id, feature="speaking_question", task="tutor", instructions=prompts.SPEAKING,
                                   input=f"Mode: {MODES[mode]}. Level: {level}. Topic/situation: <learner_text>{s.topic}</learner_text>. "
                                         "Start the conversation with ONE short first question (or opening line in role-play). "
                                         "hint_vi tells the learner in Vietnamese how to answer; give 3 useful_expressions.",
                                   schema=SpeakingQuestion, max_output_tokens=500)
            db.add(SpeakingTurn(session_id=s.id, role="ai", text=q.question_en, audio_file=self._tts(db, user_id, q.question_en),
                                feedback={"hint_vi": q.hint_vi, "useful_expressions": q.useful_expressions}))
        db.commit()
        return s

    def answer(self, db: Session, user_id: int, session_id: str, *, audio: bytes, content_type: str, seconds: float | None,
               client_turn_id: str) -> SpeakingSession:
        s = self._owned(db, user_id, session_id)
        if s.status != "active":
            raise AIBadInput("Phiên đã kết thúc.")
        if db.scalar(select(SpeakingTurn).where(SpeakingTurn.session_id == s.id, SpeakingTurn.client_turn_id == client_turn_id)):
            return s  # idempotent retry
        lim = self.gw.limits(db, user_id)
        ctype = content_type.split(";")[0].strip().lower()
        if ctype not in ALLOWED_AUDIO:
            raise AIBadInput("Định dạng âm thanh không được hỗ trợ.")
        if not audio or len(audio) > self.gw.settings.max_audio_bytes:
            raise AIBadInput("File ghi âm rỗng hoặc quá lớn.")
        if seconds is not None and seconds > lim["max_audio_seconds"] + 2:
            raise AIBadInput(f"Ghi âm quá dài (tối đa {lim['max_audio_seconds']} giây).")
        turns = self.turns(db, s.id)
        if sum(1 for t in turns if t.role == "user") >= MAX_TURNS:
            raise AIBadInput("Phiên đã đủ số lượt — hãy kết thúc để xem tổng kết.")
        last_ai = next((t for t in reversed(turns) if t.role == "ai"), None)
        pron = None
        if s.mode == "read_aloud":
            # pronunciation check against the target sentence (unprompted transcription, word by word)
            pron = self.pron.assess(db, user_id, audio=audio, content_type=ctype, reference=last_ai.text if last_ai else "",
                                    source="read_aloud", source_ref=s.id, seconds=seconds, level=s.level)
            transcript = pron["heard"].strip()
        else:
            # unprompted as well: a prompt would make the recogniser "hear" the expected words and hide unclear ones
            transcript, heard, _ = self.gw.transcribe_words(db, user_id, feature="speaking_transcribe", audio=audio,
                                                            filename=f"answer.{EXT[ctype]}", duration_hint=seconds)
            transcript = transcript.strip()
            unclear = [w for w, p in heard if p < 0.6][:8]
            pron = {"unclear": unclear} if unclear else None
        if not transcript:
            raise AIBadInput("Không nhận diện được giọng nói. Hãy nói rõ hơn hoặc kiểm tra micro.")
        audio_file = None
        if self.gw.settings.store_user_audio:
            audio_file = media.write(f"speaking/{s.id}/{client_turn_id}.{EXT[ctype]}", audio)
        indicators = fluency_indicators(transcript, seconds)
        if s.mode == "read_aloud":
            fb = {"type": "read_aloud", "match": read_aloud_match(last_ai.text if last_ai else "", transcript), "indicators": indicators,
                  "pronunciation": pron}
            db.add(SpeakingTurn(session_id=s.id, client_turn_id=client_turn_id, role="user", text=transcript, audio_file=audio_file,
                                audio_seconds=seconds, feedback=fb))
            used = {t.text for t in turns if t.role == "ai"}
            nxt = self._read_aloud_sentence(s.level, s.topic, used)
            db.add(SpeakingTurn(session_id=s.id, role="ai", text=nxt, audio_file=self._tts(db, user_id, nxt), feedback={"type": "read_aloud_target"}))
        else:
            history = "\n".join(f"{t.role.upper()}: {t.text}" for t in turns[-8:])
            fb_ai = self.gw.structured(db, user_id, feature="speaking_feedback", task="grading", instructions=prompts.SPEAKING,
                                       input=f"Mode: {MODES[s.mode]}. Level: {s.level}. Topic: {s.topic}.\nConversation so far:\n"
                                             f"<learner_text>\n{history}\n</learner_text>\nLearner's latest answer (speech-to-text):\n"
                                             f"<learner_answer>{transcript}</learner_answer>\nGive feedback on the latest answer and the next question.",
                                       schema=SpeakingTurnFeedback, max_output_tokens=1400)
            fb = {"type": "conversation", **fb_ai.model_dump(), "indicators": indicators}
            if pron:
                fb["pronunciation"] = pron | {"note_vi": "Máy chưa nghe rõ các từ này — hãy nói chậm, rõ âm cuối. Bấm vào từ để luyện."}
            from ..vocabulary.service import record_usage  # shared vocabulary progress: studied words used in speaking

            fb["vocab_used"] = record_usage(db, user_id, transcript, "speaking", [e.original for e in fb_ai.grammar_feedback])
            db.add(SpeakingTurn(session_id=s.id, client_turn_id=client_turn_id, role="user", text=transcript, audio_file=audio_file,
                                audio_seconds=seconds, feedback=fb))
            for i, e in enumerate(fb_ai.grammar_feedback[:5]):
                adaptive.record_mistake(db, user_id, key=f"speaking:{s.id}:{client_turn_id}:{i}", source_type="speaking", source_ref=s.id,
                                        question_text=(last_ai.text if last_ai else "")[:300], student_answer=e.original,
                                        corrected_answer=e.correction, error_type=e.category, explanation=e.explanation_vi, topic_id=None)
            if not fb_ai.should_end:
                db.add(SpeakingTurn(session_id=s.id, role="ai", text=fb_ai.next_question_en,
                                    audio_file=self._tts(db, user_id, fb_ai.next_question_en), feedback={"hint_vi": fb_ai.next_hint_vi}))
        P.activity(db, user_id).items_answered += 1
        P.log_study(db, user_id, "speaking-studio", kind="module", items=1)
        db.commit()
        return s

    def end(self, db: Session, user_id: int, session_id: str) -> SpeakingSession:
        s = self._owned(db, user_id, session_id)
        if s.status == "ended":
            return s
        turns = self.turns(db, s.id)
        user_turns = [t for t in turns if t.role == "user"]
        if not user_turns:
            s.status, s.ended_at, s.summary = "ended", utcnow(), {"empty": True}
            db.commit()
            return s
        if s.mode == "read_aloud":
            matches = [t.feedback["match"]["word_match_percent"] for t in user_turns]
            scores = [t.feedback["pronunciation"]["score"] for t in user_turns if (t.feedback or {}).get("pronunciation")]
            hard = sorted({w["word"] for t in user_turns for w in ((t.feedback or {}).get("pronunciation") or {}).get("words", [])
                           if w["status"] != "ok"})
            s.summary = {"type": "read_aloud", "sentences": len(user_turns), "average_word_match": round(sum(matches) / len(matches)),
                         "average_pronunciation": round(sum(scores) / len(scores)) if scores else None, "words_to_practise": hard[:15],
                         "note_vi": "Điểm phát âm = tỉ lệ từ máy nghe rõ đúng như câu mẫu (độ dễ hiểu), không chấm giọng hay ngữ điệu."}
        else:
            convo = "\n".join(f"{t.role.upper()}: {t.text}" for t in turns)
            out = self.gw.structured(db, user_id, feature="speaking_summary", task="grading", instructions=prompts.SPEAKING,
                                     input=f"Mode: {MODES[s.mode]}. Level: {s.level}. Topic: {s.topic}. Summarise this practice session."
                                           f"\n<learner_text>\n{convo[:12000]}\n</learner_text>",
                                     schema=SpeakingSummaryOut, max_output_tokens=2500)
            unclear = sorted({w for t in user_turns for w in (((t.feedback or {}).get("pronunciation") or {}).get("unclear") or [])})
            s.summary = {"type": "conversation", **out.model_dump(), "unclear_words": unclear[:15],
                         "pronunciation_note_vi": "Nội dung được nhận xét từ bản chép lời. Phát âm: các từ máy chưa nghe rõ được liệt kê để luyện; "
                                                  "không chấm giọng hay ngữ điệu. Dùng “Đọc to” để luyện phát âm từng từ."}
        s.status, s.ended_at = "ended", utcnow()
        P.award(db, user_id, f"speaking:{s.id}", "production", P.XP_RULES["production"])
        db.commit()
        return s

    def public(self, db: Session, s: SpeakingSession) -> dict:
        return {"id": s.id, "mode": s.mode, "mode_label": MODES[s.mode], "topic": s.topic, "level": s.level, "status": s.status,
                "summary": s.summary, "created_at": s.created_at.isoformat(), "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "turns": [{"id": t.id, "role": t.role, "text": t.text, "feedback": t.feedback, "audio_seconds": t.audio_seconds,
                           "audio_url": f"/api/media/{t.audio_file}" if t.audio_file else None, "created_at": t.created_at.isoformat()}
                          for t in self.turns(db, s.id)]}

    def delete(self, db: Session, user_id: int, session_id: str) -> None:
        s = self._owned(db, user_id, session_id)
        for t in self.turns(db, s.id):
            if t.audio_file and t.audio_file.startswith("speaking/"):
                media.delete(t.audio_file)
        db.delete(s)
        db.commit()

    def realtime(self, db: Session, user_id: int, *, mode: str, topic: str, level: str) -> dict:
        instructions = (prompts.SPEAKING + f" You are having a spoken conversation. Mode: {MODES.get(mode, 'Free conversation')}. "
                        f"Level: {level}. Topic: {topic[:200]}. Speak English slowly and clearly for this level, ask one question at a time, "
                        "and after each learner answer give at most one short correction in Vietnamese before continuing in English.")
        return self.gw.realtime_secret(db, user_id, instructions=instructions)
