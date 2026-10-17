"""Pipeline stage "Generate (AI)" → Validate → Review → Publish for headwords that open dictionaries could not fill.

Candidates come from data/pending.jsonl.gz (CEFR-J/NGSL/NAWL headwords with no Vietnamese translation in Wiktionary).
- queue:   one job row per (headword, task); re-queuing never duplicates (unique constraint)
- run:     small batches; each batch is committed (checkpoint) before the next; failed jobs keep the error and are
           retried up to MAX_ATTEMPTS; finished jobs are never sent to the AI again
- review:  results are stored with automatic validation problems; NOTHING is published until a person approves it
- approve: creates a lexicon entry (origin "ai", status "reviewed"). IPA only from the dictionary data of the candidate
           (never from the AI).

CLI (uses the configured database and OpenAI key):
  python -m app.vocabulary.enrich status | queue --limit 100 | run --batches 3 --size 8 | review | approve ID | reject ID
"""
from __future__ import annotations

import argparse
import gzip
import json
import uuid
from functools import lru_cache
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai.errors import AIError
from ..models import VocabCollocation, VocabEntry, VocabEntryTopic, VocabEnrichmentJob, VocabExample, VocabSense, utcnow
from . import lexicon
from .ai import validate_enrichment

PENDING_FILE = Path(__file__).parent / "data" / "pending.jsonl.gz"
MAX_ATTEMPTS = 3
TASK = "enrich"
LEVELS = ["A1", "A2", "B1", "B2", "C1"]


@lru_cache(maxsize=1)
def candidates() -> tuple[dict, ...]:
    if not PENDING_FILE.exists():
        return ()
    rows = [json.loads(line) for line in gzip.decompress(PENDING_FILE.read_bytes()).decode("utf-8").splitlines() if line.strip()]
    rows = [r for r in rows if r.get("kind") in ("word", "phrasal_verb") and "no_vietnamese_meaning" in r.get("review_flags", [])]
    rows.sort(key=lambda r: (LEVELS.index(r["cefr"]) if r.get("cefr") in LEVELS else 9, r.get("freq_rank") or 99999, r["lemma"]))
    return tuple(rows)


def status(db: Session) -> dict:
    by = dict(db.execute(select(VocabEnrichmentJob.status, func.count(VocabEnrichmentJob.id)).group_by(VocabEnrichmentJob.status)).all())
    return {"candidates": len(candidates()), "jobs": by, "waiting": by.get("queued", 0), "needs_review": by.get("done", 0)}


def queue(db: Session, limit: int = 50, keys: list[str] | None = None) -> int:
    have = set(db.scalars(select(VocabEnrichmentJob.entry_key).where(VocabEnrichmentJob.task == TASK)))
    n = 0
    for c in candidates():
        if keys and c["lemma"] not in keys:
            continue
        if c["lemma"] in have:
            continue
        db.add(VocabEnrichmentJob(entry_key=c["lemma"], task=TASK, status="queued", attempts=0))
        n += 1
        if n >= limit:
            break
    db.flush()
    return n


def run(db: Session, ai, user_id: int, *, batches: int = 1, size: int = 8, log=print) -> dict:
    by_key = {c["lemma"]: c for c in candidates()}
    done = failed = 0
    for _ in range(max(1, batches)):
        jobs = list(db.scalars(select(VocabEnrichmentJob).where(VocabEnrichmentJob.task == TASK,
                                                              VocabEnrichmentJob.status.in_(("queued", "failed")),
                                                              VocabEnrichmentJob.attempts < MAX_ATTEMPTS)
                               .order_by(VocabEnrichmentJob.id).limit(max(1, min(20, size)))))
        if not jobs:
            break
        batch_id = str(uuid.uuid4())
        items = []
        for j in jobs:
            c = by_key.get(j.entry_key, {"lemma": j.entry_key})
            items.append({"lemma": c["lemma"], "pos": c.get("pos"), "cefr": c.get("cefr"),
                          "glosses": [s.get("definition_en") for s in c.get("senses", []) if s.get("definition_en")]})
            j.batch_id, j.attempts = batch_id, j.attempts + 1
        try:
            out = ai.enrich(db, user_id, items=items)
        except AIError as e:
            for j in jobs:
                j.status, j.last_error = "failed", e.code
            db.commit()  # checkpoint: attempts recorded
            log(f"batch {batch_id[:8]} failed: {e.code}")
            failed += len(jobs)
            if not e.to_dict()["retryable"] or e.code == "ai_disabled":
                break
            continue
        res = {lexicon.norm(e.lemma): e for e in out.entries}
        for j in jobs:
            r = res.get(lexicon.norm(j.entry_key))
            if r is None:
                j.status, j.last_error = "failed", "missing_in_output"
                failed += 1
                continue
            problems = validate_enrichment(r, lemma=j.entry_key)
            j.result = r.model_dump()
            j.validation = {"problems": problems}
            j.model = ai.gw.settings.model("exercise")
            j.status = "done"  # = needs human review
            j.last_error = None
            done += 1
        db.commit()  # checkpoint after every batch
        log(f"batch {batch_id[:8]}: {len(jobs)} jobs")
    return {"done": done, "failed": failed} | status(db)


def review_queue(db: Session, limit: int = 50) -> list[dict]:
    jobs = db.scalars(select(VocabEnrichmentJob).where(VocabEnrichmentJob.status == "done").order_by(VocabEnrichmentJob.updated_at).limit(limit))
    return [{"id": j.id, "lemma": j.entry_key, "result": j.result, "problems": (j.validation or {}).get("problems", []), "model": j.model,
             "updated_at": j.updated_at.isoformat() if j.updated_at else None} for j in jobs]


def approve(db: Session, job_id: int) -> str:
    j = db.get(VocabEnrichmentJob, job_id)
    if j is None or j.status != "done" or not j.result:
        raise ValueError("job not reviewable")
    c = next((x for x in candidates() if x["lemma"] == j.entry_key), {"lemma": j.entry_key})
    r = j.result
    eid = c.get("id") or lexicon.norm(j.entry_key).replace(" ", "_")
    if db.get(VocabEntry, eid) is not None:
        raise ValueError("entry already exists")
    src = f"ai:{j.model or 'model'} (reviewed)"
    e = VocabEntry(id=eid, lemma=c["lemma"], headword=c["lemma"], search_key=lexicon.norm(c["lemma"]), kind=c.get("kind", "word"),
                   cefr=c.get("cefr") or r["cefr_estimate"], cefr_source=c.get("cefr_source") or "ước lượng (AI, đã rà soát)",
                   pos=list(dict.fromkeys(s["pos"] for s in r["senses"])), variants=c.get("variants", []), forms=c.get("forms", []),
                   ipa_uk=c.get("ipa_uk"), ipa_us=c.get("ipa_us"), ipa_source=c.get("ipa_source"), ipa_status=c.get("ipa_status", "missing"),
                   freq_rank=c.get("freq_rank"), tier=c.get("tier"), academic=bool(c.get("academic")), topics=c.get("topics", ["core"]),
                   topic_sources=c.get("topic_sources", []), family=r.get("word_family", [])[:6], synonyms=[], antonyms=[], confused_with=[],
                   mistakes=[{"vi": r["common_mistake_vi"], "source": src}] if r.get("common_mistake_vi") else [], focus=[], legacy_ids=[],
                   units=[], sources=(c.get("sources") or []) + [src], status="reviewed", review_flags=["ai_enriched_reviewed"],
                   sort_order=10**5 + job_id, origin="ai", published=True)
    db.add(e)
    db.flush()
    for i, s in enumerate(r["senses"][:3]):
        db.add(VocabSense(id=f"{eid}#a{i + 1}", entry_id=eid, idx=i, pos=s["pos"], meaning_vi=s["meaning_vi"], definition_en=s["definition_en"],
                          usage=[], source=src, status="reviewed", origin="ai"))
    for i, x in enumerate(r.get("examples", [])[:3]):
        db.add(VocabExample(id=f"{eid}~a{i + 1}", entry_id=eid, en=x["en"], vi=x["vi"], source=src, status="reviewed", origin="ai", idx=i))
    for ph in r.get("collocations", [])[:4]:
        db.add(VocabCollocation(entry_id=eid, phrase=ph[:240], source=src, status="reviewed", origin="ai"))
    for t in dict.fromkeys(e.topics):
        db.add(VocabEntryTopic(entry_id=eid, topic_id=t))
    j.status = "approved"
    lexicon.lemma_index.cache_clear()
    return eid


def reject(db: Session, job_id: int) -> None:
    j = db.get(VocabEnrichmentJob, job_id)
    if j is None:
        raise ValueError("no job")
    j.status = "rejected"


def main() -> None:  # pragma: no cover - CLI wrapper
    ap = argparse.ArgumentParser(prog="python -m app.vocabulary.enrich")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    q = sub.add_parser("queue")
    q.add_argument("--limit", type=int, default=50)
    r = sub.add_parser("run")
    r.add_argument("--batches", type=int, default=1)
    r.add_argument("--size", type=int, default=8)
    sub.add_parser("review")
    a = sub.add_parser("approve")
    a.add_argument("id", type=int)
    rj = sub.add_parser("reject")
    rj.add_argument("id", type=int)
    args = ap.parse_args()
    from ..ai.services import build
    from ..content.store import ContentStore
    from .. import config
    from ..database import SessionLocal, init_db
    from ..services.progress import get_user
    from .ai import VocabAI

    init_db()
    with SessionLocal() as db:
        lexicon.ensure_imported(db)
        if args.cmd == "status":
            print(json.dumps(status(db), indent=1))
        elif args.cmd == "queue":
            print(queue(db, args.limit), "queued")
            db.commit()
        elif args.cmd == "run":
            store = ContentStore(config.CONTENT_ROOT)
            svc = build(store, SessionLocal)
            ai = VocabAI(svc.gateway, svc.kb)
            print(json.dumps(run(db, ai, get_user(db).id, batches=args.batches, size=args.size), indent=1))
            svc.gateway.flush_logs()
        elif args.cmd == "review":
            print(json.dumps(review_queue(db), ensure_ascii=False, indent=1))
        elif args.cmd == "approve":
            print(approve(db, args.id))
            db.commit()
        elif args.cmd == "reject":
            reject(db, args.id)
            db.commit()


if __name__ == "__main__":  # pragma: no cover
    main()
