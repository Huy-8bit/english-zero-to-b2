"""AI grammar tutor: context-aware answers grounded in the current lesson and retrieved curriculum."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..content.md import strip_md
from ..content.store import ContentStore
from ..models import Attempt, FeedbackMessage, LessonProgress, MistakeRecord, TutorConversation, TutorMessage, utcnow
from ..services.progress import latest_attempts
from . import prompts
from .errors import AIBadInput
from .gateway import AIGateway
from .knowledge import KnowledgeBase, format_chunks

QUICK = {
    "explain_simply": "Giải thích lại nội dung slide này thật dễ hiểu.",
    "more_examples": "Cho tôi thêm 4 ví dụ tự nhiên (kèm nghĩa tiếng Việt) về cấu trúc trong slide này.",
    "compare": "So sánh cấu trúc này với cấu trúc dễ nhầm nhất với nó (công thức, cách dùng, ví dụ).",
    "why": "Tại sao lại dùng cấu trúc này? Giải thích bản chất/lý do.",
    "common_mistakes": "Người Việt hay mắc lỗi gì với cấu trúc này? Cho câu sai → câu đúng và cách tránh.",
    "explain_mistake": "Giải thích câu tôi vừa làm sai.",
    "chat": "",
}
CACHEABLE = {"explain_simply", "more_examples", "compare", "why", "common_mistakes"}


class TutorService:
    def __init__(self, gateway: AIGateway, store: ContentStore, kb: KnowledgeBase):
        self.gw, self.store, self.kb = gateway, store, kb

    def _context(self, db: Session, user_id: int, unit_id: str, step_index: int | None, item_id: str | None,
                 question: str, personal: bool) -> tuple[str, list[dict]]:
        b = self.store.built(unit_id)
        if b is None:
            raise AIBadInput("Không tìm thấy bài học.")
        u = b.unit
        parts = [f"Lesson: {u.id} — {u.title} ({u.title_vi}); CEFR level: {u.level or '-'}; module: {u.kind}"]
        prereq = [f"{p} — {self.store.units[p].title}" for p in u.prerequisites if p in self.store.units]
        if prereq:
            parts.append("Prerequisites: " + "; ".join(prereq))
        step = b.steps[step_index] if step_index is not None and 0 <= step_index < len(b.steps) else None
        if step:
            body = step.get("md") or ""
            for ex in step.get("examples", [])[:10]:
                body += f"\n- {strip_md(ex['en'])} — {strip_md(ex['vi'])}"
            for m in step.get("mistakes", [])[:8]:
                body += f"\n- ❌ {strip_md(m['wrong'])} → ✅ {strip_md(m['right'])}"
            parts.append(f'<curriculum source="{u.path}" section="current slide: {step["title"]}">\n{body[:5000]}\n</curriculum>')
            submitted = latest_attempts(db, user_id, unit_id) if personal else {}
            for it in step.get("items", [])[:20]:
                att = submitted.get(it["id"])
                line = f"Exercise {it['label']}: {strip_md(it['prompt_md'])[:200]}"
                if att is not None:
                    line += f" | learner answered {att.response[:120]!r} ({att.verdict}); key: {strip_md(b.items[it['id']].model_md)[:200]}"
                else:
                    line += " | not submitted — do not reveal the answer"
                parts.append(line)
        if item_id and personal:
            att = latest_attempts(db, user_id, unit_id).get(item_id)
            it = b.items.get(item_id)
            if att is None or it is None:
                raise AIBadInput("Hãy nộp câu trả lời trước khi hỏi vì sao sai.")
            parts.append(f"The learner's answer to exercise {it.label}: <learner_answer>{att.response[:500]}</learner_answer>; "
                         f"curriculum key: {strip_md(it.model_md)[:400]}; explanation: {strip_md(it.explanation_md)[:300]}")
        if personal:
            done = list(db.scalars(select(LessonProgress.unit_id).where(LessonProgress.user_id == user_id, LessonProgress.completed_at.is_not(None))))
            same_level = [d for d in done if d in self.store.units and self.store.units[d].level == u.level][:15]
            if same_level:
                parts.append("Lessons the learner has completed at this level: " + ", ".join(same_level))
            mistakes = list(db.scalars(select(MistakeRecord).where(MistakeRecord.user_id == user_id, MistakeRecord.topic_id == unit_id,
                                                                   MistakeRecord.review_status != "mastered").limit(4)))
            for m in mistakes:
                parts.append(f"Recent learner mistake: <learner_answer>{m.student_answer[:120]}</learner_answer> → {m.corrected_answer[:120]} ({m.error_type})")
        chunks = self.kb.search(f"{u.title} {question}", lesson_id=unit_id, k=3)
        chunks = [c for c in chunks if not (step and c.lesson_id == unit_id and c.section_title in step.get("title", ""))]
        parts.append(format_chunks(chunks))
        sources = [c.meta() for c in chunks]
        return "\n\n".join(parts), sources

    def conversation(self, db: Session, user_id: int, unit_id: str | None) -> TutorConversation:
        conv = db.scalars(select(TutorConversation).where(TutorConversation.user_id == user_id, TutorConversation.unit_id == unit_id)
                          .order_by(TutorConversation.id.desc()).limit(1)).first()
        if conv is None:
            conv = TutorConversation(user_id=user_id, unit_id=unit_id)
            db.add(conv)
            db.flush()
        return conv

    def ask(self, db: Session, user_id: int, *, unit_id: str, action: str, message: str, step_index: int | None,
            item_id: str | None) -> dict:
        if action not in QUICK:
            raise AIBadInput("Hành động không hợp lệ.")
        question = (QUICK[action] + ("\n" + message if message else "")).strip()
        if not question:
            raise AIBadInput("Hãy nhập câu hỏi.")
        personal = action not in CACHEABLE or bool(message)
        context, sources = self._context(db, user_id, unit_id, step_index, item_id if action == "explain_mistake" else None,
                                         question, personal)
        conv = self.conversation(db, user_id, unit_id)
        history = []
        if action == "chat":
            prev = list(db.scalars(select(TutorMessage).where(TutorMessage.conversation_id == conv.id).order_by(TutorMessage.id.desc()).limit(6)))
            history = [f"{m.role}: {m.content[:600]}" for m in reversed(prev)]
        user_input = context + ("\n\nEarlier conversation:\n" + "\n".join(history) if history else "") + \
            f"\n\nLearner's request:\n<learner_text>{question[:2000]}</learner_text>"
        answer = self.gw.text(db, user_id, feature=f"tutor_{action}", task="tutor", instructions=prompts.TUTOR, input=user_input,
                              max_output_tokens=900, cache=not personal)
        db.add(TutorMessage(conversation_id=conv.id, role="user", action=action, content=question[:4000], step_index=step_index))
        db.add(TutorMessage(conversation_id=conv.id, role="assistant", action=action, content=answer, step_index=step_index, sources=sources))
        conv.updated_at = utcnow()
        db.commit()
        return {"answer": answer, "sources": [{"lesson_id": s["lesson_id"], "section_title": s["section_title"], "source_path": s["source_path"]} for s in sources],
                "conversation_id": conv.id}

    def history(self, db: Session, user_id: int, unit_id: str) -> list[dict]:
        conv = db.scalars(select(TutorConversation).where(TutorConversation.user_id == user_id, TutorConversation.unit_id == unit_id)
                          .order_by(TutorConversation.id.desc()).limit(1)).first()
        if conv is None:
            return []
        return [{"role": m.role, "action": m.action, "content": m.content, "created_at": m.created_at.isoformat(), "sources": m.sources}
                for m in db.scalars(select(TutorMessage).where(TutorMessage.conversation_id == conv.id).order_by(TutorMessage.id))]

    # -------------------------------------------------------- follow-ups on a specific question
    def follow_up(self, db: Session, user_id: int, *, target_type: str, target_id: str, action: str, context: str) -> dict:
        prompts_vi = {
            "why_wrong": "Vì sao câu trả lời của tôi sai? Chỉ ra đúng chỗ sai và quy tắc.",
            "explain_again": "Giải thích lại theo cách khác, đơn giản hơn.",
            "another_example": "Cho tôi 3 ví dụ khác dùng đúng quy tắc này.",
        }
        if action not in prompts_vi:
            raise AIBadInput("Hành động không hợp lệ.")
        text = self.gw.text(db, user_id, feature=f"feedback_{action}", task="tutor", instructions=prompts.TUTOR,
                            input=f"{context}\n\n<learner_text>{prompts_vi[action]}</learner_text>", max_output_tokens=700)
        msg = FeedbackMessage(user_id=user_id, target_type=target_type, target_id=target_id, action=action, content=text)
        db.add(msg)
        db.commit()
        return {"id": msg.id, "action": action, "content": text, "created_at": msg.created_at.isoformat()}


def attempt_owned(db: Session, user_id: int, attempt_id: int) -> Attempt:
    a = db.get(Attempt, attempt_id)
    if a is None or a.user_id != user_id:
        raise AIBadInput("Không tìm thấy câu trả lời.")
    return a
