"""AI features of the vocabulary module. Every call goes through AIGateway (limits, rate limiting, caching, usage logs).

Never used for: flipping cards, next word, showing stored meanings, cached audio, multiple-choice grading, loading
vocabulary, scheduling. If AI is unavailable, all stored vocabulary and spaced repetition keep working.
"""
from __future__ import annotations

import json
import re
import uuid

from sqlalchemy.orm import Session

from ..ai.errors import AIBadInput, AIInvalidOutput
from ..ai.gateway import AIGateway
from ..ai.knowledge import KnowledgeBase, format_chunks
from ..ai.prompts import DATA_RULE, TEACHER
from ..models import VocabDialogue, utcnow
from .ai_schemas import (VocabAnswerJudge, VocabContextMeaning, VocabDialogueTurn, VocabEnrichmentBatch, VocabExerciseSet,
                         VocabSentenceGrade)
from .grading import clean, contains_word

VOCAB_TEACHER = TEACHER + (
    " You specialise in vocabulary. Distinguish true synonyms from near-synonyms; mention register (formal/informal), "
    "common collocations, typical grammar patterns and prepositions; point out mistakes Vietnamese learners typically make. "
    "Use only the dictionary data given as the source for meanings and pronunciation; do not invent IPA. "
)

TUTOR_ACTIONS = {
    "explain": "Giải thích từ này: nghĩa chính (theo dữ liệu), cách dùng, ví dụ đơn giản.",
    "examples": "Cho thêm 4 ví dụ tự nhiên ở nhiều ngữ cảnh khác nhau (kèm nghĩa tiếng Việt), từ dễ đến khó.",
    "difference": "Phân biệt từ này với từ được so sánh: nghĩa, sắc thái, ví dụ đối chiếu, cụm thường gặp, khi nào thay thế được/không tự nhiên, rồi cho 1 bài tập ngắn (không kèm đáp án ngay).",
    "pronounce": "Hướng dẫn phát âm dựa trên IPA đã cho (không tự tạo IPA khác): trọng âm, âm khó với người Việt, mẹo luyện.",
    "formality": "Từ này trang trọng hay thân mật? Dùng trong ngữ cảnh nào, từ thay thế ở mức trang trọng khác.",
    "writing": "Có nên dùng từ này trong bài viết (VSTEP/học thuật) không? Cho ví dụ câu viết tốt và lỗi cần tránh.",
    "collocations": "Liệt kê các collocation thông dụng nhất với từ này, mỗi cụm một ví dụ và nghĩa.",
    "quiz": "Đố tôi 3 câu ngắn về từ này (nghĩa, collocation, dùng trong câu). Chỉ đưa câu hỏi, chưa đưa đáp án.",
    "remember": "Giúp tôi nhớ từ này: mẹo liên tưởng ngắn, cụm từ gắn với tình huống thật, và 1 câu để tự luyện.",
}

SITUATIONS = {
    "daily": "a friendly daily conversation", "job_interview": "a job interview (you are the interviewer)",
    "travel": "travelling: hotel, airport, asking for directions", "workplace": "a workplace discussion with a colleague",
    "technology": "talking about technology and apps", "goals": "talking about personal goals and plans",
}


def entry_context(d: dict) -> str:
    """Compact dictionary data for one entry (never the whole database)."""
    keep = {"lemma": d["lemma"], "pos": d.get("pos"), "level_estimate": d.get("cefr"), "ipa_uk": d.get("ipa_uk"), "ipa_us": d.get("ipa_us"),
            "senses": [{"pos": s["pos"], "meaning_vi": s["meaning_vi"], "definition_en": s.get("definition_en"), "usage": s.get("usage")}
                       for s in d.get("senses", [])[:4]],
            "examples": [x["en"] for x in d.get("examples", [])[:3]],
            "collocations": [c["phrase"] for c in d.get("collocations", [])[:6]],
            "word_family": [f["word"] for f in d.get("family", [])[:6]],
            "confused_with": [{"words": c.get("words"), "note_vi": c.get("note_vi")} for c in d.get("confused_with", [])[:2]],
            "common_mistakes": d.get("common_mistakes", [])[:2]}
    return json.dumps(keep, ensure_ascii=False)


class VocabAI:
    def __init__(self, gateway: AIGateway, kb: KnowledgeBase):
        self.gw, self.kb = gateway, kb

    # ------------------------------------------------------------ tutor
    def tutor(self, db: Session, user_id: int, *, entry: dict, action: str, question: str = "", compare: dict | None = None) -> dict:
        if action not in TUTOR_ACTIONS and action != "chat":
            raise AIBadInput("Yêu cầu không hợp lệ.")
        if action == "chat" and not question.strip():
            raise AIBadInput("Hãy nhập câu hỏi.")
        if action == "difference" and compare is None:
            raise AIBadInput("Hãy chọn từ cần so sánh.")
        chunks = self.kb.search(entry["lemma"], k=2)
        ctx = f"<dictionary_entry>{entry_context(entry)}</dictionary_entry>"
        if compare:
            ctx += f"\n<compare_entry>{entry_context(compare)}</compare_entry>"
        if chunks:
            ctx += "\n" + format_chunks(chunks)
        ask = TUTOR_ACTIONS.get(action, "")
        text = self.gw.text(db, user_id, feature="vocab_tutor", task="tutor",
                            instructions=VOCAB_TEACHER + " Answer in Vietnamese with English examples. Markdown, under about 250 words.",
                            input=f"{ctx}\n<learner_text>{(ask + ' ' + question).strip()[:1200]}</learner_text>",
                            max_output_tokens=900, cache=action != "chat")
        return {"answer": text, "sources": [c.meta() for c in chunks]}

    # ------------------------------------------------------------ grading
    def judge_answer(self, db: Session, user_id: int, *, prompt_vi: str, expected: str, answer: str) -> VocabAnswerJudge:
        """Second layer for phrase answers the deterministic grader rejected: is it a valid alternative?"""
        return self.gw.structured(db, user_id, feature="vocab_judge", task="grading",
                                  instructions=VOCAB_TEACHER + " Decide whether the learner's English answer correctly expresses the Vietnamese prompt. "
                                  "Accept valid alternatives and synonyms that a teacher would accept; reject wrong meaning. Explain in Vietnamese.",
                                  input=f"<curriculum>Vietnamese prompt: {prompt_vi}\nReference answer: {expected}</curriculum>\n"
                                        f"<learner_answer>{answer[:200]}</learner_answer>",
                                  schema=VocabAnswerJudge, max_output_tokens=400, cache=True)

    def grade_sentence(self, db: Session, user_id: int, *, entry: dict, sentence: str) -> dict:
        s = sentence.strip()
        if len(s.split()) < 3 or len(s) > 400:
            raise AIBadInput("Câu cần ít nhất 3 từ và không quá 400 ký tự.")
        forms = [entry["lemma"], *entry.get("forms", []), *entry.get("variants", [])]
        if not contains_word(s, forms):  # deterministic check first, no AI call
            return {"verdict": "missing_word", "uses_target": False, "explanation_vi": f"Câu chưa dùng từ “{entry['lemma']}” (hoặc dạng của nó).",
                    "issues": [], "corrected_sentence": "", "better_example": "", "ai": False}
        g = self.gw.structured(db, user_id, feature="vocab_use_it", task="grading",
                               instructions=VOCAB_TEACHER + " Grade a sentence the learner wrote with the target word. Check grammar, "
                               "whether the target word is used with the right meaning and collocation, naturalness and clarity. "
                               "A valid sentence must not be marked wrong just because it differs from the examples. "
                               "Explain mistakes in Vietnamese. corrected_sentence keeps the learner's idea.",
                               input=f"<dictionary_entry>{entry_context(entry)}</dictionary_entry>\n<learner_text>{s}</learner_text>",
                               schema=VocabSentenceGrade, max_output_tokens=700, cache=True)
        return g.model_dump() | {"ai": True}

    # ------------------------------------------------------------ lookup in context
    def context_meaning(self, db: Session, user_id: int, *, word: str, sentence: str, entry: dict | None) -> dict:
        data = f"<dictionary_entry>{entry_context(entry)}</dictionary_entry>" if entry else "<dictionary_entry>none</dictionary_entry>"
        r = self.gw.structured(db, user_id, feature="vocab_lookup", task="tutor",
                               instructions=VOCAB_TEACHER + " Give the meaning of the word as used in this sentence. If a dictionary sense "
                               "fits, return its index (0-based) and keep its meaning; otherwise sense_index -1 and a short Vietnamese meaning.",
                               input=f"{data}\n<passage>{sentence[:600]}</passage>\n<learner_text>{word[:60]}</learner_text>",
                               schema=VocabContextMeaning, max_output_tokens=300, cache=True)
        return r.model_dump()

    # ------------------------------------------------------------ personalised exercises
    def exercises(self, db: Session, user_id: int, *, targets: list[dict], level: str, confusions: list[str]) -> list[dict]:
        r = self.gw.structured(db, user_id, feature="vocab_exercises", task="exercise",
                               instructions=VOCAB_TEACHER + " Write short contextual vocabulary exercises for the target words: cloze sentences "
                               "with exactly one blank written _____, collocation gaps, and discrimination items for confusable words. "
                               "Exactly one option must be correct; options are single words or short phrases; sentence_vi translates the "
                               "full sentence; explanation_vi says why the answer fits and why the others do not.",
                               input=f"<curriculum>Level: {level}\nTarget words: {json.dumps([entry_context(t) for t in targets], ensure_ascii=False)}\n"
                                     f"Words the learner confuses: {', '.join(confusions) or 'none'}</curriculum>",
                               schema=VocabExerciseSet, max_output_tokens=2500)
        ok, rejected = [], []
        by_lemma = {t["lemma"].lower(): t for t in targets}
        for it in r.items:
            reason = validate_exercise(it, by_lemma)
            if reason:
                rejected.append(reason)
                continue
            ok.append({"type": it.type, "entry_id": by_lemma[it.target_word.lower()]["id"], "sentence": it.sentence, "sentence_vi": it.sentence_vi,
                       "options": it.options, "answer": it.answer_index, "explanation_vi": it.explanation_vi})
        if not ok:
            raise AIInvalidOutput(f"all generated items rejected: {rejected[:3]}")
        return ok

    # ------------------------------------------------------------ dialogue
    def dialogue_start(self, db: Session, user_id: int, *, situation: str, entries: list[dict]) -> VocabDialogue:
        if situation not in SITUATIONS:
            raise AIBadInput("Tình huống không hợp lệ.")
        d = VocabDialogue(id=str(uuid.uuid4()), user_id=user_id, situation=situation, entry_ids=[e["id"] for e in entries], turns=[], used={})
        turn = self._dialogue_turn(db, user_id, d, entries, learner=None)
        d.turns = [{"role": "ai", "text": turn.reply_en, "hint_vi": turn.hint_vi}]
        db.add(d)
        return d

    def dialogue_reply(self, db: Session, user_id: int, d: VocabDialogue, entries: list[dict], text: str) -> dict:
        text = text.strip()
        if not text or len(text) > 600:
            raise AIBadInput("Câu trả lời trống hoặc quá dài.")
        turn = self._dialogue_turn(db, user_id, d, entries, learner=text)
        used_det = [e["lemma"] for e in entries if contains_word(text, [e["lemma"], *e.get("forms", []), *e.get("variants", [])])]
        used = dict(d.used or {})
        for w in used_det:
            used[w] = used.get(w, 0) + 1
        d.used = used
        d.turns = [*d.turns, {"role": "user", "text": text, "used": used_det,
                              "corrections": [c.model_dump() for c in turn.corrections], "feedback_vi": turn.feedback_vi},
                   {"role": "ai", "text": turn.reply_en, "hint_vi": turn.hint_vi}]
        if turn.should_end or len(d.turns) >= 21:
            d.status = "finished"
        return {"turn": d.turns[-2], "reply": d.turns[-1], "used": used, "status": d.status, "used_now": used_det}

    def _dialogue_turn(self, db, user_id, d: VocabDialogue, entries: list[dict], learner: str | None) -> VocabDialogueTurn:
        history = "\n".join(f"{t['role']}: {t['text']}" for t in (d.turns or [])[-10:])
        targets = ", ".join(e["lemma"] for e in entries)
        return self.gw.structured(db, user_id, feature="vocab_dialogue", task="tutor",
                                  instructions=VOCAB_TEACHER + f" Role-play {SITUATIONS[d.situation]} in simple natural English. "
                                  "Ask one question per turn that gives the learner a natural chance to use the target words (do not "
                                  "force them). Give a short Vietnamese hint. When the learner answers, list target words they used "
                                  "correctly and up to 2 important corrections with Vietnamese explanations.",
                                  input=f"<curriculum>Target words: {targets}</curriculum>\n<passage>{history}</passage>\n"
                                        f"<learner_text>{learner or '(start the conversation)'}</learner_text>",
                                  schema=VocabDialogueTurn, max_output_tokens=600)

    # ------------------------------------------------------------ enrichment (pipeline stage "Generate")
    def enrich(self, db: Session, user_id: int, *, items: list[dict]) -> VocabEnrichmentBatch:
        data = [{"lemma": i["lemma"], "pos_hint": i.get("pos"), "level_hint": i.get("cefr"), "dictionary_glosses": i.get("glosses", [])[:3]}
                for i in items]
        return self.gw.structured(db, user_id, feature="vocab_enrich", task="exercise",
                                  instructions=VOCAB_TEACHER + " For each English headword give: whether it is a real, correctly spelled English "
                                  "word; 1–3 most common senses (part of speech, accurate Vietnamese meaning, simple English definition); a "
                                  "CEFR estimate; 2 natural example sentences with Vietnamese translations; up to 4 common collocations; "
                                  "word family members; a short usage note and a common mistake of Vietnamese learners (Vietnamese). "
                                  "Do NOT provide pronunciation. Prefer meanings consistent with the dictionary glosses.",
                                  input=f"<curriculum>{json.dumps(data, ensure_ascii=False)}</curriculum>",
                                  schema=VocabEnrichmentBatch, max_output_tokens=900 * max(1, len(items)))


def validate_exercise(it, by_lemma: dict) -> str | None:
    if it.target_word.lower() not in by_lemma:
        return "unknown target"
    if it.sentence.count("_____") != 1:
        return "sentence must have exactly one blank"
    opts = [clean(o) for o in it.options]
    if not 3 <= len(opts) <= 5 or len(set(opts)) != len(opts) or any(not o for o in opts):
        return "need 3–5 distinct options"
    if not 0 <= it.answer_index < len(opts):
        return "answer index out of range"
    if not re.search(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", it.explanation_vi.lower()):
        return "explanation must be Vietnamese"
    return None


def validate_enrichment(e, *, lemma: str) -> list[str]:
    problems = []
    if clean(e.lemma) != clean(lemma):
        problems.append("lemma_mismatch")
    if not e.exists:
        problems.append("model_says_not_a_word")
    if not e.senses or any(not s.meaning_vi.strip() for s in e.senses):
        problems.append("no_meaning")
    vi_rx = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]")
    if e.senses and not any(vi_rx.search(s.meaning_vi.lower()) or len(s.meaning_vi.split()) <= 3 for s in e.senses):
        problems.append("meaning_not_vietnamese")
    forms = [lemma]
    bad_ex = [x for x in e.examples if not contains_word(x.en, forms + [lemma + "s", lemma + "ed", lemma + "ing", lemma + "es", lemma + "d"])]
    if len(bad_ex) == len(e.examples):
        problems.append("examples_missing_word")
    return problems


def now_iso() -> str:
    return utcnow().isoformat()
