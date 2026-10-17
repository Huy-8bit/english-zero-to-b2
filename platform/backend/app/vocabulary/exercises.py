"""Deterministic exercise items built from the lexicon (no AI calls).

Every item has a public part (sent to the browser) and a private part (answer key; stays in vocab_sessions.items).
Distractors come from real lexicon entries of the same part of speech and a similar level; collocation distractors are
rejected when they would also form a known collocation (e.g. "have a shower" vs "take a shower").
"""
from __future__ import annotations

import random
import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import VocabCollocation, VocabEntry, VocabExample, VocabSense
from .grading import alternatives, clean
from .topics import POS_VI

VERB_POOL = ["make", "do", "take", "have", "get", "give", "pay", "keep", "catch", "break", "raise", "reach", "meet", "set",
             "run", "spend", "save", "lose", "miss", "tell", "say", "go", "put", "bring"]
ADJ_POOL = ["heavy", "strong", "high", "low", "big", "serious", "great", "deep", "hard", "fast", "light", "full", "huge", "wide"]
ADV_POOL = ["highly", "deeply", "bitterly", "fully", "completely", "widely", "strongly", "seriously", "badly", "firmly"]
SCHEDULING_TYPES = {"flashcard", "mc_meaning", "mc_word", "type_word", "dictation", "cloze", "collocation", "builder",
                    "confusable", "listen_choose", "use_it"}
RECALL_TYPES = {"flashcard", "type_word", "dictation", "use_it"}  # production / recall evidence (vs. recognition)


class Bundle:
    """An entry with its senses/examples/collocations, loaded once per session build."""

    def __init__(self, e: VocabEntry, senses: list[VocabSense], examples: list[VocabExample], colls: list[VocabCollocation]):
        self.e, self.senses, self.examples, self.colls = e, senses, examples, colls

    @property
    def meaning(self) -> str:
        return self.senses[0].meaning_vi if self.senses else ""

    @property
    def pos(self) -> str:
        return (self.senses[0].pos if self.senses and self.senses[0].pos else (self.e.pos[0] if self.e.pos else "")) or ""

    @property
    def forms(self) -> list[str]:
        return [f for f in dict.fromkeys([self.e.lemma, self.e.headword, *self.e.variants, *self.e.forms]) if f]

    def word_forms_regex(self):
        fs = sorted({f for f in self.forms if f and len(f) <= 40 and "(" not in f and "/" not in f}, key=len, reverse=True)
        if not fs:
            return None
        return re.compile(r"(?<![A-Za-z'])(" + "|".join(re.escape(f) for f in fs) + r")(?![A-Za-z'])", re.I)


def load_bundles(db: Session, ids: list[str]) -> dict[str, Bundle]:
    if not ids:
        return {}
    entries = {e.id: e for e in db.scalars(select(VocabEntry).where(VocabEntry.id.in_(ids)))}
    senses: dict[str, list] = {}
    for s in db.scalars(select(VocabSense).where(VocabSense.entry_id.in_(ids), VocabSense.status != "rejected").order_by(VocabSense.idx)):
        senses.setdefault(s.entry_id, []).append(s)
    examples: dict[str, list] = {}
    for x in db.scalars(select(VocabExample).where(VocabExample.entry_id.in_(ids), VocabExample.status.in_(("curriculum", "sourced", "reviewed"))).order_by(VocabExample.idx)):
        examples.setdefault(x.entry_id, []).append(x)
    colls: dict[str, list] = {}
    for c in db.scalars(select(VocabCollocation).where(VocabCollocation.entry_id.in_(ids), VocabCollocation.status != "rejected")):
        colls.setdefault(c.entry_id, []).append(c)
    return {i: Bundle(entries[i], senses.get(i, []), examples.get(i, []), colls.get(i, [])) for i in ids if i in entries}


class DistractorPool:
    def __init__(self, db: Session, levels: list[str], exclude: set[str], seed: int):
        self.rng = random.Random(seed)
        rows = db.execute(select(VocabEntry.id, VocabEntry.lemma, VocabEntry.cefr, VocabEntry.pos, VocabSense.meaning_vi)
                          .join(VocabSense, (VocabSense.entry_id == VocabEntry.id) & (VocabSense.idx == 0))
                          .where(VocabEntry.published.is_(True), VocabEntry.owner_user_id.is_(None), VocabEntry.kind == "word",
                                 VocabEntry.cefr.in_(levels))).all()
        self.rows = [r for r in rows if r.id not in exclude and " " not in r.lemma]
        self.known_collocations: set[str] = set()

    def pick(self, b: Bundle, n: int = 3, *, field: str = "lemma") -> list[tuple[str, str, str]]:
        """→ [(entry_id, lemma, meaning)] of the same part of speech with distinct meanings."""
        pos = b.pos
        target_meaning = clean(b.meaning)
        avoid = {clean(f) for f in b.forms} | {clean(x) for x in b.e.synonyms + b.e.family}
        cands = [r for r in self.rows if (pos in (r.pos or []) if pos else True) and clean(r.lemma) not in avoid
                 and clean(r.meaning_vi) != target_meaning and not (set(clean(r.meaning_vi).split("; ")) & set(target_meaning.split("; ")))]
        if len(cands) < n:
            cands = [r for r in self.rows if clean(r.lemma) not in avoid and clean(r.meaning_vi) != target_meaning]
        picks, seen = [], {target_meaning}
        self.rng.shuffle(cands)
        for r in cands:
            key = clean(r.meaning_vi) if field == "meaning" else clean(r.lemma)
            if key in seen:
                continue
            seen.add(key)
            picks.append((r.id, r.lemma, r.meaning_vi))
            if len(picks) == n:
                break
        return picks


def _id() -> str:
    return uuid.uuid4().hex[:10]


def short_meaning(m: str, limit: int = 70) -> str:
    return m if len(m) <= limit else m[:limit].rsplit(";", 1)[0]


def pick_example(b: Bundle, *, prefer_short: bool, need_word: bool = True, max_words: int = 14):
    rx = b.word_forms_regex()
    exs = [x for x in b.examples if x.en and (not need_word or (rx and rx.search(x.en)))]
    exs = [x for x in exs if len(x.en.split()) <= max_words] or exs
    if not exs:
        return None
    if prefer_short:
        exs = sorted(exs, key=lambda x: (len(x.en.split()), x.vi is None))
    else:
        exs = sorted(exs, key=lambda x: (x.vi is None, abs(len(x.en.split()) - 9)))
    return exs[0]


def entry_public(b: Bundle, *, prefer_short: bool = False) -> dict:
    ex = pick_example(b, prefer_short=prefer_short, need_word=False)
    s0 = b.senses[0] if b.senses else None
    return {"entry_id": b.e.id, "word": b.e.headword or b.e.lemma, "lemma": b.e.lemma, "kind": b.e.kind, "cefr": b.e.cefr,
            "pos": b.pos, "pos_vi": POS_VI.get(b.pos, b.pos), "ipa_uk": b.e.ipa_uk, "ipa_us": b.e.ipa_us,
            "meaning_vi": b.meaning, "definition_en": s0.definition_en if s0 else None,
            "senses": [{"pos_vi": POS_VI.get(s.pos or "", s.pos), "meaning_vi": s.meaning_vi, "usage": s.usage} for s in b.senses[:3]],
            "usage": list(dict.fromkeys(u for s in b.senses[:2] for u in (s.usage or []))),
            "example": {"en": ex.en, "vi": ex.vi} if ex else None,
            "collocations": [c.phrase for c in b.colls[:4]], "family": b.e.family[:4],
            "mistake": b.e.mistakes[0] if b.e.mistakes else None,
            "confused": b.e.confused_with[0] if b.e.confused_with else None}


# ------------------------------------------------------------------ item builders
def learn(b: Bundle, *, prefer_short: bool) -> dict:
    return {"id": _id(), "type": "learn", "entry_id": b.e.id, "public": entry_public(b, prefer_short=prefer_short), "private": {}}


def flashcard(b: Bundle, *, prefer_short: bool) -> dict:
    pub = entry_public(b, prefer_short=prefer_short)
    ex = pick_example(b, prefer_short=prefer_short)
    context = None
    if ex and (rx := b.word_forms_regex()):
        context = rx.sub(lambda m: m.group(0), ex.en)  # optional context sentence on the front (word visible by design)
    return {"id": _id(), "type": "flashcard", "entry_id": b.e.id, "public": {**pub, "context": context}, "private": {}}


def mc_meaning(b: Bundle, pool: DistractorPool) -> dict | None:
    ds = pool.pick(b, 3, field="meaning")
    if len(ds) < 2:
        return None
    opts = [(b.e.id, short_meaning(b.meaning))] + [(d[0], short_meaning(d[2])) for d in ds]
    pool.rng.shuffle(opts)
    return {"id": _id(), "type": "mc_meaning", "entry_id": b.e.id,
            "public": {"word": b.e.headword or b.e.lemma, "ipa_uk": b.e.ipa_uk, "pos_vi": POS_VI.get(b.pos, b.pos),
                       "options": [o[1] for o in opts], "prompt_vi": "Chọn nghĩa đúng"},
            "private": {"answer": [o[0] for o in opts].index(b.e.id), "option_entries": [o[0] for o in opts]}}


def mc_word(b: Bundle, pool: DistractorPool) -> dict | None:
    ds = pool.pick(b, 3)
    if len(ds) < 2:
        return None
    opts = [(b.e.id, b.e.lemma)] + [(d[0], d[1]) for d in ds]
    pool.rng.shuffle(opts)
    return {"id": _id(), "type": "mc_word", "entry_id": b.e.id,
            "public": {"meaning_vi": short_meaning(b.meaning, 120), "pos_vi": POS_VI.get(b.pos, b.pos), "options": [o[1] for o in opts],
                       "prompt_vi": "Chọn từ tiếng Anh đúng"},
            "private": {"answer": [o[0] for o in opts].index(b.e.id), "option_entries": [o[0] for o in opts]}}


def listen_choose(b: Bundle, pool: DistractorPool) -> dict | None:
    it = mc_word(b, pool)
    if it is None:
        return None
    it["type"] = "listen_choose"
    it["public"] = {"options": it["public"]["options"], "prompt_vi": "Nghe và chọn từ bạn nghe được"}
    it["private"]["speak"] = b.e.lemma
    return it


def type_word(b: Bundle, *, hint: bool) -> dict:
    target = b.e.headword if b.e.kind in ("collocation", "phrase", "pattern") else b.e.lemma
    first = alternatives(target)[0] if alternatives(target) else target
    pub = {"meaning_vi": b.meaning, "pos_vi": POS_VI.get(b.pos, b.pos), "kind": b.e.kind,
           "prompt_vi": "Gõ từ / cụm từ tiếng Anh có nghĩa:"}
    ex = pick_example(b, prefer_short=True)
    if ex and ex.vi:
        pub["example_vi"] = ex.vi
    if hint:
        pub["hint"] = {"first": first[:1], "length": len(first), "words": len(first.split())}
    return {"id": _id(), "type": "type_word", "entry_id": b.e.id, "public": pub,
            "private": {"target": target, "variants": b.e.variants, "forms": b.e.forms, "family": b.e.family}}


def dictation(b: Bundle) -> dict:
    return {"id": _id(), "type": "dictation", "entry_id": b.e.id,
            "public": {"prompt_vi": "Nghe và gõ lại từ / cụm từ", "words": len(b.e.lemma.split()), "ipa_after": True},
            "private": {"target": b.e.lemma, "variants": b.e.variants, "forms": b.e.forms, "family": b.e.family, "speak": b.e.lemma}}


def cloze(b: Bundle, pool: DistractorPool, *, prefer_short: bool) -> dict | None:
    rx = b.word_forms_regex()
    ex = pick_example(b, prefer_short=prefer_short)
    if rx is None or ex is None:
        return None
    m = rx.search(ex.en)
    if not m:
        return None
    blanked = ex.en[: m.start()] + "_____" + ex.en[m.end():]
    ds = pool.pick(b, 3)
    if len(ds) < 2:
        return None
    opts = [(b.e.id, b.e.lemma, b.meaning)] + list(ds)
    pool.rng.shuffle(opts)
    return {"id": _id(), "type": "cloze", "entry_id": b.e.id,
            "public": {"sentence": blanked, "options": [o[1] for o in opts], "prompt_vi": "Chọn từ phù hợp với câu (có thể cần chia dạng)"},
            "private": {"answer": [o[0] for o in opts].index(b.e.id), "form": m.group(0), "full": ex.en, "vi": ex.vi,
                        "explain": [{"word": o[1], "meaning_vi": short_meaning(o[2], 80), "correct": o[0] == b.e.id} for o in opts]}}


def collocation(b: Bundle, pool: DistractorPool, known: set[str]) -> dict | None:
    """'_____ a decision' with make/do/take/get. Uses curriculum collocations (focus word known)."""
    cands = []
    if b.e.kind == "collocation" and b.e.focus:
        for phrase in alternatives(b.e.lemma)[:1]:
            cands.append((phrase, b.e.focus[0].split("/")[0].strip(), b.meaning))
    for c in b.colls:
        if c.focus:
            cands.append((alternatives(c.phrase)[0] if alternatives(c.phrase) else c.phrase, c.focus.split("/")[0].strip(), c.meaning_vi))
    for phrase, focus, meaning in cands:
        words = phrase.split()
        lw = [w.lower() for w in words]
        if focus.lower() not in lw:
            continue
        i = lw.index(focus.lower())
        rest_before, rest_after = words[:i], words[i + 1:]
        poolw = VERB_POOL if focus.lower() in VERB_POOL else ADJ_POOL if focus.lower() in ADJ_POOL else ADV_POOL if focus.lower() in ADV_POOL else None
        if poolw is None:
            ds = [d[1] for d in pool.pick(b, 6)]
        else:
            ds = [w for w in poolw if w != focus.lower()]
            pool.rng.shuffle(ds)
        ok = [d for d in ds if clean(" ".join(rest_before + [d] + rest_after)) not in known][:3]
        if len(ok) < 2:
            continue
        opts = [focus] + ok
        pool.rng.shuffle(opts)
        return {"id": _id(), "type": "collocation", "entry_id": b.e.id,
                "public": {"phrase": " ".join(rest_before + ["_____"] + rest_after), "meaning_vi": meaning, "options": opts,
                           "prompt_vi": "Chọn từ kết hợp tự nhiên"},
                "private": {"answer": opts.index(focus), "full": phrase}}
    return None


def builder(b: Bundle, rng: random.Random, *, prefer_short: bool) -> dict | None:
    ex = pick_example(b, prefer_short=True, max_words=10 if prefer_short else 12)
    if ex is None:
        return None
    sentence = ex.en.strip()
    core = re.sub(r"[.!?]+$", "", sentence)
    tokens = core.split()
    if not 4 <= len(tokens) <= 12:
        return None
    shuffled = tokens[:]
    for _ in range(10):
        rng.shuffle(shuffled)
        if shuffled != tokens:
            break
    return {"id": _id(), "type": "builder", "entry_id": b.e.id,
            "public": {"tokens": shuffled, "meaning_vi": ex.vi, "word": b.e.lemma, "end": sentence[len(core):] or ".",
                       "prompt_vi": "Sắp xếp thành câu đúng"},
            "private": {"sentence": core, "full": sentence}}


def confusable(b: Bundle, rng: random.Random, all_forms: dict[str, list[str]]) -> dict | None:
    for grp in b.e.confused_with:
        words = [b.e.lemma] + [w for w in grp.get("words", [])]
        parts = [p.strip() for p in re.split(r"\s+/\s+|(?<=[.!?])\s+", grp.get("example") or "") if p.strip()]
        for part in parts:
            hits = []
            for w in words:
                forms = all_forms.get(w.lower(), [w])
                rx = re.compile(r"(?<![A-Za-z])(" + "|".join(re.escape(f) for f in sorted(forms, key=len, reverse=True)) + r")(?![A-Za-z])", re.I)
                if (m := rx.search(part)):
                    hits.append((w, m))
            if len(hits) == 1:
                w, m = hits[0]
                opts = list(dict.fromkeys(words))
                rng.shuffle(opts)
                return {"id": _id(), "type": "confusable", "entry_id": b.e.id,
                        "public": {"sentence": part[: m.start()] + "_____" + part[m.end():], "options": opts,
                                   "prompt_vi": "Phân biệt từ dễ nhầm: chọn từ đúng"},
                        "private": {"answer": opts.index(w), "form": m.group(0), "full": part, "note_vi": grp.get("note_vi")}}
    return None


def use_it(b: Bundle) -> dict:
    pub = entry_public(b)
    return {"id": _id(), "type": "use_it", "entry_id": b.e.id,
            "public": {"word": pub["word"], "meaning_vi": pub["meaning_vi"], "pos_vi": pub["pos_vi"], "example": pub["example"],
                       "prompt_vi": f"Tự đặt một câu có dùng “{b.e.lemma}”."},
            "private": {"forms": b.forms}}


# item types whose prompt must not reveal the word: entry ids are readable slugs ("achieve"), so they are only
# returned with the feedback after answering
HIDE_ENTRY = {"type_word", "dictation", "mc_word", "listen_choose", "cloze", "collocation", "confusable"}


def public_item(it: dict) -> dict:
    out = {"id": it["id"], "type": it["type"], "round": it.get("round", 1), "scheduled": it.get("scheduled", False), **it["public"]}
    if it["type"] not in HIDE_ENTRY:
        out["entry_id"] = it["entry_id"]
    return out
