"""Pronunciation check: read a sentence (or a word) aloud → which words a listener would not hear as intended → how to fix.

How errors are found (no AI judgement):
  1. The recording is transcribed WITHOUT any prompt, so the speech model writes what it hears ("I tink dis…"),
     with a confidence for every word.
  2. The transcript is aligned with the reference text:
       ok         heard as the reference word with confidence ≥ CLEAR;
       unclear    heard as the reference word but with low confidence (the sound was ambiguous);
       different  heard as another word (e.g. "tink" for "think");
       missing    not heard at all.
  3. Score = % of reference words heard clearly. This measures intelligibility, not accent; intonation is not scored.
How to fix: dictionary IPA (never AI IPA), built-in tips for sounds Vietnamese speakers often find hard, and an optional AI
explanation of the flagged words only (the AI never decides which words were wrong).
Measured on 2026-10-19 (see settings.DEFAULT_MODELS["pronunciation"]): clean speech → no flags; mispronounced speech → flags.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import PronunciationAttempt, VocabEntry
from ..services import progress as P
from .errors import AIBadInput, AIError
from .gateway import AIGateway

CLEAR = 0.75  # word confidence at or above this counts as clearly heard
ALLOWED_AUDIO = {"audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a"}
EXT = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav",
       "audio/m4a": "m4a", "audio/x-m4a": "m4a"}
SOURCES = {"read_aloud", "conversation", "practice", "word", "lesson", "vocab"}
WORD_RX = re.compile(r"[A-Za-z0-9]+(?:['’][A-Za-z]+)?")  # "well-known" → well, known; "don’t" = "don't"
NUMBERS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight",
           "9": "nine", "10": "ten", "11": "eleven", "12": "twelve", "20": "twenty"}


class WordExplanation(BaseModel):
    word: str
    sound_vi: str      # which sound is the problem, in Vietnamese
    how_vi: str        # mouth/tongue position, in Vietnamese
    practice: list[str]  # 1–3 short English words or phrases to practise the sound (minimal pairs welcome)


class PronunciationExplanation(BaseModel):
    words: list[WordExplanation]
    summary_vi: str


# Sounds that Vietnamese speakers commonly find hard → (matcher on the spelling, tip). Generic and safe: shown with the
# dictionary IPA so the learner can check which applies.
TIPS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"th"), "Âm “th” (/θ/ như think, /ð/ như this): đặt đầu lưỡi giữa hai hàm răng rồi thổi hơi ra. Không đọc thành “t”, “d” hay “th” tiếng Việt."),
    (re.compile(r"(?<!s)s$|es$"), "Âm cuối -s/-es (/s/, /z/, /ɪz/): phát âm rõ tiếng xì hoặc rung nhẹ ở cuối từ, đừng bỏ."),
    (re.compile(r"ed$"), "Đuôi -ed (/t/, /d/, /ɪd/): sau âm vô thanh đọc /t/ (worked), sau âm hữu thanh đọc /d/ (played), sau t/d đọc /ɪd/ (wanted)."),
    (re.compile(r"[ptkbdgfvlmnzx]$|ck$|ct$|st$|nd$|nt$|ld$|lt$"), "Phụ âm cuối: bật rõ âm cuối (không nuốt âm). Ví dụ “like” phải có /k/ ở cuối, “bed” có /d/."),
    (re.compile(r"^(str|spr|scr|spl|pl|pr|bl|br|cl|cr|fl|fr|gl|gr|tr|dr|sl|sm|sn|sp|st|sw|tw)"), "Cụm phụ âm đầu: đọc liền các phụ âm, không chèn nguyên âm (“street” không thành “sơ-trít”)."),
    (re.compile(r"v"), "Âm /v/: răng trên chạm nhẹ môi dưới và rung, khác /b/ (hai môi) và /w/."),
    (re.compile(r"sh|ti(on|al)|ci(al|ous)"), "Âm /ʃ/ (she, nation): tròn môi, lưỡi lùi sau, khác âm “s” và “x” tiếng Việt."),
    (re.compile(r"z|s(?=[aeiou])"), "Âm /z/: giống /s/ nhưng rung dây thanh (đặt tay lên cổ để cảm nhận rung)."),
    (re.compile(r"r"), "Âm /r/ tiếng Anh: cuộn lưỡi về sau, không chạm vòm miệng, không rung lưỡi như “r” tiếng Việt."),
    (re.compile(r"ee|ea|ie"), "Nguyên âm dài /iː/ (see) khác /ɪ/ ngắn (sit): kéo dài và căng môi sang hai bên."),
]


def words_of(text: str) -> list[str]:
    # dotted abbreviations are one word, as recognisers write them: "a.m." → "am", "U.S." → "US"
    text = re.sub(r"\b((?:[A-Za-z]\.){2,})", lambda m: m.group(1).replace(".", "") + " ", text)
    text = re.sub(r"(?<=\d)[:.,](?=\d)", "", text)  # 8:15, 2.5, 1,000 are one token, as the recogniser writes them
    return [m.group(0) for m in WORD_RX.finditer(text)]


def norm(w: str) -> str:
    w = w.lower().replace("’", "'")
    return NUMBERS.get(w, w)


def tips_for(word: str) -> list[str]:
    w = word.lower()
    return [tip for rx, tip in TIPS if rx.search(w)][:2]


def split_heard(heard: list[tuple[str, float]]) -> list[tuple[str, float]]:
    """Recogniser words tokenised exactly like the reference (hyphenated words split, curly apostrophes unified)."""
    return [(part.lower(), p) for w, p in heard for part in words_of(w.replace("’", "'"))]


def align(reference: str, heard: list[tuple[str, float]]) -> list[dict]:
    """Word-by-word comparison of the reference text with what the speech model heard."""
    heard = split_heard(heard)
    ref = words_of(reference)
    a = [norm(w) for w in ref]
    b = [norm(w) for w, _ in heard]
    out: list[dict] = []
    for op, i1, i2, j1, j2 in SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                p = heard[j1 + k][1]
                out.append({"word": ref[i1 + k], "status": "ok" if p >= CLEAR else "unclear", "heard": heard[j1 + k][0],
                            "confidence": p})
        elif op in ("replace", "delete"):
            hw = heard[j1:j2] if op == "replace" else []
            for k in range(i2 - i1):
                if k < len(hw):
                    out.append({"word": ref[i1 + k], "status": "different", "heard": hw[k][0], "confidence": hw[k][1]})
                else:
                    out.append({"word": ref[i1 + k], "status": "missing", "heard": None, "confidence": None})
    return out


def dictionary_ipa(db: Session, word: str) -> str | None:
    """IPA from the lexicon (dictionary sources only)."""
    from ..vocabulary import lexicon

    lexicon.ensure_imported(db)
    for eid in lexicon.find_ids(word.lower())[:1]:
        e = db.get(VocabEntry, eid)
        if e is not None and (e.ipa_uk or e.ipa_us):
            return e.ipa_uk or e.ipa_us
    return None


SUMMARY = {"ok": "Máy nghe rõ hầu hết các từ — phát âm của bạn dễ hiểu.",
           "some": "Một vài từ chưa nghe rõ — luyện lại các từ được đánh dấu rồi đọc lại cả câu.",
           "many": "Nhiều từ chưa nghe rõ — đọc chậm lại, luyện từng từ được đánh dấu trước khi đọc cả câu."}


class PronunciationService:
    def __init__(self, gateway: AIGateway):
        self.gw = gateway

    def explain(self, db: Session, user_id: int, problems: list[dict], level: str = "A1") -> dict | None:
        """Optional AI explanation of the flagged words (cached per set of words and what was heard)."""
        if not problems:
            return None
        lines = "\n".join(f"- {p['word']} (dictionary IPA: {p.get('ipa') or 'n/a'}; heard as: {p.get('heard') or 'nothing'}; status: {p['status']})"
                          for p in problems[:6])
        try:
            out = self.gw.structured(db, user_id, feature="pronunciation_explain", task="tutor",
                                     instructions="You are an English pronunciation coach for Vietnamese learners. The words below were not "
                                     "recognised as intended by a speech recogniser. For each word explain in simple Vietnamese which "
                                     "sound is likely wrong (use the dictionary IPA given; never invent IPA) and how to place the tongue, "
                                     "lips and voice; give 1–3 short English practice items (minimal pairs welcome). Be concise.",
                                     input=f"Learner level: {level}.\n<learner_text>\n{lines}\n</learner_text>",
                                     schema=PronunciationExplanation, max_output_tokens=900, cache=True)
        except AIError:
            return None
        return out.model_dump()

    def assess(self, db: Session, user_id: int, *, audio: bytes, content_type: str, reference: str, source: str = "practice",
               source_ref: str | None = None, seconds: float | None = None, level: str = "A1", explain: bool = True) -> dict:
        reference = (reference or "").strip()
        if not words_of(reference) or len(reference) > 400:
            raise AIBadInput("Câu mẫu không hợp lệ (1–400 ký tự tiếng Anh).")
        if source not in SOURCES:
            raise AIBadInput("Nguồn không hợp lệ.")
        ctype = (content_type or "").split(";")[0].strip().lower()
        if ctype not in ALLOWED_AUDIO:
            raise AIBadInput("Định dạng âm thanh không được hỗ trợ.")
        text, heard, dur = self.gw.transcribe_words(db, user_id, feature="pronunciation", audio=audio, filename=f"read.{EXT[ctype]}",
                                                    duration_hint=seconds)
        if not heard:
            raise AIBadInput("Không nghe được giọng nói. Hãy đọc to, rõ hơn hoặc kiểm tra micro.")
        words = align(reference, heard)
        ok = sum(1 for w in words if w["status"] == "ok")
        score = round(100 * ok / max(1, len(words)))
        for w in words:
            if w["status"] != "ok":
                w["ipa"] = dictionary_ipa(db, w["word"])
                w["tips_vi"] = tips_for(w["word"])
        if db.in_transaction() and db.new | db.dirty:
            db.commit()
        problems = [w for w in words if w["status"] != "ok"]
        explanation = self.explain(db, user_id, problems, level) if explain else None
        if explanation:
            by_word = {x["word"].lower(): x for x in explanation["words"]}
            for w in problems:
                if (x := by_word.get(w["word"].lower())):
                    w["explain"] = {"sound_vi": x["sound_vi"], "how_vi": x["how_vi"], "practice": x["practice"][:3]}
        n = len(words_of(reference))
        wpm = round(len(heard) / (dur / 60)) if dur and dur > 1.5 and n > 2 else None
        prev = db.scalar(select(PronunciationAttempt).where(PronunciationAttempt.user_id == user_id, PronunciationAttempt.reference == reference)
                         .order_by(PronunciationAttempt.id.desc()))
        a = PronunciationAttempt(user_id=user_id, source=source, source_ref=source_ref, reference=reference, heard=text, score=score,
                                 words=[{k: w.get(k) for k in ("word", "status", "heard", "confidence")} for w in words], audio_seconds=dur)
        db.add(a)
        db.flush()
        P.log_study(db, user_id, "speaking-studio", kind="module", items=1, correct=int(score >= 80))
        band = "ok" if score >= 90 else "some" if score >= 60 else "many"
        return {"attempt_id": a.id, "reference": reference, "heard": text, "score": score, "words": words,
                "counts": {s: sum(1 for w in words if w["status"] == s) for s in ("ok", "unclear", "different", "missing")},
                "words_per_minute": wpm, "previous_score": prev.score if prev else None,
                "summary_vi": (explanation or {}).get("summary_vi") or SUMMARY[band],
                "note_vi": "Điểm = tỉ lệ từ máy nghe rõ đúng như câu mẫu (độ dễ hiểu), không chấm giọng địa phương hay ngữ điệu. "
                           "IPA lấy từ từ điển."}

    def summary(self, db: Session, user_id: int, limit: int = 200) -> dict:
        """Recent attempts and the words most often not heard as intended."""
        rows = list(db.scalars(select(PronunciationAttempt).where(PronunciationAttempt.user_id == user_id)
                               .order_by(PronunciationAttempt.id.desc()).limit(limit)))
        counts: dict[str, list[int]] = {}
        for r in rows:
            for w in r.words:
                k = w["word"].lower()
                c = counts.setdefault(k, [0, 0])
                c[0] += 1
                c[1] += w["status"] != "ok"
        hard = sorted(((k, bad, n) for k, (n, bad) in counts.items() if bad), key=lambda x: (-x[1], -x[1] / x[2]))[:12]
        return {"attempts": len(rows), "average_score": round(sum(r.score for r in rows) / len(rows)) if rows else None,
                "recent": [{"id": r.id, "reference": r.reference, "score": r.score, "source": r.source, "created_at": r.created_at.isoformat()}
                           for r in rows[:10]],
                "hard_words": [{"word": k, "missed": bad, "seen": n, "ipa": dictionary_ipa(db, k), "tips_vi": tips_for(k)} for k, bad, n in hard]}
