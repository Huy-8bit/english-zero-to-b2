"""Learning sessions, the daily plan and adaptive difficulty.

Scheduling rule (keeps FSRS meaningful): a word gets at most ONE FSRS review per session round. All graded items of
that word in the round are aggregated (worst result wins). Only words that are new, in (re)learning, or due today
are scheduled; extra practice on not-yet-due words is logged (mistakes, analytics) but does not move the schedule.
A word that was forgotten (Again) gets one retry round at the end of the session.
"""
from __future__ import annotations

import base64
import json
import math
import random
import statistics
import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..models import (LessonProgress, VocabEntry, VocabEntryTopic, VocabMistake, VocabProgress, VocabReviewLog, VocabSession,
                      utcnow)
from ..services import progress as P
from . import exercises as X
from . import lexicon, srs
from .grading import CORRECTISH, SCHEDULE_RATING, grade_order, grade_translation, grade_typed
from .service import day_bounds, get_progress, mark_seen, settings, visible

LEVELS = ["A1", "A2", "B1", "B2", "C1"]
MODES = {
    "daily": "Kế hoạch hôm nay", "review": "Ôn từ đến hạn", "learn": "Học từ mới", "sprint": "Học cấp tốc · đợt 10 từ", "translate": "Luyện viết: dịch câu Việt → Anh", "flashcards": "Flashcards",
    "type": "Gõ đáp án", "dictation": "Nghe – chép chính tả", "context": "Từ trong ngữ cảnh", "collocation": "Collocation",
    "builder": "Sắp xếp câu", "use": "Tự đặt câu (AI chấm)", "speed": "Ôn nhanh", "weak": "Ôn từ khó", "custom": "Luyện theo bộ từ",
    "gaps": "Ôn lỗ hổng từ vựng",
}
SECONDS_DEFAULT = {"learn": 25, "flashcard": 8, "mc_meaning": 7, "mc_word": 7, "type_word": 12, "dictation": 14, "cloze": 12,
                   "collocation": 9, "builder": 20, "confusable": 10, "listen_choose": 8, "use_it": 60}


# ------------------------------------------------------------------ adaptive profile
def profile(db: Session, user_id: int) -> dict:
    """support | steady | stretch from recent graded results. Needs ≥ 15 results in 14 days before changing anything."""
    since = utcnow() - timedelta(days=14)
    rows = list(db.execute(select(VocabReviewLog.correct).where(VocabReviewLog.user_id == user_id, VocabReviewLog.reviewed_at >= since,
                                                                VocabReviewLog.correct.is_not(None), VocabReviewLog.mode.not_like("use:%"))
                           .order_by(VocabReviewLog.reviewed_at.desc()).limit(80)).scalars())
    n = len(rows)
    acc = sum(1 for r in rows if r) / n if n else None
    if n < 15:
        name, why = "steady", "Chưa đủ dữ liệu (cần ≥ 15 câu trả lời trong 14 ngày) — giữ mức mặc định."
    elif acc < 0.7:
        name, why = "support", f"Độ chính xác gần đây {acc:.0%} < 70%: ít từ mới hơn, câu ví dụ ngắn, có gợi ý, nhiều bài nhận diện."
    elif acc >= 0.85 and n >= 30:
        name, why = "stretch", f"Độ chính xác {acc:.0%} trên {n} câu: bỏ gợi ý, tăng gõ đáp án, ngữ cảnh, collocation và tự đặt câu."
    else:
        name, why = "steady", f"Độ chính xác gần đây {acc:.0%}."
    return {"name": name, "accuracy": acc, "samples": n, "reason_vi": why}


def due_query(user_id: int, until: datetime):
    return (select(VocabProgress).join(VocabEntry, VocabEntry.id == VocabProgress.entry_id)
            .where(VocabProgress.user_id == user_id, VocabProgress.state != "new", VocabProgress.due <= until,
                   VocabProgress.suspended.is_(False), VocabProgress.known.is_(False), VocabEntry.published.is_(True)))


def learner_levels(db: Session, user_id: int) -> list[str]:
    s = settings(db, user_id)
    lvl = s.get("level")
    if not lvl:  # learner's choice → AI placement estimate → beginner
        from ..models import LearningProfile

        prof = db.get(LearningProfile, user_id)
        lvl = ((prof.preferences or {}).get("placement") or {}).get("level") if prof else None
    lvl = lvl if lvl in LEVELS else "A1" if lvl in ("A0", None) else "B2"
    return LEVELS[: LEVELS.index(lvl) + 2]  # own level + one above (new words are ordered easiest first anyway)


def new_candidates(db: Session, user_id: int, n: int, *, topic: str | None = None, level: str | None = None,
                   collection: int | None = None, entry_ids: list[str] | None = None) -> list[str]:
    if n <= 0:
        return []
    lexicon.ensure_imported(db)
    started = select(VocabProgress.entry_id).where(VocabProgress.user_id == user_id,
                                                   (VocabProgress.state != "new") | VocabProgress.known.is_(True) | VocabProgress.suspended.is_(True))
    base = select(VocabEntry.id).where(visible(user_id), VocabEntry.id.not_in(started), VocabEntry.kind != "pattern")
    if entry_ids:
        base = base.where(VocabEntry.id.in_(entry_ids))
    if topic:
        base = base.where(VocabEntry.id.in_(select(VocabEntryTopic.entry_id).where(VocabEntryTopic.topic_id == topic)))
    if level:
        base = base.where(VocabEntry.cefr == level)
    if collection:
        from ..models import VocabCollectionItem

        base = base.where(VocabEntry.id.in_(select(VocabCollectionItem.entry_id).where(VocabCollectionItem.collection_id == collection)))
    out: list[str] = []
    # 1) words the learner chose (saved / captured from Reading, Writing…) but has not started
    chosen = select(VocabProgress.entry_id).where(VocabProgress.user_id == user_id, VocabProgress.state == "new", VocabProgress.saved.is_(True),
                                                  VocabProgress.known.is_(False))
    out += list(db.scalars(base.where(VocabEntry.id.in_(chosen)).order_by(VocabEntry.sort_order).limit(n)))
    # 2) words from curriculum lessons the learner has opened
    if len(out) < n and not (topic or level or collection or entry_ids):
        opened = [u for u, in db.execute(select(LessonProgress.unit_id).where(LessonProgress.user_id == user_id))]
        if opened:
            for eid, units in db.execute(base.add_columns(VocabEntry.units).where(VocabEntry.id.not_in(out)).order_by(VocabEntry.sort_order)):
                if set(units or []) & set(opened):
                    out.append(eid)
                    if len(out) >= n:
                        break
    # 3) next words in learning order (level → basic topics first → frequency), within the learner's levels
    if len(out) < n:
        q = base.where(VocabEntry.id.not_in(out))
        if not (level or entry_ids or collection):
            q = q.where(VocabEntry.cefr.in_(learner_levels(db, user_id)))
        out += list(db.scalars(q.order_by(VocabEntry.sort_order).limit(n - len(out))))
    return out[:n]


def weak_entries(db: Session, user_id: int, limit: int = 10, exclude: set[str] = frozenset()) -> list[VocabProgress]:
    rows = list(db.scalars(select(VocabProgress).where(VocabProgress.user_id == user_id, VocabProgress.state != "new",
                                                       VocabProgress.suspended.is_(False), VocabProgress.known.is_(False))))
    open_mistakes = dict(db.execute(select(VocabMistake.entry_id, func.count(VocabMistake.id)).where(
        VocabMistake.user_id == user_id, VocabMistake.resolved_at.is_(None)).group_by(VocabMistake.entry_id)).all())

    def score(p):
        return (p.difficult * 3 + (p.lapses or 0) * 2 + open_mistakes.get(p.entry_id, 0)
                + (2 if (p.incorrect_count or 0) > (p.correct_count or 0) else 0))
    weak = [p for p in rows if p.entry_id not in exclude and score(p) >= 2]
    weak.sort(key=score, reverse=True)
    return weak[:limit]


# ------------------------------------------------------------------ plan
BATCH = 10  # new words per batch: small enough to remember, ~7–9 minutes


def sprint_candidates(db: Session, user_id: int, n: int = 15) -> dict:
    """Next new words for one batch, kept to one topic when possible (a shared scene is easier to remember)."""
    from .topics import TOPICS

    pool = new_candidates(db, user_id, max(n * 4, 40))
    if not pool:
        return {"topic": None, "entry_ids": []}
    rows = db.execute(select(VocabEntryTopic.entry_id, VocabEntryTopic.topic_id).where(VocabEntryTopic.entry_id.in_(pool))).all()
    topics: dict[str, list[str]] = {}
    for eid, tid in rows:
        topics.setdefault(tid, []).append(eid)
    # the topic of the most urgent words (first in learning order), "core" (general words) only as a fallback
    head = pool[: n]
    best = max((t for t in topics if t != "core"), key=lambda t: (sum(1 for e in head if e in topics[t]), len(topics[t])), default=None)
    chosen = [e for e in pool if best and e in topics[best]][:n] if best and len(topics[best]) >= 5 else []
    chosen += [e for e in pool if e not in chosen][: n - len(chosen)]
    name = next((t["name_vi"] for t in TOPICS if t["id"] == best), None) if len(chosen) and best and sum(e in topics[best] for e in chosen) >= 5 else None
    return {"topic": name, "entry_ids": chosen}


def sprint_status(db: Session, user_id: int) -> dict:
    """Intensive mode: today's batches, the next batch to triage, and the real review load ahead (from the FSRS schedule)."""
    pl = plan(db, user_id)
    goal = int(pl["settings"]["daily_new"])
    nxt = sprint_candidates(db, user_id, 15) if pl["new_left"] else {"topic": None, "entry_ids": []}
    bundles = X.load_bundles(db, nxt["entry_ids"])
    def meanings(b: X.Bundle) -> str:
        # the first two senses with their part of speech (e.g. "can": danh từ "lon" · động từ "có thể")
        parts = [f"({X.POS_VI.get(sn.pos or '', sn.pos or '')}) {X.short_meaning(sn.meaning_vi, 40)}" if sn.pos else X.short_meaning(sn.meaning_vi, 40)
                 for sn in b.senses[:2]]
        return " · ".join(dict.fromkeys(parts)) or X.short_meaning(b.meaning)
    words = [{"entry_id": i, "word": b.e.headword or b.e.lemma, "ipa": b.e.ipa_uk or b.e.ipa_us, "pos_vi": X.POS_VI.get(b.pos, b.pos),
              "meaning_vi": meanings(b), "cefr": b.e.cefr} for i in nxt["entry_ids"] if (b := bundles.get(i))]
    start, _ = day_bounds()
    forecast, before = [], 0
    for d in range(7):
        until = start + timedelta(days=d + 1)
        n = db.scalar(select(func.count()).select_from(due_query(user_id, until).subquery())) or 0
        # reviews that fall on that day (today also includes everything already overdue)
        forecast.append({"day": (P.today() + timedelta(days=d)).isoformat(), "reviews": n - before})
        before = n
    per = pl["per_item_seconds"] or 9
    batch_min = round((BATCH * (SECONDS_DEFAULT["learn"] + 3 * per)) / 60)
    return {"goal": goal, "learned_today": pl["new_today"], "new_left": pl["new_left"], "batch_size": BATCH,
            "batches_total": math.ceil(goal / BATCH) if goal else 0, "batches_done": pl["new_today"] // BATCH,
            "minutes_per_batch": batch_min, "minutes_left": round(math.ceil(pl["new_left"] / BATCH) * batch_min),
            "due_now": pl["due_now"], "backlog": pl["backlog"], "review_forecast": forecast, "adjustments_vi": pl["adjustments_vi"],
            "next": {"topic": nxt["topic"], "words": words}}


def plan(db: Session, user_id: int) -> dict:
    lexicon.ensure_imported(db)
    s = settings(db, user_id)
    prof = profile(db, user_id)
    now = utcnow()
    _, end = day_bounds()
    due_now = db.scalar(select(func.count()).select_from(due_query(user_id, now).subquery())) or 0
    due_today = db.scalar(select(func.count()).select_from(due_query(user_id, end).subquery())) or 0
    start, _ = day_bounds()
    new_today = db.scalar(select(func.count(VocabProgress.id)).where(VocabProgress.user_id == user_id, VocabProgress.first_seen_at >= start,
                                                                    VocabProgress.reps > 0, VocabProgress.legacy_migrated.is_(False))) or 0
    goal = int(s["daily_new"])
    reasons = []
    if prof["name"] == "support":
        goal = max(2, goal // 2)
        reasons.append("Giảm từ mới vì độ chính xác gần đây thấp.")
    # reviews left over from earlier days come first; today's own learning-step reviews do not block new words
    # (otherwise an intensive learner, e.g. 100 words/day, could never start the next batch)
    backlog = db.scalar(select(func.count()).select_from(due_query(user_id, start).subquery())) or 0
    limit = max(40, goal)
    if backlog > limit:
        cut = min(goal, (backlog - limit) // 10 + 1)
        goal -= cut
        reasons.append(f"Còn {backlog} từ quá hạn ôn từ những ngày trước — ưu tiên ôn trước, bớt {cut} từ mới.")
    new_left = max(0, goal - new_today)
    weak = weak_entries(db, user_id, limit=8)
    learned_with_colls = db.scalar(select(func.count(VocabProgress.id)).join(VocabEntry, VocabEntry.id == VocabProgress.entry_id).where(
        VocabProgress.user_id == user_id, VocabProgress.state != "new", VocabEntry.kind == "collocation")) or 0
    colloc = min(5, learned_with_colls) if learned_with_colls else 0
    durations = list(db.scalars(select(VocabReviewLog.duration_ms).where(VocabReviewLog.user_id == user_id, VocabReviewLog.duration_ms.is_not(None),
                                                                         VocabReviewLog.duration_ms < 180000).order_by(VocabReviewLog.reviewed_at.desc()).limit(200)))
    per_item = statistics.median(durations) / 1000 if len(durations) >= 10 else None
    est = (min(due_today, 40) * (per_item or SECONDS_DEFAULT["flashcard"]) + new_left * (3 * (per_item or 10) + SECONDS_DEFAULT["learn"])
           + len(weak[:5]) * (per_item or SECONDS_DEFAULT["type_word"]) + (colloc + 3) * (per_item or SECONDS_DEFAULT["cloze"]))
    tasks = []
    if due_today:
        tasks.append({"key": "review", "label_vi": f"Ôn {min(due_today, 40)} từ đến hạn", "count": min(due_today, 40)})
    if new_left:
        tasks.append({"key": "learn", "count": new_left, "label_vi": f"Học {new_left} từ mới" + (
            f" ({math.ceil(new_left / BATCH)} đợt × {BATCH} từ)" if new_left > BATCH else "")})
    if weak:
        tasks.append({"key": "weak", "label_vi": f"Luyện lại {min(5, len(weak))} từ hay quên", "count": min(5, len(weak))})
    if colloc:
        tasks.append({"key": "collocation", "label_vi": f"Luyện {colloc} collocation", "count": colloc})
    if due_today or new_left or weak:
        tasks.append({"key": "context", "label_vi": "1 bài trắc nghiệm ngữ cảnh ngắn", "count": 1})
    return {"new_goal": goal, "new_left": new_left, "new_today": new_today, "due_now": due_now, "due_today": due_today, "backlog": backlog,
            "weak": [p.entry_id for p in weak], "collocations": colloc, "tasks": tasks, "minutes": max(1, round(est / 60)) if tasks else 0,
            "per_item_seconds": per_item, "profile": prof, "adjustments_vi": reasons, "settings": s}


# ------------------------------------------------------------------ building sessions
class SessionBuilder:
    def __init__(self, db: Session, user_id: int, kind: str, params: dict):
        self.db, self.user_id, self.kind, self.params = db, user_id, kind, params
        self.seed = random.randrange(1 << 30)
        self.rng = random.Random(self.seed)
        self.prof = profile(db, user_id)
        self.support = self.prof["name"] == "support"
        self.stretch = self.prof["name"] == "stretch"
        self.items: list[dict] = []
        self.bundles: dict[str, X.Bundle] = {}
        self.sched: dict[str, bool] = {}
        self._pool = None
        self._known_colls = None

    def pool(self) -> X.DistractorPool:
        if self._pool is None:
            levels = sorted({b.e.cefr for b in self.bundles.values() if b.e.cefr} | {"A1", "A2"}, key=LEVELS.index)
            self._pool = X.DistractorPool(self.db, levels or LEVELS, set(self.bundles), self.seed)
        return self._pool

    def known_collocations(self) -> set[str]:
        if self._known_colls is None:
            from ..models import VocabCollocation
            from .grading import alternatives, clean

            ks = set()
            for (ph,) in self.db.execute(select(VocabCollocation.phrase)):
                ks |= {clean(a) for a in alternatives(ph)}
            for (lem,) in self.db.execute(select(VocabEntry.lemma).where(VocabEntry.kind == "collocation")):
                ks |= {clean(a) for a in alternatives(lem)}
            self._known_colls = ks
        return self._known_colls

    def load(self, ids: list[str]) -> None:
        missing = [i for i in ids if i not in self.bundles]
        self.bundles |= X.load_bundles(self.db, missing)

    def add(self, it: dict | None, *, round_: int = 1) -> bool:
        if it is None:
            return False
        it["round"] = round_
        it["scheduled"] = self.sched.get(it["entry_id"], False) and it["type"] in X.SCHEDULING_TYPES
        self.items.append(it)
        return True

    def schedulable(self, ids: list[str]) -> None:
        _, end = day_bounds()
        prog = {p.entry_id: p for p in self.db.scalars(select(VocabProgress).where(VocabProgress.user_id == self.user_id, VocabProgress.entry_id.in_(ids)))}
        for i in ids:
            p = prog.get(i)
            self.sched[i] = (p is None or p.state in ("new", "learning", "relearning") or (p.due is not None and p.due <= end)) \
                and not (p and (p.suspended or p.known))

    # item recipes ---------------------------------------------------------------
    def review_item(self, b: X.Bundle) -> dict | None:
        if self.support:
            return X.flashcard(b, prefer_short=True)
        choice = self.rng.random()
        if self.stretch and choice < 0.6:
            return X.type_word(b, hint=False) if choice < 0.35 else (X.cloze(b, self.pool(), prefer_short=False) or X.type_word(b, hint=False))
        return X.flashcard(b, prefer_short=self.support) if choice < 0.7 else X.type_word(b, hint=not self.stretch)

    def teach(self, ids: list[str]) -> None:
        """Mode 1 sequence: teach → recognise; recall of each word comes one word later (interleaving)."""
        pending_recall = None
        for i in ids:
            b = self.bundles.get(i)
            if b is None:
                continue
            self.add(X.learn(b, prefer_short=self.support))
            self.add(X.mc_meaning(b, self.pool()) or X.mc_word(b, self.pool()))
            if pending_recall:
                self.add(X.type_word(pending_recall, hint=not self.stretch))
            pending_recall = b
        if pending_recall:
            self.add(X.type_word(pending_recall, hint=not self.stretch))

    def build(self) -> list[dict]:
        k, prm = self.kind, self.params
        size = max(3, min(40, int(prm.get("size") or 0) or (10 if k in ("learn",) else 15)))
        filters = {"topic": prm.get("topic"), "level": prm.get("level"), "collection": prm.get("collection"), "entry_ids": prm.get("entry_ids")}
        has_filter = any(filters.values())
        now = utcnow()
        _, end = day_bounds()
        due_ids = [p.entry_id for p in self.db.scalars(due_query(self.user_id, end).order_by(VocabProgress.due).limit(200))]
        if has_filter:
            allowed = set(self._filtered_ids(filters))
            due_ids = [i for i in due_ids if i in allowed]
        if k == "daily":
            pl = plan(self.db, self.user_id)
            due = due_ids[:40]
            new = new_candidates(self.db, self.user_id, min(pl["new_left"], BATCH), **filters)  # one batch per session
            weak = [p.entry_id for p in weak_entries(self.db, self.user_id, 5, exclude=set(due) | set(new))]
            ids = due + new + weak
            self.load(ids)
            self.schedulable(ids)
            for i in due:
                if i in self.bundles:
                    self.add(self.review_item(self.bundles[i]))
            self.teach(new)
            for i in weak:
                if i in self.bundles:
                    self.add(X.type_word(self.bundles[i], hint=self.support) if not self.stretch else (X.cloze(self.bundles[i], self.pool(), prefer_short=False) or X.type_word(self.bundles[i], hint=False)))
            ctx_targets = (new + weak + due)[:3]
            for i in ctx_targets:
                b = self.bundles.get(i)
                if b:
                    self.add(X.cloze(b, self.pool(), prefer_short=self.support) or X.collocation(b, self.pool(), self.known_collocations()))
            coll_ids = [i for i in ids if self.bundles.get(i) and (self.bundles[i].colls or self.bundles[i].e.kind == "collocation")][:pl["collocations"] or 0]
            for i in coll_ids:
                self.add(X.collocation(self.bundles[i], self.pool(), self.known_collocations()))
        elif k == "review":
            ids = due_ids[:size if prm.get("size") else 40]
            self.load(ids)
            self.schedulable(ids)
            for i in ids:
                if i in self.bundles:
                    self.add(self.review_item(self.bundles[i]))
        elif k == "sprint":
            # one batch: words from one topic (given after triage, or chosen here) → teach → recognise → recall,
            # then a last shuffled listening round (spacing inside the session)
            ids = prm.get("entry_ids") or sprint_candidates(self.db, self.user_id, BATCH)["entry_ids"]
            ids = new_candidates(self.db, self.user_id, len(ids), entry_ids=ids) if prm.get("entry_ids") else ids
            self.load(ids)
            self.schedulable(ids)
            self.teach(ids)
            for i in self.rng.sample(ids, len(ids)):
                b = self.bundles.get(i)
                if b:
                    self.add(X.listen_choose(b, self.pool()) or X.mc_word(b, self.pool()), round_=2)
        elif k == "translate":
            # writing practice with words already studied (recent first); practice only — it never moves the FSRS schedule
            pool = prm.get("entry_ids") or [p.entry_id for p in self.db.scalars(select(VocabProgress).where(
                VocabProgress.user_id == self.user_id, VocabProgress.state != "new", VocabProgress.suspended.is_(False))
                .order_by(VocabProgress.last_review.desc().nulls_last()).limit(120))]
            self.load(pool)
            for i in pool:
                b = self.bundles.get(i)
                if b and self.add(X.translate(b)) and len(self.items) >= size:
                    break
        elif k == "learn":
            ids = new_candidates(self.db, self.user_id, size if prm.get("size") else (5 if self.support else 8), **filters)
            self.load(ids)
            self.schedulable(ids)
            self.teach(ids)
        elif k == "gaps":
            # everything still missing: due today, answered wrong and unresolved, weak — retrieval + discrimination
            wrong = [eid for (eid,) in self.db.execute(select(VocabMistake.entry_id).where(
                VocabMistake.user_id == self.user_id, VocabMistake.resolved_at.is_(None)).group_by(VocabMistake.entry_id)
                .order_by(func.max(VocabMistake.created_at).desc()).limit(20))]
            weak = [p.entry_id for p in weak_entries(self.db, self.user_id, 15)]
            ids = list(dict.fromkeys(due_ids[:25] + wrong + weak))[: (size if prm.get("size") else 30)]
            self.load(ids)
            self.schedulable(ids)
            forms = {b.e.lemma.lower(): b.forms for b in self.bundles.values()}
            for i in ids:
                b = self.bundles.get(i)
                if b is None:
                    continue
                if i in wrong or i in weak:
                    self.add(X.confusable(b, self.rng, forms) or X.cloze(b, self.pool(), prefer_short=self.support) or X.mc_word(b, self.pool()))
                    self.add(X.type_word(b, hint=self.support))
                else:
                    self.add(self.review_item(b))
        elif k == "weak":
            ids = [p.entry_id for p in weak_entries(self.db, self.user_id, size)]
            self.load(ids)
            self.schedulable(ids)
            forms = {b.e.lemma.lower(): b.forms for b in self.bundles.values()}
            for i in ids:
                b = self.bundles[i]
                self.add(X.confusable(b, self.rng, forms) or X.cloze(b, self.pool(), prefer_short=True))
                self.add(X.type_word(b, hint=self.support))
        else:
            ids = self._practice_ids(due_ids, size, filters)
            self.load(ids)
            self.schedulable(ids)
            for i in ids:
                b = self.bundles.get(i)
                if b is None:
                    continue
                if k == "flashcards":
                    self.add(X.flashcard(b, prefer_short=self.support))
                elif k == "type":
                    self.add(X.type_word(b, hint=self.support))
                elif k == "dictation":
                    self.add(X.dictation(b))
                elif k == "context":
                    self.add(X.cloze(b, self.pool(), prefer_short=self.support))
                elif k == "collocation":
                    self.add(X.collocation(b, self.pool(), self.known_collocations()))
                elif k == "builder":
                    self.add(X.builder(b, self.rng, prefer_short=self.support))
                elif k == "use":
                    self.add(X.use_it(b))
                elif k == "speed":
                    maker = self.rng.choice([lambda: X.mc_meaning(b, self.pool()), lambda: X.mc_word(b, self.pool()),
                                             lambda: X.listen_choose(b, self.pool()), lambda: X.type_word(b, hint=False),
                                             lambda: X.cloze(b, self.pool(), prefer_short=True)])
                    self.add(maker() or X.mc_meaning(b, self.pool()))
                elif k == "custom":
                    self.add(self.review_item(b) if self.sched.get(i) else (X.cloze(b, self.pool(), prefer_short=self.support) or X.type_word(b, hint=self.support)))
        return self.items

    def _filtered_ids(self, f: dict) -> list[str]:
        q = select(VocabEntry.id).where(visible(self.user_id))
        if f.get("entry_ids"):
            q = q.where(VocabEntry.id.in_(f["entry_ids"]))
        if f.get("topic"):
            q = q.where(VocabEntry.id.in_(select(VocabEntryTopic.entry_id).where(VocabEntryTopic.topic_id == f["topic"])))
        if f.get("level"):
            q = q.where(VocabEntry.cefr == f["level"])
        if f.get("collection"):
            from ..models import VocabCollectionItem

            q = q.where(VocabEntry.id.in_(select(VocabCollectionItem.entry_id).where(VocabCollectionItem.collection_id == f["collection"])))
        return list(self.db.scalars(q.limit(5000)))

    def _practice_ids(self, due_ids: list[str], size: int, filters: dict) -> list[str]:
        """Practice modes: due words first, then studied words (weakest / oldest review first), then new words."""
        allowed = set(self._filtered_ids(filters)) if any(filters.values()) else None
        studied = [p.entry_id for p in self.db.scalars(select(VocabProgress).where(
            VocabProgress.user_id == self.user_id, VocabProgress.state != "new", VocabProgress.suspended.is_(False))
            .order_by(VocabProgress.stability.asc().nulls_first(), VocabProgress.last_review))]
        ids = []
        for i in due_ids + studied:
            if i not in ids and (allowed is None or i in allowed):
                ids.append(i)
        if self.kind == "collocation":
            with_c = set(self.db.scalars(select(VocabEntry.id).where(VocabEntry.id.in_(ids + list(allowed or [])),
                                                                      VocabEntry.kind == "collocation")))
            from ..models import VocabCollocation

            with_c |= set(self.db.scalars(select(VocabCollocation.entry_id).where(VocabCollocation.focus.is_not(None))))
            ids = [i for i in ids if i in with_c]
            if len(ids) < size:
                extra = select(VocabEntry.id).where(visible(self.user_id), VocabEntry.id.in_(with_c), VocabEntry.id.not_in(ids))
                if allowed is not None:
                    extra = extra.where(VocabEntry.id.in_(allowed))
                ids += list(self.db.scalars(extra.order_by(VocabEntry.sort_order).limit(size - len(ids))))
        if len(ids) < size:
            ids += new_candidates(self.db, self.user_id, size - len(ids), **filters)
        return ids[:size]


# ------------------------------------------------------------------ session service
class SessionService:
    def __init__(self, ai=None, gateway=None):
        self.ai = ai
        self.gw = gateway

    def create(self, db: Session, user_id: int, kind: str, params: dict) -> VocabSession:
        if kind not in MODES:
            raise ValueError("unknown mode")
        lexicon.ensure_imported(db)
        # one active session per kind: finishing the old one applies its answered words, nothing is lost
        for old in db.scalars(select(VocabSession).where(VocabSession.user_id == user_id, VocabSession.status == "active", VocabSession.kind == kind)):
            self.finish(db, user_id, old)
        b = SessionBuilder(db, user_id, kind, params)
        items = b.build()
        s = VocabSession(id=str(uuid.uuid4()), user_id=user_id, kind=kind, params={**params, "profile": b.prof["name"],
                         "timed": bool(settings(db, user_id).get("timed_speed")) and kind == "speed"}, items=items, results={},
                         status="active" if items else "finished")
        if not items:
            s.summary = self._summary(db, user_id, s)
            s.finished_at = utcnow()
        db.add(s)
        db.flush()
        return s

    def public(self, s: VocabSession) -> dict:
        res = s.results or {}
        answered = [i for i, it in enumerate(s.items) if it["id"] in res]
        cursor = next((i for i, it in enumerate(s.items) if it["id"] not in res), len(s.items))
        return {"id": s.id, "kind": s.kind, "title_vi": MODES.get(s.kind, s.kind), "status": s.status, "params": s.params,
                "items": [X.public_item(it) for it in s.items], "results": res, "cursor": cursor, "answered": len(answered),
                "total": len(s.items), "summary": s.summary, "created_at": s.created_at.isoformat() if s.created_at else None}

    def item(self, s: VocabSession, item_id: str) -> dict:
        it = next((x for x in s.items if x["id"] == item_id), None)
        if it is None:
            raise KeyError(item_id)
        return it

    # ------------------------------------------------------------ answering
    def answer(self, db: Session, user_id: int, s: VocabSession, item_id: str, payload: dict) -> dict:
        it = self.item(s, item_id)
        res = dict(s.results or {})
        if item_id in res:  # idempotent retry (double click / network retry)
            prev = res[item_id]
            if prev.get("verdict") == "mismatch" and payload.get("self") in ("correct", "wrong"):
                return self._self_assess(db, user_id, s, item_id, prev, payload["self"] == "correct")
            return prev
        e = db.get(VocabEntry, it["entry_id"])
        duration = payload.get("duration_ms")
        out = self._grade(db, user_id, it, e, payload)  # may call AI: before any write (no SQLite write lock while waiting)
        p = get_progress(db, user_id, it["entry_id"], source="session")
        mark_seen(p)
        was_learned = p.learned_at is not None
        out["item_id"] = item_id
        out["type"] = it["type"]
        out["entry_id"] = it["entry_id"]
        out["entry"] = {"lemma": e.lemma, "headword": e.headword, "ipa_uk": e.ipa_uk, "ipa_us": e.ipa_us}
        if it["type"] != "learn":
            log = VocabReviewLog(user_id=user_id, entry_id=it["entry_id"], session_id=s.id, mode=it["type"],
                                 client_review_id=payload.get("client_review_id"), correct=out.get("correct"), verdict=out.get("verdict"),
                                 response={k: out.get(k) for k in ("answer", "expected", "verdict", "rating", "self")} | {"item": item_id},
                                 duration_ms=int(duration) if isinstance(duration, (int, float)) and 0 < duration < 3_600_000 else None)
            db.add(log)
            db.flush()
            out["log_id"] = log.id
            if out.get("correct") is not None:  # a translation awaiting self-assessment is counted when decided
                self._learning_counters(db, user_id, p, it, out)
            P.log_study(db, user_id, "vocab", kind="module", items=1, correct=int(bool(out.get("correct"))),
                        learned=int(not was_learned and p.learned_at is not None))
        self._store(s, item_id, out)
        # schedule when every graded item of this word in this round is answered
        sched = self._maybe_schedule(db, user_id, s, it)
        if sched:
            out["schedule"] = sched
        if it["type"] != "learn" and not out.get("correct") and it.get("round", 1) == 1 and s.kind in ("daily", "learn", "review", "weak", "gaps") \
                and not any(x["entry_id"] == it["entry_id"] and x.get("round") == 2 for x in s.items):
            self._add_retry(db, s, it)
            out["retry_added"] = True
        self._store(s, item_id, out)
        if all(x["id"] in s.results for x in s.items):
            out["session_complete"] = True
        return out

    def _self_assess(self, db: Session, user_id: int, s: VocabSession, item_id: str, prev: dict, ok: bool) -> dict:
        """A translation that differs from the model sentence and could not be checked by AI: the learner decides once."""
        out = prev | {"verdict": "self_correct" if ok else "self_wrong", "correct": ok, "self": True}
        log = db.get(VocabReviewLog, prev.get("log_id")) if prev.get("log_id") else None
        if log is not None:
            log.correct, log.verdict = ok, out["verdict"]
        it = self.item(s, item_id)
        self._learning_counters(db, user_id, get_progress(db, user_id, it["entry_id"], source="session"), it, out)
        if ok:
            P.log_study(db, user_id, "vocab", kind="module", correct=1)
        self._store(s, item_id, out)
        return out

    @staticmethod
    def _store(s: VocabSession, item_id: str, out: dict) -> None:
        # JSON columns are not mutation-tracked: always assign a fresh deep copy and flag the change
        s.results = {**json.loads(json.dumps(s.results or {})), item_id: json.loads(json.dumps(out, default=str))}
        flag_modified(s, "results")

    def _grade(self, db: Session, user_id: int, it: dict, e: VocabEntry, payload: dict) -> dict:
        t, pv = it["type"], it["private"]
        if t == "learn":
            return {"correct": None, "verdict": "seen"}
        if t == "flashcard":
            r = int(payload.get("rating") or 0)
            if r not in (1, 2, 3, 4):
                raise ValueError("rating 1–4 required")
            return {"correct": r >= 2, "verdict": srs.RATINGS[r], "rating": r, "score": r}
        if t in ("mc_meaning", "mc_word", "listen_choose", "cloze", "collocation", "confusable"):
            choice = payload.get("choice")
            if not isinstance(choice, int):
                raise ValueError("choice required")
            ok = choice == pv["answer"]
            out = {"correct": ok, "verdict": "correct" if ok else "incorrect", "answer": choice, "expected_index": pv["answer"],
                   "score": 3 if ok else 1}
            if t == "cloze":
                out |= {"full": pv["full"], "vi": pv.get("vi"), "explain": pv["explain"], "form": pv["form"], "note_vi": pv.get("note_vi")}
            if t == "collocation":
                out |= {"full": pv["full"], "note_vi": pv.get("note_vi")}
            if t == "confusable":
                out |= {"full": pv["full"], "note_vi": pv.get("note_vi")}
            if t in ("mc_meaning", "mc_word", "listen_choose") and not ok:
                wrong = pv["option_entries"][choice] if 0 <= choice < len(pv["option_entries"]) else None
                out["confused_with"] = wrong
            return out
        if t in ("type_word", "dictation"):
            ans = str(payload.get("answer") or "")[:200]

            def other(text):
                ids = [i for i in lexicon.find_ids(text) if i != e.id]
                if not ids:
                    return None
                from ..models import VocabSense

                m = db.scalar(select(VocabSense.meaning_vi).where(VocabSense.entry_id == ids[0], VocabSense.idx == 0))
                return (ids[0], m)
            g = grade_typed(ans, target=pv["target"], variants=pv.get("variants", []), forms=pv.get("forms", []), family=pv.get("family", []),
                            other_entry=other)
            g["answer"] = ans
            g["ai_checked"] = False
            if payload.get("override") == "accept" and g["verdict"] in ("incorrect", "wrong_meaning"):
                g |= {"verdict": "self_accepted", "correct": True, "score": 2, "self": True}  # learner disputes; counts as Hard
                return g
            if g["verdict"] == "incorrect" and e.kind in ("collocation", "phrase", "pattern", "phrasal_verb") and self.ai is not None and ans.strip():
                try:
                    j = self.ai.judge_answer(db, user_id, prompt_vi=it["public"].get("meaning_vi", ""), expected=pv["target"], answer=ans)
                    g["ai_checked"] = True
                    g["ai_explanation_vi"] = j.explanation_vi
                    if j.acceptable:
                        g |= {"verdict": "acceptable", "correct": True}
                except Exception as exc:  # noqa: BLE001 — AI is optional here; deterministic verdict stands
                    g["ai_unavailable"] = getattr(exc, "code", "ai_error")
            g["score"] = SCHEDULE_RATING.get(g["verdict"], 1)
            return g
        if t == "builder":
            toks = payload.get("tokens")
            if not isinstance(toks, list):
                raise ValueError("tokens required")
            g = grade_order([str(x) for x in toks], pv["sentence"])
            return g | {"answer": " ".join(map(str, toks)), "expected": pv["full"], "score": 3 if g["correct"] else 2}
        if t == "translate":
            ans = str(payload.get("answer") or "")[:400]
            g = grade_translation(ans, pv["en"], pv.get("forms", []))
            g |= {"answer": ans, "expected": it["private"]["en"], "ai_checked": False}
            if g["verdict"] == "mismatch" and self.ai is not None:
                try:
                    j = self.ai.judge_answer(db, user_id, prompt_vi=it["public"]["vi"], expected=pv["en"], answer=ans)
                    g |= {"ai_checked": True, "ai_explanation_vi": j.explanation_vi,
                          "verdict": "acceptable" if j.acceptable else "incorrect", "correct": bool(j.acceptable)}
                except Exception as exc:  # noqa: BLE001 — AI optional: the learner compares with the model sentence
                    g["ai_unavailable"] = getattr(exc, "code", "ai_error")
            g["score"] = SCHEDULE_RATING.get(g["verdict"], 2)
            return g
        if t == "use_it":
            sentence = str(payload.get("sentence") or "")
            if payload.get("self") in ("correct", "partly", "wrong"):  # AI unavailable → learner self-assessment
                r = {"correct": 3, "partly": 2, "wrong": 1}[payload["self"]]
                return {"correct": r >= 2, "verdict": f"self_{payload['self']}", "answer": sentence, "score": r, "self": True}
            if self.ai is None:
                raise ValueError("ai unavailable")
            from .service import detail

            d = detail(db, user_id, e.id)
            g = self.ai.grade_sentence(db, user_id, entry=d, sentence=sentence)
            ok = g["verdict"] in ("correct", "minor_issues")
            score = {"correct": 3, "minor_issues": 2}.get(g["verdict"], 1)
            return g | {"correct": ok, "answer": sentence, "score": score}
        raise ValueError("unknown item type")

    def _learning_counters(self, db: Session, user_id: int, p: VocabProgress, it: dict, out: dict) -> None:
        ok = bool(out.get("correct"))
        now = utcnow()
        if ok:
            p.correct_count = (p.correct_count or 0) + 1
            p.streak = (p.streak or 0) + 1
            p.first_correct_at = p.first_correct_at or now
            if it["type"] == "use_it" and out.get("verdict") in ("correct", "minor_issues"):
                p.used_correctly_at = p.used_correctly_at or now
                p.used_count = (p.used_count or 0) + 1
                p.used_in = {**(p.used_in or {}), "practice": (p.used_in or {}).get("practice", 0) + 1}
            if p.streak >= 2:
                for m in db.scalars(select(VocabMistake).where(VocabMistake.user_id == user_id, VocabMistake.entry_id == p.entry_id,
                                                               VocabMistake.resolved_at.is_(None))):
                    m.resolved_at = now
        else:
            p.incorrect_count = (p.incorrect_count or 0) + 1
            p.streak = 0
            prompt = (it["public"].get("vi") if it["type"] == "translate" else None) or it["public"].get("meaning_vi") or it["public"].get("sentence") or it["public"].get("phrase") or it["public"].get("word") or ""
            exp = out.get("expected") or it["private"].get("target") or it["private"].get("full") or ""
            if out.get("expected_index") is not None and it["public"].get("options"):
                exp = it["public"]["options"][out["expected_index"]]
            ans = out.get("answer")
            if isinstance(ans, int) and it["public"].get("options") and 0 <= ans < len(it["public"]["options"]):
                ans = it["public"]["options"][ans]
            db.add(VocabMistake(user_id=user_id, entry_id=p.entry_id, mode=it["type"], error_type=out.get("verdict") or "incorrect",
                                prompt=str(prompt)[:500], answer=str(ans or "")[:300], expected=str(exp)[:300],
                                explanation_vi=out.get("ai_explanation_vi") or out.get("explanation_vi"),
                                confused_with=out.get("confused_with")))
            if (p.incorrect_count or 0) >= 3 and (p.incorrect_count or 0) > (p.correct_count or 0):
                p.difficult = True
        if it["type"] in X.RECALL_TYPES and out.get("verdict") in CORRECTISH | {"good", "easy", "hard", "minor_issues", "self_correct", "self_partly"}:
            p.learned_at = p.learned_at or now

    def _maybe_schedule(self, db: Session, user_id: int, s: VocabSession, it: dict, *, force: bool = False) -> dict | None:
        if not it.get("scheduled"):
            return None
        group = [x for x in s.items if x["entry_id"] == it["entry_id"] and x.get("round", 1) == it.get("round", 1) and x.get("scheduled")]
        res = s.results or {}
        done = [x for x in group if x["id"] in res]
        if not done or (not force and len(done) < len(group)):
            return None
        key = f"{it['entry_id']}@{it.get('round', 1)}"
        applied = dict((s.params or {}).get("applied", {}))
        if key in applied:
            return None
        rating = min(int(res[x["id"]].get("score") or 1) for x in done)
        p = get_progress(db, user_id, it["entry_id"])
        prev_review = p.last_review
        info = srs.review(p, rating, retention=float(settings(db, user_id)["retention"]))
        if rating >= 2 and prev_review is not None and info["elapsed_days"] is not None and info["elapsed_days"] >= 1:
            p.recalled_after_delay_at = p.recalled_after_delay_at or utcnow()
        log_id = res[done[-1]["id"]].get("log_id")
        if log_id and (log := db.get(VocabReviewLog, log_id)):
            log.rating, log.state_before, log.state_after = rating, info["state_before"], info["state_after"]
            log.elapsed_days, log.due_after = info["elapsed_days"], info["due_after"]
        applied[key] = {"rating": rating, "due": p.due.isoformat() if p.due else None, "state": srs.label(p)}
        s.params = {**(s.params or {}), "applied": applied}
        flag_modified(s, "params")
        P.activity(db, user_id).cards_reviewed += 1
        P.log_study(db, user_id, "vocab", kind="module", cards=1)
        P.award(db, user_id, f"vocab:{it['entry_id']}:{P.today().isoformat()}", "vocab_review", P.XP_RULES["vocab_review"])
        return {"rating": rating, "rating_name": srs.RATINGS[rating], "due": applied[key]["due"], "state": applied[key]["state"]}

    def _add_retry(self, db: Session, s: VocabSession, it: dict) -> None:
        b = X.load_bundles(db, [it["entry_id"]]).get(it["entry_id"])
        if b is None:
            return
        new = X.type_word(b, hint=True) if it["type"] not in ("type_word", "dictation") else X.flashcard(b, prefer_short=True)
        _, end = day_bounds()
        new["round"] = 2
        new["scheduled"] = it.get("scheduled", False)
        s.items = [*s.items, new]
        flag_modified(s, "items")

    # ------------------------------------------------------------ finishing
    def finish(self, db: Session, user_id: int, s: VocabSession) -> dict:
        if s.status == "finished" and s.summary:
            return s.summary
        for it in s.items:  # partially answered words are still scheduled from what was answered
            if it["id"] in (s.results or {}):
                self._maybe_schedule(db, user_id, s, it, force=True)
        s.status = "finished"
        s.finished_at = utcnow()
        s.summary = self._summary(db, user_id, s)
        return s.summary

    def _summary(self, db: Session, user_id: int, s: VocabSession) -> dict:
        res = s.results or {}
        graded = [(it, res[it["id"]]) for it in s.items if it["id"] in res and it["type"] != "learn"]
        entries = {it["entry_id"] for it, _ in graded} | {it["entry_id"] for it in s.items if it["id"] in res}
        prog = {p.entry_id: p for p in db.scalars(select(VocabProgress).where(VocabProgress.user_id == user_id, VocabProgress.entry_id.in_(entries or [""])))}
        lemmas = dict(db.execute(select(VocabEntry.id, VocabEntry.lemma).where(VocabEntry.id.in_(entries or [""]))).all())
        start = s.created_at or utcnow()
        learned = [i for i in entries if prog.get(i) and prog[i].learned_at and prog[i].learned_at >= start - timedelta(seconds=1)]
        recalled = sorted({it["entry_id"] for it, r in graded if it["type"] in X.RECALL_TYPES and r.get("correct")})
        wrong_ids = sorted({it["entry_id"] for it, r in graded if not r.get("correct")})
        applied = (s.params or {}).get("applied", {})
        difficult = sorted({k.split("@")[0] for k, v in applied.items() if v["rating"] == 1} | set(wrong_ids))
        mistakes = []
        for it, r in graded:
            if not r.get("correct"):
                pub = it["public"]
                exp = r.get("expected")
                if r.get("expected_index") is not None and pub.get("options"):
                    exp = pub["options"][r["expected_index"]]
                ans = r.get("answer")
                if isinstance(ans, int) and pub.get("options") and 0 <= ans < len(pub["options"]):
                    ans = pub["options"][ans]
                mistakes.append({"entry_id": it["entry_id"], "lemma": lemmas.get(it["entry_id"]), "type": it["type"], "verdict": r.get("verdict"),
                                 "answer": ans, "expected": exp})
        verdicts = [r.get("verdict") for _, r in graded if not r.get("correct")]
        suggestions = []
        if verdicts.count("spelling") >= 2:
            suggestions.append({"mode": "dictation", "label_vi": "Nghe – chép chính tả để sửa lỗi chính tả"})
        if verdicts.count("wrong_meaning") or any(it["type"] == "confusable" and not r.get("correct") for it, r in graded):
            suggestions.append({"mode": "weak", "label_vi": "Luyện phân biệt từ dễ nhầm"})
        if any(it["type"] == "collocation" and not r.get("correct") for it, r in graded):
            suggestions.append({"mode": "collocation", "label_vi": "Luyện thêm collocation"})
        if recalled:
            suggestions.append({"mode": "use", "label_vi": "Tự đặt câu với từ vừa nhớ được"})
        if not suggestions:
            suggestions.append({"mode": "context", "label_vi": "Luyện từ trong ngữ cảnh"})
        nxt = sorted((v["due"] for v in applied.values() if v.get("due")))
        return {"answered": len(graded), "correct": sum(1 for _, r in graded if r.get("correct")),
                "words": [{"entry_id": i, "lemma": lemmas.get(i), "state": srs.label(prog.get(i)), "due": prog[i].due.isoformat() if prog.get(i) and prog[i].due else None}
                          for i in sorted(entries)],
                "learned": learned, "recalled": recalled, "difficult": difficult, "mistakes": mistakes[:30],
                "scheduled": len(applied), "next_review": nxt[0] if nxt else None, "suggestions": suggestions,
                "duration_ms": sum(int(r.get("duration_ms") or 0) for _, r in graded)}

    # ------------------------------------------------------------ AI-personalised session
    def create_ai(self, db: Session, user_id: int, entry_ids: list[str]) -> VocabSession:
        from .service import detail

        targets = [d for i in entry_ids[:6] if (d := detail(db, user_id, i))]
        if not targets:
            raise ValueError("no words")
        confusions = [m for (m,) in db.execute(select(VocabMistake.confused_with).where(VocabMistake.user_id == user_id, VocabMistake.confused_with.is_not(None)).limit(10))]
        lvl = max((t["cefr"] for t in targets if t.get("cefr")), key=LEVELS.index, default="A2")
        gen = self.ai.exercises(db, user_id, targets=targets, level=lvl, confusions=confusions)
        b = SessionBuilder(db, user_id, "custom", {})
        b.schedulable([g["entry_id"] for g in gen])
        items = []
        for g in gen:
            it = {"id": uuid.uuid4().hex[:10], "type": g["type"] if g["type"] != "confusable" else "confusable", "entry_id": g["entry_id"],
                  "public": {"sentence": g["sentence"] if g["type"] != "collocation" else None, "phrase": g["sentence"] if g["type"] == "collocation" else None,
                             "options": g["options"], "prompt_vi": "Bài tập AI tạo theo từ bạn hay quên", "ai_generated": True},
                  "private": {"answer": g["answer"], "full": g["sentence"].replace("_____", g["options"][g["answer"]]), "vi": g["sentence_vi"],
                              "note_vi": g["explanation_vi"], "explain": [{"word": o, "meaning_vi": "", "correct": i == g["answer"]} for i, o in enumerate(g["options"])],
                              "form": g["options"][g["answer"]]}}
            if it["type"] == "cloze":
                it["public"].pop("phrase")
            items.append(it)
            b.add(it)
        s = VocabSession(id=str(uuid.uuid4()), user_id=user_id, kind="custom", params={"ai": True, "entry_ids": entry_ids}, items=b.items, results={}, status="active")
        db.add(s)
        db.flush()
        return s


def speak_fallback(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")
