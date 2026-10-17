"""Import the published lexicon into the database (idempotent) and look words up.

- Import is keyed by the dataset file hash: unchanged file → no work. Dataset rows are upserted by stable id;
  entries that disappear from the dataset are unpublished (never deleted) so learner progress stays valid.
- Rows created by AI enrichment (origin "ai") or by learners (origin "user") are never replaced by an import.
- Old SM-2 progress (vocab_cards) is copied once into FSRS progress; vocab_cards itself is not modified.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import re
import threading
import unicodedata
from functools import lru_cache
from pathlib import Path

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..content.md import fold
from ..models import (VocabCard, VocabCollocation, VocabDataset, VocabEntry, VocabEntryTopic, VocabExample, VocabLegacyCard,
                      VocabProgress, VocabSense, VocabTopic, utcnow)
from . import srs
from .topics import TOPICS

DATA_FILE = Path(__file__).parent / "data" / "lexicon.jsonl.gz"
LEVELS = ("A1", "A2", "B1", "B2", "C1")
KINDS = ("word", "phrasal_verb", "phrase", "collocation", "pattern")
_lock = threading.Lock()


class LexiconError(ValueError):
    pass


@lru_cache(maxsize=1)
def dataset() -> tuple[str, tuple[dict, ...]]:
    raw = DATA_FILE.read_bytes()
    version = hashlib.sha256(raw).hexdigest()[:16]
    entries = tuple(json.loads(line) for line in gzip.decompress(raw).decode("utf-8").splitlines() if line.strip())
    return version, entries


def norm(text: str) -> str:
    t = unicodedata.normalize("NFC", text or "").replace("’", "'").replace("‘", "'").lower().strip()
    return re.sub(r"\s+", " ", t)


def search_key(e: dict) -> str:
    parts = [e["lemma"], e.get("headword") or "", *e.get("variants", [])]
    return " | ".join(dict.fromkeys(norm(p) for p in parts if p))[:400]


def validate(entries: tuple[dict, ...]) -> dict:
    """Import validation. Raises LexiconError on structural problems (nothing is imported then)."""
    ids, legacy = set(), set()
    for e in entries:
        eid = e.get("id")
        if not eid or not re.fullmatch(r"[a-z0-9_\-.]{1,120}", eid):
            raise LexiconError(f"invalid id {eid!r}")
        if eid in ids:
            raise LexiconError(f"duplicate id {eid}")
        ids.add(eid)
        if not e.get("lemma", "").strip():
            raise LexiconError(f"{eid}: empty lemma")
        if e.get("kind") not in KINDS:
            raise LexiconError(f"{eid}: invalid kind {e.get('kind')}")
        if e.get("cefr") not in LEVELS:
            raise LexiconError(f"{eid}: invalid level {e.get('cefr')}")
        senses = e.get("senses") or []
        if not senses or any(not (s.get("meaning_vi") or "").strip() for s in senses):
            raise LexiconError(f"{eid}: missing Vietnamese meaning")
        sids = [s["id"] for s in senses]
        if len(set(sids)) != len(sids) or any(not s.startswith(eid + "#") for s in sids):
            raise LexiconError(f"{eid}: inconsistent sense ids")
        for x in e.get("examples", []):
            if not x.get("en", "").strip() or not x["id"].startswith(eid + "~"):
                raise LexiconError(f"{eid}: invalid example")
        for lid in e.get("legacy_ids", []):
            if lid in legacy:
                raise LexiconError(f"legacy card {lid} mapped twice")
            legacy.add(lid)
    return {"entries": len(ids), "legacy_cards": len(legacy)}


def ensure_imported(db: Session) -> None:
    version, _ = dataset()
    meta = db.get(VocabDataset, 1)
    if meta is not None and meta.version == version:
        return
    with _lock:
        meta = db.get(VocabDataset, 1)
        if meta is not None and meta.version == version:
            return
        import_dataset(db)


def import_dataset(db: Session) -> dict:
    version, entries = dataset()
    counts = validate(entries)
    for i, t in enumerate(TOPICS):
        row = db.get(VocabTopic, t["id"])
        if row is None:
            db.add(VocabTopic(id=t["id"], name=t["name"], name_vi=t["name_vi"], band=t["band"], sort_order=i))
        else:
            row.name, row.name_vi, row.band, row.sort_order = t["name"], t["name_vi"], t["band"], i
    db.flush()
    existing = set(db.scalars(select(VocabEntry.id)))  # any origin: a dataset entry supersedes an AI/user row with the same id
    ids = [e["id"] for e in entries]
    # dataset-owned child rows are replaced wholesale; ai/user rows are kept
    for chunk in _chunks(ids, 500):
        db.execute(delete(VocabSense).where(VocabSense.entry_id.in_(chunk), VocabSense.origin == "dataset"))
        db.execute(delete(VocabExample).where(VocabExample.entry_id.in_(chunk), VocabExample.origin == "dataset"))
        db.execute(delete(VocabCollocation).where(VocabCollocation.entry_id.in_(chunk), VocabCollocation.origin == "dataset"))
        db.execute(delete(VocabEntryTopic).where(VocabEntryTopic.entry_id.in_(chunk)))
    db.execute(delete(VocabLegacyCard))
    now = utcnow()
    rows_new, rows_upd = [], []
    senses, examples, colls, topics, legacy = [], [], [], [], []
    for e in entries:
        row = dict(id=e["id"], lemma=e["lemma"], headword=e.get("headword") or e["lemma"], search_key=search_key(e), kind=e["kind"],
                   cefr=e["cefr"], cefr_source=e.get("cefr_source"), pos=e.get("pos", []), variants=e.get("variants", []),
                   forms=e.get("forms", []), ipa_uk=e.get("ipa_uk"), ipa_us=e.get("ipa_us"), ipa_source=e.get("ipa_source"),
                   ipa_status=e.get("ipa_status", "missing"), ipa_curriculum=e.get("ipa_curriculum"), freq_rank=e.get("freq_rank"),
                   tier=e.get("tier"), academic=bool(e.get("academic")), topics=e.get("topics", []), topic_sources=e.get("topic_sources", []),
                   family=e.get("family", []), synonyms=e.get("synonyms", []), antonyms=e.get("antonyms", []),
                   confused_with=e.get("confused_with", []), mistakes=e.get("mistakes", []), focus=e.get("focus", []),
                   legacy_ids=e.get("legacy_ids", []), units=e.get("units", []), sources=e.get("sources", []), status=e["status"],
                   review_flags=e.get("review_flags", []), sort_order=e.get("order", 0), origin="dataset", published=True, updated_at=now)
        (rows_upd if e["id"] in existing else rows_new).append(row)
        for i, s in enumerate(e["senses"]):
            senses.append(dict(id=s["id"], entry_id=e["id"], idx=i, pos=s.get("pos"), meaning_vi=s["meaning_vi"],
                               definition_en=s.get("definition_en"), cefr=s.get("cefr"), usage=s.get("usage", []),
                               pattern=s.get("pattern"), source=s.get("source", "dataset"), status=s.get("status", "sourced"), origin="dataset"))
        for i, x in enumerate(e.get("examples", [])):
            examples.append(dict(id=x["id"], entry_id=e["id"], sense_id=x.get("sense_id"), en=x["en"], vi=x.get("vi"), source=x["source"],
                                 ref=x.get("ref"), status="curriculum" if x["source"].startswith("curriculum") else "sourced", origin="dataset", idx=i))
        for c in e.get("collocations", []):
            colls.append(dict(entry_id=e["id"], phrase=c["phrase"][:240], meaning_vi=c.get("meaning_vi"), focus=c.get("focus"),
                              linked_entry_id=c.get("entry_id"), source=c.get("source", "curriculum"), status="curriculum", origin="dataset"))
        topics += [dict(entry_id=e["id"], topic_id=t) for t in dict.fromkeys(e.get("topics", []))]
        legacy += [dict(card_id=lid, entry_id=e["id"]) for lid in e.get("legacy_ids", [])]
    if rows_new:
        db.bulk_insert_mappings(VocabEntry, rows_new)
    if rows_upd:
        db.bulk_update_mappings(VocabEntry, rows_upd)
    gone = set(db.scalars(select(VocabEntry.id).where(VocabEntry.origin == "dataset"))) - set(ids)
    for chunk in _chunks(sorted(gone), 500):
        db.execute(update(VocabEntry).where(VocabEntry.id.in_(chunk)).values(published=False))
    for model, rows in ((VocabSense, senses), (VocabExample, examples), (VocabCollocation, colls), (VocabEntryTopic, topics),
                        (VocabLegacyCard, legacy)):
        if rows:
            db.bulk_insert_mappings(model, rows)
    meta = db.get(VocabDataset, 1)
    counts |= {"inserted": len(rows_new), "updated": len(rows_upd), "unpublished": len(gone), "senses": len(senses),
               "examples": len(examples), "collocations": len(colls)}
    if meta is None:
        db.add(VocabDataset(id=1, version=version, counts=counts, imported_at=now))
    else:
        meta.version, meta.counts, meta.imported_at = version, counts, now
    db.flush()
    counts["legacy_progress_migrated"] = migrate_legacy_progress(db)
    db.commit()
    lemma_index.cache_clear()
    return counts


def migrate_legacy_progress(db: Session) -> int:
    """Copy SM-2 card progress into FSRS progress once per (user, entry). Old rows are kept untouched."""
    mapping = dict(db.execute(select(VocabLegacyCard.card_id, VocabLegacyCard.entry_id)).all())
    have = {(u, e) for u, e in db.execute(select(VocabProgress.user_id, VocabProgress.entry_id)).all()}
    n = 0
    for c in db.scalars(select(VocabCard)):
        eid = mapping.get(c.card_id)
        if eid is None or (c.user_id, eid) in have:
            continue
        p = VocabProgress(user_id=c.user_id, entry_id=eid, first_seen_at=c.last_reviewed, legacy_migrated=True, added_from="legacy")
        srs.from_sm2(p, ease=c.ease, interval_days=c.interval_days, repetitions=c.repetitions, lapses=c.lapses, due=c.due,
                     last_reviewed=c.last_reviewed)
        if c.repetitions:
            p.learned_at = p.first_correct_at = c.last_reviewed
        db.add(p)
        have.add((c.user_id, eid))
        n += 1
    db.flush()
    return n


def _chunks(xs, n):
    xs = list(xs)
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


# ------------------------------------------------------------------ lookup
@lru_cache(maxsize=1)
def lemma_index() -> dict[str, list[str]]:
    """Normalised surface form → entry ids (lemma, variants, inflected forms). Built from the dataset file."""
    _, entries = dataset()
    idx: dict[str, list[str]] = {}
    for e in entries:
        for f in [e["lemma"], *e.get("variants", []), *e.get("forms", [])]:
            k = norm(f)
            if k and e["id"] not in idx.setdefault(k, []):
                idx[k].append(e["id"])
    return idx


def guess_lemmas(word: str) -> list[str]:
    """Candidate base forms for an unseen surface form (regular inflection only)."""
    w = norm(word).strip(".,!?;:\"'()[]")
    out = [w]
    for suf, rep in (("ies", "y"), ("ied", "y"), ("ves", "f"), ("ing", ""), ("ing", "e"), ("ed", ""), ("ed", "e"), ("es", ""),
                     ("s", ""), ("er", ""), ("est", ""), ("ly", "")):
        if w.endswith(suf) and len(w) - len(suf) >= 2:
            out.append(w[: -len(suf)] + rep)
    if re.search(r"([bcdfgklmnprstvz])\1(ing|ed)$", w):  # stopped → stop
        out.append(re.sub(r"([bcdfgklmnprstvz])\1(ing|ed)$", r"\1", w))
    return list(dict.fromkeys(out))


def find_ids(text: str) -> list[str]:
    idx = lemma_index()
    t = norm(text)
    if t in idx:
        return idx[t]
    for g in guess_lemmas(t):
        if g in idx:
            return idx[g]
    return []


def folded(text: str) -> str:
    return fold(norm(text))
