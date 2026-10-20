"""Help for a lesson question the learner cannot start: words in the question with dictionary meanings, and an AI hint.

Never reveals the answer: glossary words that are part of the answer key are left out, and an AI hint that contains a
word of the answer (one that is not already in the question) is discarded. Using help does not change grading.
"""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from .content.md import strip_md
from .content.store import ContentStore
from .models import VocabEntry, VocabSense
from .services.grading import normalize

WORD_RX = re.compile(r"[A-Za-z][A-Za-z'’-]{1,}")
# very common words a learner at this stage already knows; glossing them is noise
STOP = set("""a an the and or but if so to of in on at by for with from up down out over into about as is am are was were be been being
do does did done have has had having i you he she it we they me him her us them my your his its our their this that these those
there here what who whom whose which when where why how not no yes can could will would shall should may might must
very too also just only all any some one two three more most much many such than then now so ok okay
""".split())


def _question(store: ContentStore, item_id: str) -> tuple[str, str, list[str]]:
    """(prompt, instructions, option texts) as the learner sees them."""
    b = store.built(item_id.split(":", 1)[0])
    if b is None:
        return "", "", []
    for st in b.steps:
        for x in st.get("items") or []:
            if x["id"] == item_id:
                opts = [strip_md(o.get("text", "")) for o in (x.get("options") or [])]
                instr = x.get("group_md") or x.get("instruction_md") or st.get("intro_md") or ""  # the item's own group instruction
                return strip_md(x.get("prompt_md") or ""), strip_md(instr), opts
    return "", "", []


def _answer_words(item) -> set[str]:
    text = " ".join(filter(None, [item.key.answer_md if item.key else "", item.model_md]))
    if item.correct_option and item.options:
        text += " " + " ".join(o["text"] for o in item.options if o["key"] == item.correct_option)
    return {w for w in normalize(text).split() if len(w) >= 3}


def glossary(db: Session, store: ContentStore, item_id: str, limit: int = 10) -> list[dict]:
    from .vocabulary import lexicon

    item = store.item(item_id)
    if item is None:
        return []
    prompt, instructions, _ = _question(store, item_id)
    secret = _answer_words(item)
    lexicon.ensure_imported(db)
    out, seen = [], set()
    for raw in WORD_RX.findall(prompt + " " + instructions):
        w = raw.lower().replace("’", "'").strip("'-")
        if len(w) < 3 or w in STOP or w in seen or normalize(w) in secret:
            continue
        seen.add(w)
        ids = lexicon.find_ids(w)
        if not ids:
            continue
        e = db.get(VocabEntry, ids[0])
        sense = db.scalar(select(VocabSense.meaning_vi).where(VocabSense.entry_id == ids[0], VocabSense.status != "rejected")
                          .order_by(VocabSense.idx))
        if e is None or not sense:
            continue
        out.append({"word": raw, "lemma": e.lemma, "entry_id": e.id, "ipa": e.ipa_uk or e.ipa_us, "meaning_vi": sense})
        if len(out) >= limit:
            break
    return out


def ai_hint(db: Session, gw, store: ContentStore, user_id: int, item_id: str) -> str | None:
    """A short hint that points to the rule or what to look for, checked so that it does not contain the answer."""
    item = store.item(item_id)
    if item is None:
        return None
    prompt, instructions, options = _question(store, item_id)
    answer = strip_md(item.key.answer_md if item.key else item.model_md)[:400]
    text = gw.text(db, user_id, feature="quiz_help", task="tutor",
                   instructions="You help a Vietnamese learner who is stuck on an English exercise. Write ONE or TWO short sentences in "
                                "Vietnamese that point to the grammar rule, the pattern or the clue in the question. NEVER give the answer, "
                                "any part of it, or any English word from it; do not translate the answer. The reference answer is only "
                                "for you to make the hint correct.",
                   input=f"<learner_text>Instructions: {instructions[:800]}\nQuestion: {prompt[:800]}\nOptions: {' | '.join(options)[:400]}</learner_text>\n"
                         f"<reference_answer>{answer}</reference_answer>", max_output_tokens=300, cache=True).strip()
    visible = set(normalize(" ".join([prompt, instructions, *options])).split())
    leaked = {w for w in _answer_words(item) - visible if re.search(rf"\b{re.escape(w)}\b", normalize(text))}
    return None if leaked or not text else text[:500]
