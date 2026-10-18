"""AI Writing Coach."""
from __future__ import annotations

import re
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..content.md import strip_md
from ..content.store import ContentStore
from ..models import WritingSubmission
from ..services import adaptive
from ..services import progress as P
from . import prompts
from .errors import AIBadInput
from .gateway import AIGateway
from .knowledge import KnowledgeBase
from .schemas import WritingFeedbackOut, WritingPromptOut

TASK_TYPES = {
    "sentence": "Sentence writing", "paragraph": "Paragraph writing", "email": "Email writing", "opinion": "Opinion essay",
    "discussion": "Discussion essay", "problem_solution": "Problem–solution essay", "adv_disadv": "Advantages–disadvantages essay",
    "vstep_task1": "VSTEP-style Writing Task 1 (letter/email, ≥120 words)", "vstep_task2": "VSTEP-style Writing Task 2 (essay, ≥250 words)",
}
MODES = {"minimal": "Minimal correction", "natural": "Natural English", "b2": "B2 upgrade"}


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9'’-]+", text))


def locate_errors(text: str, errors: list[dict]) -> list[dict]:
    """Attach character spans for each quoted error so the UI can highlight it in the learner's own text."""
    low = text.lower()
    cursor = 0
    out = []
    for e in errors:
        frag = (e.get("original") or "").strip()
        span = None
        if frag:
            i = low.find(frag.lower(), cursor)
            if i < 0:
                i = low.find(frag.lower())
            if i >= 0:
                span = [i, i + len(frag)]
                cursor = i + len(frag)
        out.append({**e, "span": span})
    return out


class WritingService:
    def __init__(self, gateway: AIGateway, store: ContentStore, kb: KnowledgeBase):
        self.gw, self.store, self.kb = gateway, store, kb

    def curriculum_prompts(self) -> list[dict]:
        out = []
        for u in self.store.unit_list:
            if u.kind not in ("writing", "exam", "skills"):
                continue
            b = self.store.built(u.id)
            for st in b.steps:
                for it in st.get("items", []) or []:
                    is_writing_step = u.kind == "writing" or "writ" in st["title"].lower() or "viết" in st["title"].lower()
                    if it["kind"] == "long" and is_writing_step and len(strip_md(it["prompt_md"])) > 40:
                        m = re.search(r"(\d{2,3})\s*[–-]\s*(\d{2,3})\s*(từ|words)", it["prompt_md"])
                        out.append({"id": it["id"], "unit_id": u.id, "unit_title": u.title, "level": u.level, "title": st["title"],
                                    "prompt_md": it["prompt_md"][:1500], "word_min": int(m.group(1)) if m else None,
                                    "word_max": int(m.group(2)) if m else None})
        return out[:200]

    def generate_prompt(self, db: Session, user_id: int, *, level: str, task_type: str, topic: str) -> dict:
        if task_type not in TASK_TYPES:
            raise AIBadInput("Dạng bài viết không hợp lệ.")
        res = self.gw.structured(db, user_id, feature="writing_prompt", task="exercise", instructions=prompts.TEACHER,
                                 input=f"Create one writing task. Level: {level}. Task type: {TASK_TYPES[task_type]}. "
                                       f"Topic: <learner_text>{topic[:200] or 'any everyday topic'}</learner_text>. "
                                       "instructions_vi explains the task in Vietnamese; requirements are 3–5 concrete points.",
                                 schema=WritingPromptOut, max_output_tokens=900)
        if res.word_min <= 0 or res.word_max < res.word_min:
            raise AIBadInput("AI tạo đề không hợp lệ, hãy thử lại.")
        return {**res.model_dump(), "task_type": task_type, "level": level, "source": "ai"}

    def evaluate(self, db: Session, user_id: int, *, text: str, prompt: dict, mode: str, task_type: str, level: str,
                 client_submission_id: str, parent_id: int | None) -> WritingSubmission:
        existing = db.scalar(select(WritingSubmission).where(WritingSubmission.user_id == user_id,
                                                             WritingSubmission.client_submission_id == client_submission_id))
        if existing is not None:
            if (existing.text, existing.prompt, existing.mode, existing.task_type, existing.level) != (text, prompt, mode, task_type, level):
                raise AIBadInput("Mã nộp bài đã dùng cho bản viết khác. Hãy tạo lượt nộp mới.")
            return existing
        if mode not in MODES or task_type not in TASK_TYPES:
            raise AIBadInput("Chế độ hoặc dạng bài không hợp lệ.")
        wc = word_count(text)
        if wc < 3:
            raise AIBadInput("Bài viết quá ngắn.")
        if wc > 900:
            raise AIBadInput("Bài viết quá dài (tối đa 900 từ).")
        task = (f"Task type: {TASK_TYPES[task_type]}. Learner level: {level}. Feedback mode: {mode} ({MODES[mode]}).\n"
                f"Task prompt: <learner_text>{strip_md(str(prompt.get('prompt_md') or prompt.get('prompt_en') or ''))[:1500]}</learner_text>\n"
                f"Requirements: {prompt.get('requirements') or ''}; word range: {prompt.get('word_min')}–{prompt.get('word_max')}.")
        if task_type.startswith("vstep"):
            task += "\nThis is a VSTEP-style task: comment on criteria as a practice reference only; never present an official VSTEP score."
        fb = self.gw.structured(db, user_id, feature="writing_evaluate", task="complex_grading", instructions=prompts.WRITING,
                                input=f"{task}\n\n<learner_text>\n{text}\n</learner_text>", schema=WritingFeedbackOut,
                                max_output_tokens=6000)
        data = fb.model_dump()
        data["detected_errors"] = locate_errors(text, data["detected_errors"])
        for c in data["criteria"]:
            c["score"] = max(0.0, min(10.0, float(c["score"])))
        if data.get("estimated_score_10") is not None:
            data["estimated_score_10"] = max(0.0, min(10.0, float(data["estimated_score_10"])))
        data["disclaimer_vi"] = "Điểm và trình độ là đánh giá tham khảo của AI, không phải điểm VSTEP/CEFR chính thức."
        data["practice_lessons"] = self._map_topics(data.get("practice_topics", []))
        from ..vocabulary.service import record_usage  # shared vocabulary progress: studied words used in writing

        data["vocab_used"] = record_usage(db, user_id, text, "writing", [e["original"] for e in data["detected_errors"]])
        sub = WritingSubmission(user_id=user_id, client_submission_id=client_submission_id, prompt=prompt, mode=mode,
                                task_type=task_type, level=level, text=text, word_count=wc, feedback=data, parent_id=parent_id)
        db.add(sub)
        db.flush()
        for i, e in enumerate(data["detected_errors"][:20]):
            adaptive.record_mistake(db, user_id, key=f"writing:{sub.id}:{i}", source_type="writing", source_ref=str(sub.id),
                                    question_text=f"Writing: {strip_md(str(prompt.get('title') or ''))[:150]}",
                                    student_answer=e["original"], corrected_answer=e["correction"], error_type=e["category"],
                                    explanation=e["explanation_vi"], topic_id=(data["practice_lessons"][0]["lesson_id"] if data["practice_lessons"] else None))
        P.award(db, user_id, f"writing:{sub.id}", "production", P.XP_RULES["production"])
        P.activity(db, user_id).items_answered += 1
        P.log_study(db, user_id, "writing-studio", kind="module", items=1)
        db.commit()
        return sub

    def _map_topics(self, topics: list[str]) -> list[dict]:
        out, seen = [], set()
        for t in topics[:5]:
            hits = self.kb.search(t, k=3, modules=("grammar",))
            if hits and hits[0].lesson_id and hits[0].lesson_id not in seen:
                lid = hits[0].lesson_id
                seen.add(lid)
                out.append({"topic": t, "lesson_id": lid, "title": self.store.units[lid].title})
        return out

    @staticmethod
    def public(sub: WritingSubmission) -> dict:
        return {"id": sub.id, "prompt": sub.prompt, "mode": sub.mode, "task_type": sub.task_type, "level": sub.level, "text": sub.text,
                "word_count": sub.word_count, "feedback": sub.feedback, "parent_id": sub.parent_id, "created_at": sub.created_at.isoformat()}

    def stats(self, db: Session, user_id: int) -> dict:
        subs = list(db.scalars(select(WritingSubmission).where(WritingSubmission.user_id == user_id).order_by(WritingSubmission.created_at)))
        cats = Counter()
        timeline = []
        for s in subs:
            errs = s.feedback.get("detected_errors", [])
            cats.update(e["category"] for e in errs)
            timeline.append({"id": s.id, "date": s.created_at.isoformat(), "words": s.word_count, "errors": len(errs),
                             "errors_per_100": round(100 * len(errs) / max(1, s.word_count), 1),
                             "score": s.feedback.get("estimated_score_10"), "level": s.feedback.get("estimated_level")})
        return {"submissions": len(subs), "error_categories": dict(cats.most_common()), "timeline": timeline}
