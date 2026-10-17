"""Adaptive placement test built from the curriculum's own keyed questions.

Grammar and vocabulary use a staircase over CEFR levels (blocks of questions; move up on ≥2/3 correct,
down on ≤1/3); reading uses exam passages with T/F/MC items. Writing is optional and judged by AI;
speaking is reported as "not assessed". Grading of objective items is deterministic — no AI involved.
"""
from __future__ import annotations

import copy
import random
import uuid

from sqlalchemy.orm import Session

from ..content.catalog import LEVELS
from ..content.md import fold, strip_md
from ..content.store import ContentStore
from ..models import LearningProfile, PlacementSession, utcnow
from . import prompts
from .errors import AIBadInput, AIError
from .gateway import AIGateway
from .schemas import PlacementReportOut, WritingLevelEstimate

BLOCK = {"grammar": 3, "vocabulary": 2}
MAX_BLOCKS = {"grammar": 6, "vocabulary": 4}
WRITING_PROMPT = ("Write 50–100 words: describe your daily routine and one thing you did last weekend. "
                  "(Viết 50–100 từ về thói quen hằng ngày và một việc bạn làm cuối tuần trước.)")


class PlacementService:
    def __init__(self, gateway: AIGateway, store: ContentStore):
        self.gw, self.store = gateway, store
        self._banks: dict | None = None
        self._version = -1

    # ---------------------------------------------------------------- banks
    def banks(self) -> dict:
        if self._banks is not None and self._version == self.store.version:
            return self._banks
        grammar: dict[str, list] = {lv: [] for lv in LEVELS}
        vocab: dict[str, list] = {lv: [] for lv in LEVELS}
        reading: dict[str, list] = {lv: [] for lv in LEVELS}
        for u in self.store.unit_list:
            b = self.store.built(u.id)
            for st in b.steps:
                items = [it for it in st.get("items") or [] if it["kind"] in ("mc", "tfng") and b.items[it["id"]].correct_option]
                if not items:
                    continue
                title = fold(st["title"])
                if u.kind == "grammar" and st.get("section") == "L" and st["title"].lower().startswith("level 1"):
                    grammar[u.level] += [it["id"] for it in items if it["kind"] == "mc"]
                elif u.kind == "exam" and u.level in LEVELS and ("vocabulary" in title or "tu vung" in title):
                    vocab[u.level] += [it["id"] for it in items if it["kind"] == "mc"]
                elif u.kind in ("exam", "skills") and u.level in LEVELS and st.get("variant") == "reading" and st.get("passage_md"):
                    reading[u.level].append({"step_id": f"{u.id}:{st['id']}", "items": [it["id"] for it in items][:3]})
        self._banks = {"grammar": grammar, "vocabulary": vocab, "reading": reading}
        self._version = self.store.version
        return self._banks

    def _item_public(self, item_id: str) -> dict:
        unit_id = item_id.split(":", 1)[0]
        b = self.store.built(unit_id)
        for st in b.steps:
            for it in st.get("items") or []:
                if it["id"] == item_id:
                    return {"id": it["id"], "kind": it["kind"], "prompt_md": it["prompt_md"], "instruction_md": it["instruction_md"],
                            "options": it["options"], "passage_md": st.get("passage_md"), "unit_id": unit_id}
        raise AIBadInput("Câu hỏi không tồn tại.")

    def _correct(self, item_id: str, answer: str) -> bool:
        it = self.store.item(item_id)
        return bool(it and it.correct_option and str(answer).strip().lower() == it.correct_option.lower())

    # ---------------------------------------------------------------- session
    def start(self, db: Session, user_id: int, include_writing: bool) -> PlacementSession:
        s = PlacementSession(id=str(uuid.uuid4()), user_id=user_id,
                             state={"section": "grammar", "level_idx": 1, "block": [], "answers": [], "blocks_done": {"grammar": 0, "vocabulary": 0},
                                    "history": {"grammar": [], "vocabulary": []}, "used": [], "include_writing": include_writing,
                                    "reading_queue": [], "writing": None, "seed": random.randint(0, 10**6)})
        db.add(s)
        db.commit()
        return s

    def _pick(self, st: dict, section: str, level: str, n: int) -> list[str]:
        pool = [i for i in self.banks()[section][level] if i not in st["used"]]
        rnd = random.Random(st["seed"] + len(st["used"]))
        rnd.shuffle(pool)
        return pool[:n]

    def current(self, s: PlacementSession) -> dict:
        st = copy.deepcopy(s.state)
        try:
            return self._current(s, st)
        finally:
            if st != s.state and s.finished_at is None and st.get("section") == s.state.get("section"):
                s.state = st  # reassign: JSON columns do not track in-place changes

    def _current(self, s: PlacementSession, st: dict) -> dict:
        if s.finished_at:
            return {"done": True}
        sec = st["section"]
        if sec in ("grammar", "vocabulary"):
            if not st["block"]:
                level = LEVELS[st["level_idx"]]
                st["block"] = self._pick(st, sec, level, BLOCK[sec])
                st["block_level"] = level
                if not st["block"]:
                    return self._advance_section(s)
            item = self._item_public(st["block"][0])
            return {"done": False, "section": sec, "question": item, "progress": self._progress(st)}
        if sec == "reading":
            if not st["reading_queue"]:
                return self._advance_section(s)
            return {"done": False, "section": sec, "question": self._item_public(st["reading_queue"][0]["item"]), "progress": self._progress(st)}
        if sec == "writing":
            return {"done": False, "section": "writing", "question": {"id": "writing", "kind": "long", "prompt_md": WRITING_PROMPT}, "progress": self._progress(st)}
        return {"done": True}

    @staticmethod
    def _progress(st: dict) -> dict:
        return {"answered": len(st["answers"]), "section": st["section"]}

    def answer(self, db: Session, user_id: int, s: PlacementSession, item_id: str, answer: str) -> dict:
        st = copy.deepcopy(s.state)
        sec = st["section"]
        if sec == "writing":
            if item_id != "writing":
                raise AIBadInput("Sai câu hỏi.")
            st["writing"] = answer.strip()[:2000] or None
            st["section"] = "done"
            s.state = st
            db.commit()
            return self.finish(db, user_id, s)
        expected = st["block"][0] if sec in ("grammar", "vocabulary") else (st["reading_queue"][0]["item"] if st["reading_queue"] else None)
        if item_id != expected:
            raise AIBadInput("Câu hỏi không khớp tiến trình bài kiểm tra.")
        ok = self._correct(item_id, answer)
        level = st.get("block_level") if sec != "reading" else st["reading_queue"][0]["level"]
        st["answers"] = st["answers"] + [{"section": sec, "item": item_id, "level": level, "answer": answer, "correct": ok}]
        st["used"] = st["used"] + [item_id]
        if sec == "reading":
            st["reading_queue"] = st["reading_queue"][1:]
        else:
            st["block"] = st["block"][1:]
            if not st["block"]:
                block = [a for a in st["answers"] if a["section"] == sec and a["level"] == level][-BLOCK[sec]:]
                acc = sum(a["correct"] for a in block) / len(block)
                st["history"][sec] = st["history"][sec] + [{"level": level, "accuracy": acc}]
                st["blocks_done"][sec] += 1
                if acc >= 0.66 and st["level_idx"] < len(LEVELS) - 1:
                    st["level_idx"] += 1
                elif acc <= 0.34 and st["level_idx"] > 0:
                    st["level_idx"] -= 1
                hist = st["history"][sec]
                bounced = len(hist) >= 3 and hist[-1]["level"] == hist[-3]["level"]
                if st["blocks_done"][sec] >= MAX_BLOCKS[sec] or bounced:
                    s.state = st
                    self._advance_section(s)
                    st = copy.deepcopy(s.state)
        s.state = st
        out = self.current(s)  # may pick the next block → persist it too
        db.commit()
        return out

    def _estimate(self, st: dict, sec: str) -> str | None:
        hist = st["history"].get(sec) or []
        passed = [LEVELS.index(h["level"]) for h in hist if h["accuracy"] >= 0.66]
        if not hist:
            return None
        if not passed:
            return LEVELS[max(0, min(LEVELS.index(h["level"]) for h in hist) - 1)]
        return LEVELS[max(passed)]

    def _advance_section(self, s: PlacementSession) -> dict:
        st = copy.deepcopy(s.state)
        order = ["grammar", "vocabulary", "reading", "writing", "done"]
        nxt = order[order.index(st["section"]) + 1]
        if nxt == "vocabulary":
            g = self._estimate(st, "grammar") or "A1"
            st["level_idx"] = LEVELS.index(g)
            st["block"] = []
        if nxt == "reading":
            g = self._estimate(st, "grammar") or "A1"
            queue = []
            for lv in (g, LEVELS[min(len(LEVELS) - 1, LEVELS.index(g) + 1)]):
                groups = self.banks()["reading"][lv]
                if groups:
                    grp = random.Random(st["seed"]).choice(groups)
                    queue += [{"item": i, "level": lv} for i in grp["items"][:2]]
            st["reading_queue"] = queue
        if nxt == "writing" and not st.get("include_writing"):
            nxt = "done"
        st["section"] = nxt
        s.state = st
        return self.current(s) if nxt != "done" else {"done": True, "ready_to_finish": True}

    # ---------------------------------------------------------------- result
    def finish(self, db: Session, user_id: int, s: PlacementSession) -> dict:
        if s.result:
            return {"done": True, "result": s.result}
        st = s.state
        if st["section"] != "done":
            raise AIBadInput("Bài kiểm tra chưa xong.")
        grammar, vocab = self._estimate(st, "grammar"), self._estimate(st, "vocabulary")
        rd = [a for a in st["answers"] if a["section"] == "reading"]
        reading = None
        if rd:
            lvls = sorted({a["level"] for a in rd}, key=LEVELS.index)
            ok_levels = [lv for lv in lvls if 2 * sum(a["correct"] for a in rd if a["level"] == lv) >= len([a for a in rd if a["level"] == lv])]
            reading = ok_levels[-1] if ok_levels else LEVELS[max(0, LEVELS.index(lvls[0]) - 1)]
        writing = None
        notes = []
        if st.get("writing"):
            try:
                w = self.gw.structured(db, user_id, feature="placement_writing", task="grading", instructions=prompts.TEACHER,
                                       input=f"Estimate the CEFR level of this short placement writing sample. Prompt: {WRITING_PROMPT}\n"
                                             f"<learner_text>{st['writing']}</learner_text>",
                                       schema=WritingLevelEstimate, max_output_tokens=500)
                writing = {"level": w.level, "rationale_vi": w.rationale_vi}
            except AIError as e:
                notes.append(f"Writing chưa được đánh giá: {e.message_vi}")
        skills = {"grammar": grammar, "vocabulary": vocab, "reading": reading, "writing": writing["level"] if writing else None, "speaking": None}
        known = [lv for lv in (grammar, vocab, reading) if lv]
        overall = LEVELS[min(LEVELS.index(lv) for lv in known)] if known else "A0"
        wrong_units = sorted({a["item"].split(":")[0] for a in st["answers"] if not a["correct"] and a["section"] == "grammar"})
        start_units = [u.id for u in self.store.unit_list if u.kind == "grammar" and u.level == overall][:3]
        candidates = [x for x in wrong_units + start_units if x in self.store.units]
        report = None
        try:
            r = self.gw.structured(db, user_id, feature="placement_report", task="tutor", instructions=prompts.PLACEMENT,
                                   input=f"Skill estimates: {skills}. Overall: {overall}. Answers: "
                                         f"{[(a['section'], a['level'], a['correct']) for a in st['answers']]}. "
                                         f"Lesson list you may recommend: {[(c, self.store.units[c].title) for c in candidates]}.",
                                   schema=PlacementReportOut, max_output_tokens=1500)
            report = r.model_dump()
            report["recommended_lesson_ids"] = [x for x in report["recommended_lesson_ids"] if x in self.store.units][:6] or candidates[:4]
        except AIError as e:
            notes.append(f"Báo cáo AI chưa tạo được ({e.message_vi}); dùng báo cáo tự động.")
        if report is None:
            g_acc = {h["level"]: h["accuracy"] for h in st["history"].get("grammar", [])}
            report = {"estimated_level": overall,
                      "strengths_vi": [f"Ngữ pháp cấp {lv}: {round(a * 100)}% đúng" for lv, a in g_acc.items() if a >= 0.66],
                      "weaknesses_vi": [f"Ngữ pháp cấp {lv}: {round(a * 100)}% đúng" for lv, a in g_acc.items() if a < 0.66],
                      "recommended_lesson_ids": candidates[:4],
                      "study_priorities_vi": [f"Bắt đầu từ cấp {overall}", "Ôn các bài có câu sai trong bài kiểm tra"],
                      "plan_vi": ["Học 1 bài ngữ pháp mỗi ngày theo Lộ trình", "Ôn 10 từ vựng mỗi ngày", "Luyện một bài nghe hoặc đọc ngắn"]}
        result = {"skills": skills, "overall": overall, "writing": writing, "report": report, "notes": notes,
                  "answered": len(st["answers"]), "correct": sum(a["correct"] for a in st["answers"]),
                  "disclaimer_vi": "Kết quả ước lượng để chọn điểm xuất phát, không phải chứng nhận CEFR chính thức. Kỹ năng Nói chưa được đánh giá."}
        s.result, s.finished_at = result, utcnow()
        prof = db.get(LearningProfile, user_id) or LearningProfile(user_id=user_id, preferences={})
        if prof not in db:
            db.add(prof)
        prof.preferences = {**(prof.preferences or {}), "placement": {"level": overall, "date": utcnow().isoformat(), "session_id": s.id}}
        db.commit()
        return {"done": True, "result": result}

    def review(self, s: PlacementSession) -> list[dict]:
        out = []
        for a in s.state.get("answers", []):
            it = self.store.item(a["item"])
            out.append({**a, "prompt": strip_md(self._item_public(a["item"])["prompt_md"])[:200], "correct_option": it.correct_option if it else None})
        return out
