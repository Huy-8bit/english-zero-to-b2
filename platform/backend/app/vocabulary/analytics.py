"""Vocabulary analytics from stored progress and review history (estimates, never absolute measurements)."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import VocabEntry, VocabEntryTopic, VocabProgress, VocabReviewLog, VocabTopic, utcnow
from . import lexicon, srs
from .exercises import RECALL_TYPES
from .service import visible

LEVELS = ["A1", "A2", "B1", "B2"]


def stats(db: Session, user_id: int) -> dict:
    lexicon.ensure_imported(db)
    now = utcnow()
    totals_level = dict(db.execute(select(VocabEntry.cefr, func.count(VocabEntry.id)).where(visible(user_id)).group_by(VocabEntry.cefr)).all())
    total = sum(totals_level.values())
    topic_totals = dict(db.execute(select(VocabEntryTopic.topic_id, func.count(VocabEntryTopic.entry_id)).join(VocabEntry, VocabEntry.id == VocabEntryTopic.entry_id)
                                   .where(visible(user_id)).group_by(VocabEntryTopic.topic_id)).all())
    topics = list(db.scalars(select(VocabTopic).order_by(VocabTopic.sort_order)))
    rows = list(db.execute(select(VocabProgress, VocabEntry.cefr, VocabEntry.kind).join(VocabEntry, VocabEntry.id == VocabProgress.entry_id)
                           .where(VocabProgress.user_id == user_id)).all())
    topic_of = defaultdict(list)
    ids = [p.entry_id for p, _, _ in rows]
    for i in range(0, len(ids), 400):
        for eid, tid in db.execute(select(VocabEntryTopic.entry_id, VocabEntryTopic.topic_id).where(VocabEntryTopic.entry_id.in_(ids[i:i + 400]))):
            topic_of[eid].append(tid)
    c = defaultdict(int)
    by_level = {lv: {"total": totals_level.get(lv, 0), "encountered": 0, "learned": 0, "mastered": 0} for lv in LEVELS}
    by_topic = {t.id: {"id": t.id, "name_vi": t.name_vi, "total": topic_totals.get(t.id, 0), "encountered": 0, "learned": 0, "mastered": 0} for t in topics}
    retr = []
    coll = {"total": 0, "learned": 0, "mastered": 0}
    for p, cefr, kind in rows:
        seen = p.first_seen_at is not None
        practiced = (p.correct_count or 0) + (p.incorrect_count or 0) > 0
        mastered = srs.is_mastered(p)
        c["encountered"] += seen
        c["practiced"] += practiced
        c["learned"] += p.learned_at is not None
        c["answered_correctly"] += p.first_correct_at is not None
        c["recalled_after_delay"] += p.recalled_after_delay_at is not None
        c["used_correctly"] += p.used_correctly_at is not None
        c["used_writing"] += (p.used_in or {}).get("writing", 0) > 0
        c["used_speaking"] += (p.used_in or {}).get("speaking", 0) > 0
        c["mastered"] += mastered
        c["saved"] += p.saved
        c["difficult"] += p.difficult
        c["known"] += p.known
        if p.state != "new" and not p.suspended and not p.known:
            c["in_schedule"] += 1
            if p.due and p.due <= now:
                c["due"] += 1
            if p.state == "relearning" or (p.lapses or 0) > 0 and p.last_rating == 1:
                c["forgotten"] += 1
            if p.state == "review" and (r := srs.retrievability(p, now)) is not None:
                retr.append(r)
        if cefr in by_level:
            by_level[cefr]["encountered"] += seen
            by_level[cefr]["learned"] += p.learned_at is not None
            by_level[cefr]["mastered"] += mastered
        for tid in topic_of.get(p.entry_id, []):
            if tid in by_topic:
                by_topic[tid]["encountered"] += seen
                by_topic[tid]["learned"] += p.learned_at is not None
                by_topic[tid]["mastered"] += mastered
        if kind == "collocation":
            coll["total"] += 1
            coll["learned"] += p.learned_at is not None
            coll["mastered"] += mastered
    since = now - timedelta(days=30)
    logs = list(db.execute(select(VocabReviewLog.mode, VocabReviewLog.correct, VocabReviewLog.reviewed_at, VocabReviewLog.rating)
                           .where(VocabReviewLog.user_id == user_id, VocabReviewLog.reviewed_at >= since, VocabReviewLog.correct.is_not(None))).all())
    graded = [l for l in logs if not l.mode.startswith("use:")]
    recall = [l for l in graded if l.mode in RECALL_TYPES]
    coll_logs = [l for l in graded if l.mode == "collocation"]
    def local_day(dt):  # stored times are naive UTC; the learner's day is the server's local day
        return dt.replace(tzinfo=timezone.utc).astimezone().date()
    days = {}
    today_local = datetime.now().astimezone().date()
    for i in range(13, -1, -1):
        d = today_local - timedelta(days=i)
        days[d.isoformat()] = {"date": d.isoformat(), "reviews": 0, "correct": 0, "scheduled": 0}
    for l in graded:
        k = local_day(l.reviewed_at).isoformat()
        if k in days:
            days[k]["reviews"] += 1
            days[k]["correct"] += bool(l.correct)
            days[k]["scheduled"] += l.rating is not None
    return {
        "total_available": total, "by_level_total": totals_level,
        "counts": dict(c),
        "recall_accuracy": (sum(1 for l in recall if l.correct) / len(recall)) if recall else None,
        "overall_accuracy": (sum(1 for l in graded if l.correct) / len(graded)) if graded else None,
        "graded_30d": len(graded), "recall_30d": len(recall),
        "estimated_retention": (sum(retr) / len(retr)) if retr else None, "retention_cards": len(retr),
        "by_level": by_level, "by_topic": [v for v in by_topic.values() if v["total"]],
        "collocations": coll | {"accuracy": (sum(1 for l in coll_logs if l.correct) / len(coll_logs)) if coll_logs else None,
                                "attempts_30d": len(coll_logs)},
        "daily": list(days.values()),
        "algorithm": srs.ALGORITHM,
        "notes_vi": "Các chỉ số ghi nhớ và mastery là ước lượng từ lịch sử ôn tập (FSRS), không phải thước đo tuyệt đối.",
    }


def recent(db: Session, user_id: int, limit: int = 8) -> dict:
    learned = list(db.execute(select(VocabProgress.entry_id, VocabEntry.lemma, VocabProgress.learned_at).join(VocabEntry, VocabEntry.id == VocabProgress.entry_id)
                              .where(VocabProgress.user_id == user_id, VocabProgress.learned_at.is_not(None)).order_by(VocabProgress.learned_at.desc()).limit(limit)).all())
    forgotten = list(db.execute(select(VocabProgress.entry_id, VocabEntry.lemma, VocabProgress.last_review).join(VocabEntry, VocabEntry.id == VocabProgress.entry_id)
                                .where(VocabProgress.user_id == user_id, VocabProgress.last_rating == 1).order_by(VocabProgress.last_review.desc()).limit(limit)).all())
    return {"learned": [{"entry_id": a, "lemma": b, "at": c.isoformat()} for a, b, c in learned],
            "forgotten": [{"entry_id": a, "lemma": b, "at": c.isoformat() if c else None} for a, b, c in forgotten]}
