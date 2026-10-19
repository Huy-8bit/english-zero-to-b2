"""Vocabulary data access shared by every module (explorer, sessions, notebook, Reading/Listening/Writing/Speaking).

There is exactly one progress store (vocab_progress); lesson flashcards, the vocabulary page and words saved from
other modules all read and write it.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..models import (LearningProfile, VocabCollection, VocabCollectionItem, VocabCollocation, VocabEntry, VocabEntryTopic,
                      VocabExample, VocabMistake, VocabProgress, VocabReviewLog, VocabSense, VocabTopic, utcnow)
from . import lexicon, srs
from .grading import clean
from .topics import POS_VI, TOPIC_BY_ID

SYSTEM_COLLECTIONS = {
    "reading": ("Từ trong bài đọc", "Từ bạn đánh dấu khi đọc"),
    "listening": ("Từ trong bài nghe", "Từ bạn đánh dấu khi nghe / xem transcript"),
    "writing": ("Từ từ lỗi bài viết", "Từ / cách diễn đạt AI gợi ý khi chấm bài viết"),
    "speaking": ("Cụm từ khi luyện nói", "Cụm từ hữu ích từ phản hồi luyện nói"),
    "lesson": ("Từ trong bài học", "Từ bạn lưu khi học bài giáo trình"),
    "difficult": ("Từ khó của tôi", "Từ bạn đánh dấu khó"),
}
TEMPLATES = {
    "work": ("Từ vựng công việc", ["work-careers", "business"], None),
    "travel": ("Từ vựng du lịch", ["travel-tourism", "transportation"], None),
    "vstep": ("Từ vựng ôn VSTEP (ước lượng)", ["education", "environment", "technology", "health", "work-careers", "media-news",
                                             "social-problems", "culture-society", "academic"], ("B1", "B2")),
}
MAX_DAILY_NEW = 150  # intensive learners (e.g. 100 words/day in batches of 10)
SETTINGS_DEFAULT = {"daily_new": 8, "retention": srs.DEFAULT_RETENTION, "timed_speed": False, "accent": "uk", "level": None}


# ------------------------------------------------------------------ settings
def settings(db: Session, user_id: int) -> dict:
    p = db.get(LearningProfile, user_id)
    return SETTINGS_DEFAULT | ((p.preferences or {}).get("vocab", {}) if p else {})


def save_settings(db: Session, user_id: int, values: dict) -> dict:
    p = db.get(LearningProfile, user_id)
    if p is None:
        p = LearningProfile(user_id=user_id, preferences={})
        db.add(p)
    cur = settings(db, user_id)
    for k, v in values.items():
        if k in SETTINGS_DEFAULT and v is not None:
            cur[k] = v
    cur["daily_new"] = max(0, min(MAX_DAILY_NEW, int(cur["daily_new"])))
    cur["retention"] = max(0.75, min(0.97, float(cur["retention"])))
    p.preferences = {**(p.preferences or {}), "vocab": cur}
    return cur


# ------------------------------------------------------------------ views
def entry_card(e: VocabEntry, senses: list[VocabSense], examples: list[VocabExample], p: VocabProgress | None = None) -> dict:
    s0 = senses[0] if senses else None
    ex = next((x for x in examples if x.vi), examples[0] if examples else None)
    return {"id": e.id, "lemma": e.lemma, "headword": e.headword, "kind": e.kind, "cefr": e.cefr, "pos": e.pos,
            "pos_vi": [POS_VI.get(x, x) for x in e.pos], "ipa_uk": e.ipa_uk, "ipa_us": e.ipa_us, "ipa_status": e.ipa_status,
            "meaning_vi": s0.meaning_vi if s0 else None, "definition_en": s0.definition_en if s0 else None,
            "example": {"en": ex.en, "vi": ex.vi} if ex else None, "topics": e.topics, "status": e.status,
            "progress": progress_view(p)}


def progress_view(p: VocabProgress | None) -> dict | None:
    if p is None:
        return None
    return {"state": srs.label(p), "due": p.due.isoformat() if p.due else None, "reps": p.reps, "lapses": p.lapses,
            "stability": round(p.stability, 2) if p.stability else None, "saved": p.saved, "known": p.known,
            "difficult": p.difficult, "suspended": p.suspended, "note": p.note, "own_example": p.own_example,
            "seen": p.first_seen_at is not None, "learned": p.learned_at is not None, "correct_count": p.correct_count,
            "incorrect_count": p.incorrect_count, "recalled_after_delay": p.recalled_after_delay_at is not None,
            "used_correctly": p.used_correctly_at is not None, "used_count": p.used_count,
            "last_review": p.last_review.isoformat() if p.last_review else None}


def load_children(db: Session, ids: list[str]) -> tuple[dict, dict]:
    senses: dict[str, list] = {}
    examples: dict[str, list] = {}
    for chunk in _chunks(ids, 400):
        for s in db.scalars(select(VocabSense).where(VocabSense.entry_id.in_(chunk), VocabSense.status != "rejected").order_by(VocabSense.idx)):
            senses.setdefault(s.entry_id, []).append(s)
        for x in db.scalars(select(VocabExample).where(VocabExample.entry_id.in_(chunk), VocabExample.status.in_(("curriculum", "sourced", "reviewed"))).order_by(VocabExample.idx)):
            examples.setdefault(x.entry_id, []).append(x)
    return senses, examples


def progress_map(db: Session, user_id: int, ids: list[str] | None = None) -> dict[str, VocabProgress]:
    q = select(VocabProgress).where(VocabProgress.user_id == user_id)
    if ids is not None:
        out = {}
        for chunk in _chunks(ids, 400):
            out |= {p.entry_id: p for p in db.scalars(q.where(VocabProgress.entry_id.in_(chunk)))}
        return out
    return {p.entry_id: p for p in db.scalars(q)}


def visible(user_id: int):
    return (VocabEntry.published.is_(True)) & (or_(VocabEntry.owner_user_id.is_(None), VocabEntry.owner_user_id == user_id))


def cards(db: Session, user_id: int, entries: list[VocabEntry]) -> list[dict]:
    ids = [e.id for e in entries]
    senses, examples = load_children(db, ids)
    prog = progress_map(db, user_id, ids)
    return [entry_card(e, senses.get(e.id, []), examples.get(e.id, []), prog.get(e.id)) for e in entries]


def explore(db: Session, user_id: int, *, q: str | None = None, level: str | None = None, topic: str | None = None,
            kind: str | None = None, mastery: str | None = None, saved: bool | None = None, collection: int | None = None,
            difficult: bool | None = None, page: int = 1, size: int = 30, sort: str = "order") -> dict:
    lexicon.ensure_imported(db)
    stmt = select(VocabEntry).where(visible(user_id))
    if q:
        t = lexicon.norm(q)
        meaning_ids = select(VocabSense.entry_id).where(VocabSense.meaning_vi.ilike(f"%{q.strip()}%"))
        ids = lexicon.find_ids(t)
        stmt = stmt.where(or_(VocabEntry.search_key.like(f"%{t}%"), VocabEntry.id.in_(meaning_ids), VocabEntry.id.in_(ids or [""])))
    if level:
        stmt = stmt.where(VocabEntry.cefr == level)
    if topic:
        stmt = stmt.where(VocabEntry.id.in_(select(VocabEntryTopic.entry_id).where(VocabEntryTopic.topic_id == topic)))
    if kind:
        stmt = stmt.where(VocabEntry.kind == kind)
    if collection:
        own = db.get(VocabCollection, collection)
        if own is None or own.user_id != user_id:
            return {"items": [], "total": 0, "page": page, "size": size}
        stmt = stmt.where(VocabEntry.id.in_(select(VocabCollectionItem.entry_id).where(VocabCollectionItem.collection_id == collection)))
    pq = select(VocabProgress.entry_id).where(VocabProgress.user_id == user_id)
    if saved:
        stmt = stmt.where(VocabEntry.id.in_(pq.where(VocabProgress.saved.is_(True))))
    if difficult:
        stmt = stmt.where(VocabEntry.id.in_(pq.where(VocabProgress.difficult.is_(True))))
    if mastery == "new":
        stmt = stmt.where(VocabEntry.id.not_in(pq.where(VocabProgress.state != "new")))
    elif mastery in ("learning", "review", "relearning"):
        stmt = stmt.where(VocabEntry.id.in_(pq.where(VocabProgress.state == mastery)))
    elif mastery == "mastered":
        stmt = stmt.where(VocabEntry.id.in_(pq.where(VocabProgress.state == "review", VocabProgress.stability >= srs.MASTERED_STABILITY_DAYS,
                                                     VocabProgress.correct_count >= 3, VocabProgress.last_rating >= 3)))
    elif mastery == "due":
        stmt = stmt.where(VocabEntry.id.in_(pq.where(VocabProgress.due <= utcnow(), VocabProgress.suspended.is_(False), VocabProgress.known.is_(False))))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    if q and sort == "order":
        t = lexicon.norm(q)
        stmt = stmt.order_by((VocabEntry.lemma != t), func.length(VocabEntry.lemma), VocabEntry.sort_order)
    else:
        stmt = stmt.order_by(VocabEntry.lemma if sort == "az" else VocabEntry.sort_order)
    size = max(1, min(100, size))
    rows = list(db.scalars(stmt.offset((max(1, page) - 1) * size).limit(size)))
    return {"items": cards(db, user_id, rows), "total": total, "page": page, "size": size}


def detail(db: Session, user_id: int, entry_id: str) -> dict | None:
    lexicon.ensure_imported(db)
    e = db.get(VocabEntry, entry_id)
    if e is None or not e.published or (e.owner_user_id not in (None, user_id)):
        return None
    senses, examples = load_children(db, [e.id])
    p = db.scalar(select(VocabProgress).where(VocabProgress.user_id == user_id, VocabProgress.entry_id == e.id))
    colls = list(db.scalars(select(VocabCollocation).where(VocabCollocation.entry_id == e.id, VocabCollocation.status != "rejected")))
    rel_words = list(dict.fromkeys(e.family + e.synonyms + e.antonyms + [w for c in e.confused_with for w in c.get("words", [])]))
    rel_ids = {w: (lexicon.find_ids(w) or [None])[0] for w in rel_words}
    history = list(db.scalars(select(VocabReviewLog).where(VocabReviewLog.user_id == user_id, VocabReviewLog.entry_id == e.id)
                              .order_by(VocabReviewLog.reviewed_at.desc()).limit(30)))
    in_colls = list(db.execute(select(VocabCollection.id, VocabCollection.name).join(VocabCollectionItem, VocabCollectionItem.collection_id == VocabCollection.id)
                               .where(VocabCollection.user_id == user_id, VocabCollectionItem.entry_id == e.id)).all())
    mistakes = list(db.scalars(select(VocabMistake).where(VocabMistake.user_id == user_id, VocabMistake.entry_id == e.id)
                               .order_by(VocabMistake.created_at.desc()).limit(10)))
    out = entry_card(e, senses.get(e.id, []), examples.get(e.id, []), p)
    out |= {
        "variants": e.variants, "forms": e.forms, "ipa_source": e.ipa_source, "ipa_curriculum": e.ipa_curriculum,
        "cefr_source": e.cefr_source, "freq_rank": e.freq_rank, "tier": e.tier, "academic": e.academic,
        "topic_names": [TOPIC_BY_ID[t]["name_vi"] for t in e.topics if t in TOPIC_BY_ID], "topic_sources": e.topic_sources,
        "senses": [{"id": s.id, "pos": s.pos, "pos_vi": POS_VI.get(s.pos or "", s.pos), "meaning_vi": s.meaning_vi,
                    "definition_en": s.definition_en, "usage": s.usage, "pattern": s.pattern, "source": s.source, "status": s.status,
                    "cefr": s.cefr} for s in senses.get(e.id, [])],
        "examples": [{"id": x.id, "en": x.en, "vi": x.vi, "source": x.source, "ref": x.ref, "status": x.status}
                     for x in examples.get(e.id, [])],
        "collocations": [{"phrase": c.phrase, "meaning_vi": c.meaning_vi, "focus": c.focus, "entry_id": c.linked_entry_id,
                          "source": c.source, "status": c.status} for c in colls],
        "family": [{"word": w, "entry_id": rel_ids.get(w)} for w in e.family],
        "synonyms": [{"word": w, "entry_id": rel_ids.get(w)} for w in e.synonyms],
        "antonyms": [{"word": w, "entry_id": rel_ids.get(w)} for w in e.antonyms],
        "confused_with": [{**c, "entries": [{"word": w, "entry_id": rel_ids.get(w)} for w in c.get("words", [])]} for c in e.confused_with],
        "common_mistakes": e.mistakes, "units": e.units, "sources": e.sources, "review_flags": e.review_flags,
        "history": [{"at": h.reviewed_at.isoformat(), "mode": h.mode, "rating": h.rating, "correct": h.correct, "verdict": h.verdict,
                     "state_after": h.state_after} for h in history],
        "collections": [{"id": c[0], "name": c[1]} for c in in_colls],
        "my_mistakes": [{"at": m.created_at.isoformat(), "mode": m.mode, "error_type": m.error_type, "answer": m.answer,
                         "expected": m.expected, "resolved": m.resolved_at is not None} for m in mistakes],
        "preview": srs.preview(p) if p and p.state != "new" else None,
    }
    return out


# ------------------------------------------------------------------ progress actions
def get_progress(db: Session, user_id: int, entry_id: str, create: bool = True, source: str | None = None) -> VocabProgress | None:
    p = db.scalar(select(VocabProgress).where(VocabProgress.user_id == user_id, VocabProgress.entry_id == entry_id))
    if p is None and create:
        p = VocabProgress(user_id=user_id, entry_id=entry_id, state="new", added_from=source, reps=0, lapses=0, correct_count=0,
                          incorrect_count=0, streak=0, used_count=0, used_in={}, saved=False, known=False, difficult=False, suspended=False)
        db.add(p)
        db.flush()
    return p


def mark_seen(p: VocabProgress) -> None:
    if p.first_seen_at is None:
        p.first_seen_at = utcnow()


def update_progress(db: Session, user_id: int, entry_id: str, action: str, value: str | None = None) -> dict:
    p = get_progress(db, user_id, entry_id)
    if action == "save":
        p.saved = True
    elif action == "unsave":
        p.saved = False
    elif action == "known":
        p.known = True  # skipped by new-word selection and reviews; reversible
    elif action == "unknown":
        p.known = False
    elif action == "difficult":
        p.difficult = True
        add_to_collection(db, user_id, system_collection(db, user_id, "difficult").id, entry_id, source_module="notebook")
    elif action == "not_difficult":
        p.difficult = False
        coll = system_collection(db, user_id, "difficult")
        item = db.scalar(select(VocabCollectionItem).where(VocabCollectionItem.collection_id == coll.id, VocabCollectionItem.entry_id == entry_id))
        if item:
            db.delete(item)
    elif action == "suspend":
        p.suspended = True
    elif action == "unsuspend":
        p.suspended = False
    elif action == "note":
        p.note = (value or "").strip()[:2000] or None
    elif action == "own_example":
        p.own_example = (value or "").strip()[:500] or None
    elif action == "learn":
        p.saved = True
        p.known = False
        p.suspended = False
        p.added_from = p.added_from or "explorer"
    else:
        raise ValueError("unknown action")
    return progress_view(p)


# ------------------------------------------------------------------ collections
def system_collection(db: Session, user_id: int, key: str) -> VocabCollection:
    c = db.scalar(select(VocabCollection).where(VocabCollection.user_id == user_id, VocabCollection.system_key == key))
    if c is None:
        name, desc = SYSTEM_COLLECTIONS[key]
        c = VocabCollection(user_id=user_id, name=name, description=desc, system_key=key)
        db.add(c)
        db.flush()
    return c


def add_to_collection(db: Session, user_id: int, collection_id: int, entry_id: str, *, context: str | None = None,
                      source_module: str | None = None, source_ref: str | None = None) -> bool:
    c = db.get(VocabCollection, collection_id)
    if c is None or c.user_id != user_id:
        raise PermissionError
    if db.scalar(select(VocabCollectionItem.id).where(VocabCollectionItem.collection_id == collection_id, VocabCollectionItem.entry_id == entry_id)):
        return False
    db.add(VocabCollectionItem(collection_id=collection_id, entry_id=entry_id, context=(context or "")[:600] or None,
                               source_module=source_module, source_ref=source_ref))
    db.flush()
    return True


def collections(db: Session, user_id: int) -> list[dict]:
    rows = db.execute(select(VocabCollection, func.count(VocabCollectionItem.id)).outerjoin(VocabCollectionItem, VocabCollectionItem.collection_id == VocabCollection.id)
                      .where(VocabCollection.user_id == user_id).group_by(VocabCollection.id).order_by(VocabCollection.system_key.is_(None), VocabCollection.created_at)).all()
    return [{"id": c.id, "name": c.name, "description": c.description, "system_key": c.system_key, "count": n} for c, n in rows]


def create_collection(db: Session, user_id: int, name: str, description: str | None = None, template: str | None = None) -> dict:
    lexicon.ensure_imported(db)
    if template and template in TEMPLATES:
        tname, topics, levels = TEMPLATES[template]
        name = name or tname
    c = VocabCollection(user_id=user_id, name=(name or "Bộ từ mới").strip()[:120], description=description)
    db.add(c)
    db.flush()
    if template and template in TEMPLATES:
        stmt = select(VocabEntry.id).where(visible(user_id), VocabEntry.id.in_(select(VocabEntryTopic.entry_id).where(VocabEntryTopic.topic_id.in_(topics))))
        if levels:
            stmt = stmt.where(VocabEntry.cefr.in_(levels))
        for eid in db.scalars(stmt.order_by(VocabEntry.sort_order).limit(300)):
            db.add(VocabCollectionItem(collection_id=c.id, entry_id=eid, source_module=f"template:{template}"))
        db.flush()
    return next(x for x in collections(db, user_id) if x["id"] == c.id)


# ------------------------------------------------------------------ capture from other modules
def capture(db: Session, user_id: int, *, text: str, module: str, context: str | None = None, ref: str | None = None,
            meaning_vi: str | None = None, example: str | None = None, entry_id: str | None = None) -> dict:
    """Save a word/phrase the learner chose in Reading/Listening/Writing/Speaking/lesson → notebook + review schedule."""
    lexicon.ensure_imported(db)
    text = re.sub(r"\s+", " ", (text or "").strip())[:120]
    if not text and not entry_id:
        raise ValueError("empty")
    e = db.get(VocabEntry, entry_id) if entry_id else None
    if e is None:
        for eid in lexicon.find_ids(text):
            cand = db.get(VocabEntry, eid)
            if cand is not None and cand.published:
                e = cand
                break
    if e is None:  # personal entry (not part of the shared lexicon; labelled as such)
        pid = "u" + str(user_id) + "-" + re.sub(r"[^a-z0-9]+", "-", lexicon.norm(text)).strip("-")[:80]
        e = db.get(VocabEntry, pid)
        if e is None:
            e = VocabEntry(id=pid, lemma=text, headword=text, search_key=lexicon.norm(text), kind="phrase" if " " in text else "word",
                           cefr=None, pos=[], variants=[], forms=[], topics=[], topic_sources=[], family=[], synonyms=[], antonyms=[],
                           confused_with=[], mistakes=[], focus=[], legacy_ids=[], units=[], sources=[f"user:{module}"], status="user",
                           review_flags=["personal_entry"], origin="user", owner_user_id=user_id, published=True, ipa_status="missing",
                           sort_order=10**6)
            db.add(e)
            db.flush()
            if meaning_vi:
                db.add(VocabSense(id=f"{pid}#1", entry_id=pid, idx=0, pos=None, meaning_vi=meaning_vi[:400], source=f"user:{module}",
                                  status="user", origin="user", usage=[]))
            if example:
                db.add(VocabExample(id=f"{pid}~1", entry_id=pid, en=example[:300], vi=None, source=f"user:{module}", status="reviewed",
                                    origin="user", idx=0))
    key = module if module in SYSTEM_COLLECTIONS else "lesson"
    coll = system_collection(db, user_id, key)
    added = add_to_collection(db, user_id, coll.id, e.id, context=context, source_module=module, source_ref=ref)
    p = get_progress(db, user_id, e.id, source=module)
    p.saved = True
    p.known = False
    mark_seen(p)
    return {"entry_id": e.id, "lemma": e.lemma, "personal": e.origin == "user", "collection_id": coll.id, "added": added,
            "progress": progress_view(p)}


def record_usage(db: Session, user_id: int, text: str, module: str, error_texts: list[str] = ()) -> list[dict]:
    """Words the learner has studied that appear in their own Writing/Speaking. A use counts as correct only when no
    detected error overlaps the word (an estimate; the AI feedback is the evidence)."""
    lexicon.ensure_imported(db)
    words = clean(text)
    if not words:
        return []
    studied = list(db.scalars(select(VocabProgress).where(VocabProgress.user_id == user_id, VocabProgress.state != "new")))
    if not studied:
        return []
    errs = " | ".join(clean(x) for x in error_texts)
    ents = {e.id: e for e in db.scalars(select(VocabEntry).where(VocabEntry.id.in_([p.entry_id for p in studied])))}
    padded = f" {words} "
    used = []
    for p in studied:
        e = ents.get(p.entry_id)
        if e is None or e.kind in ("pattern",):
            continue
        forms = [x for x in [e.lemma, *e.variants, *e.forms] if x]
        hit = next((f for f in forms if f" {clean(f)} " in padded), None)
        if not hit:
            continue
        ok = clean(hit) not in errs
        p.used_count = (p.used_count or 0) + 1
        p.used_in = {**(p.used_in or {}), module: (p.used_in or {}).get(module, 0) + 1}
        if ok and p.used_correctly_at is None:
            p.used_correctly_at = utcnow()
        db.add(VocabReviewLog(user_id=user_id, entry_id=e.id, mode=f"use:{module}", correct=ok, verdict="used" if ok else "used_with_error",
                              response={"form": hit}))
        used.append({"entry_id": e.id, "lemma": e.lemma, "form": hit, "correct": ok})
    return used


def _chunks(xs, n):
    xs = list(xs)
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


def day_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Start/end of the learner's local day in naive UTC (the server's local timezone is the learner's)."""
    local = (now.replace(tzinfo=timezone.utc) if now else datetime.now(timezone.utc)).astimezone()
    start_local = local.replace(hour=0, minute=0, second=0, microsecond=0)
    start = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    return start, start + timedelta(days=1)
