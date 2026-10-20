"""Daily study plan built for sustained attention.

Design (learning-science rationale, shown to the learner in short form):
- Focus blocks of 15–45 min with short active breaks; a long break after about two hours (attention and fatigue).
- Interleaving: input (lesson, listening/reading) alternates with output and retrieval (speaking/writing, recall),
  so the same mental system is not used for hours (alertness, desirable difficulty).
- Start with retrieval of due material (spacing + warm-up), fix gaps before new content (error-based learning),
  end the day with a short mixed retrieval check (consolidation).
Block progress comes from the study journal; nothing is self-reported.
"""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .content.store import ContentStore
from .models import MistakeRecord, StudyLog, User
from .services import progress as P

# id, category, share of the daily target, title, why (Vietnamese, one line)
TEMPLATE = [
    # rebalanced 2026-10-20 from the learner's record: 84 % of study time went to grammar lessons and ~3 % to writing and
    # speaking, while typed answers (production) were the weak point. Lessons + error review ≈ 52 %, writing + speaking
    # ≈ 21 %, vocabulary ≈ 19 %, listening/reading ≈ 8 %.
    ("warmup", "vocab_review", 15, "Khởi động: ôn từ đến hạn", "Nhớ lại đầu buổi đánh thức trí nhớ và đúng lịch lặp lại ngắt quãng."),
    ("gaps", "review", 25, "Ôn lỗ hổng: câu sai, lỗi viết/nói", "Sửa lỗi khi còn mới giúp không lặp lại lỗi cũ (học từ lỗi sai)."),
    ("lesson1", "lesson", 45, "Bài mới (lộ trình)", "Học kiến thức mới khi đầu óc còn tươi nhất trong ngày. Đã biết bài? Kiểm tra vượt bài."),
    ("write", "output", 25, "Viết: dịch câu & tự đặt câu", "Tự viết ra (output) là điểm yếu nhất hiện tại — luyện ngay sau bài mới."),
    ("vocab_new", "vocab_new", 30, "Từ mới & collocation", "Học từ theo cụm và ngữ cảnh, xen giữa các khối dài."),
    ("lesson2", "lesson", 45, "Bài mới thứ hai", "Buổi hai: tiếp tục lộ trình sau nghỉ dài — sự chú ý đã hồi phục."),
    ("speak", "output", 25, "Nói: phát âm & hội thoại", "Đọc to được chấm từng từ, rồi nói chuyện ngắn với AI."),
    ("input", "input", 20, "Nghe / Đọc hiểu", "Đổi sang tiếp nhận ngôn ngữ thật để não nghỉ khỏi ngữ pháp mà vẫn học."),
    ("final", "review", 10, "Kiểm tra cuối ngày", "Ôn trộn ngắn cuối ngày giúp củng cố trước khi ngủ."),
]
BREAKS = [
    "Đứng dậy, vươn vai, đi lại 2 phút",
    "Nhìn xa ít nhất 6 m trong 20 giây (quy tắc 20-20-20)",
    "Uống một cốc nước",
    "Hít thở 4-7-8: hít 4 giây, giữ 7, thở ra 8 — lặp 3 lần",
    "Rửa mặt nước mát",
    "Không lướt mạng xã hội trong giờ nghỉ — não cần nghỉ thật",
]
INPUT_KINDS = {"listening", "reading"}
OUTPUT_KINDS = {"speaking", "writing", "pronunciation"}


def _category(store: ContentStore, row: StudyLog) -> str | None:
    k = row.activity_key
    if row.kind == "lesson":
        u = store.units.get(k)
        kind = u.kind if u else "grammar"
        if kind in INPUT_KINDS:
            return "input"
        if kind in OUTPUT_KINDS:
            return "output"
        if kind == "vocabulary":
            return "vocab_new"
        if kind in ("exam", "practice"):
            return "review"
        return "lesson"
    return {"vocab": "vocab", "reading-studio": "input", "listening-studio": "input", "writing-studio": "output",
            "speaking-studio": "output", "mistakes": "review", "review": "review", "ai-practice": "review", "placement": "review"}.get(k)


def _blocks_for(target: int) -> list[tuple]:
    """Scale the 240-minute template to the learner's daily target: about one block per 30 minutes, keeping the most
    important blocks (retrieval warm-up, gap review, a new lesson, the final check) when time is short."""
    priority = ["warmup", "gaps", "lesson1", "write", "final", "vocab_new", "speak", "lesson2", "input"]
    n = max(3, min(len(TEMPLATE), round(target / 27)))
    keep = set(priority[:n])
    chosen = [t for t in TEMPLATE if t[0] in keep]
    scale = target / sum(t[2] for t in chosen)
    return [(bid, cat, max(10, round(share * scale / 5) * 5), title, why) for bid, cat, share, title, why in chosen]


def plan(db: Session, user: User, store: ContentStore) -> dict:
    from .vocabulary.sessions import plan as vocab_plan

    target = user.daily_goal_minutes or 240
    today = P.today()
    rows = list(db.scalars(select(StudyLog).where(StudyLog.user_id == user.id, StudyLog.day == today)))
    by_cat: dict[str, float] = {}
    for r in rows:
        c = _category(store, r)
        if c:
            by_cat[c] = by_cat.get(c, 0) + r.seconds / 60
    minutes_today = round(sum(r.seconds for r in rows) / 60)
    # vocabulary time fills the review warm-up first, then the new-words block
    pool = dict(by_cat)
    pool["vocab_review"] = pool.pop("vocab", 0)
    rec = P.recommendations(db, user, store)
    vp = vocab_plan(db, user.id)
    gaps = gap_counts(db, user, store)
    nexts = _next_lessons(db, user, store, rec)
    blocks = []
    for bid, cat, mins, title, why in _blocks_for(target):
        src = "vocab_review" if cat in ("vocab_review", "vocab_new") and pool.get("vocab_review", 0) > 0 else cat
        done = min(mins, pool.get(src, 0))
        pool[src] = pool.get(src, 0) - done
        action = _action(bid, cat, nexts, vp, gaps, today)
        blocks.append({"id": bid, "category": cat, "title": title, "why_vi": why, "minutes": mins, "done_minutes": round(done),
                       "status": "done" if done >= mins * 0.9 else "in_progress" if done >= 3 else "todo", "action": action})
    # breaks: short after each block, long after ~2 hours of focus
    timeline, acc, long_done = [], 0, False
    for i, b in enumerate(blocks):
        timeline.append({"type": "block", **b})
        acc += b["minutes"]
        if i == len(blocks) - 1:
            break
        if not long_done and acc >= min(110, target * 0.45) and target >= 150:
            timeline.append({"type": "break", "minutes": 20, "long": True, "tips": BREAKS[:4]})
            long_done = True
        else:
            timeline.append({"type": "break", "minutes": 10 if b["minutes"] >= 40 else 5, "long": False, "tips": BREAKS[:3]})
    done_blocks = sum(1 for b in blocks if b["status"] == "done")
    current = next((b for b in blocks if b["status"] != "done"), None)
    qs = quests(db, user, store, rows, gaps)
    return {"date": today.isoformat(), "target_minutes": target, "minutes_today": minutes_today,
            "percent": min(100, round(100 * minutes_today / target)) if target else 0, "blocks_done": done_blocks, "blocks_total": len(blocks),
            "current_block": current["id"] if current else None, "timeline": timeline, "blocks": blocks, "quests": qs,
            "break_tips": BREAKS, "streak": P.streak(db, user.id),
            "principles_vi": ["Mỗi khối chỉ làm một việc, tắt thông báo điện thoại.", "Nghỉ đúng giờ kể cả khi đang hăng — nghỉ giúp nhớ lâu hơn.",
                              "Đổi loại hoạt động giữa các khối để luôn tỉnh táo.", "Chia 4 giờ thành 2 buổi (ví dụ sáng & tối) nếu có thể."]}


def _next_lessons(db: Session, user: User, store: ContentStore, rec: dict) -> dict:
    pm = P.progress_map(db, user.id)
    cont = rec.get("continue") or []
    first = cont[0] if cont else rec.get("next_lesson")
    second = None
    if first:
        ids = [u.id for u in store.unit_list if u.kind == "grammar"]
        start = ids.index(first["id"]) + 1 if first["id"] in ids else 0
        second_id = next((i for i in ids[start:] if not (pm.get(i) and pm[i].completed_at) and i != first["id"]), None)
        if second_id:
            u = store.units[second_id]
            second = {"id": u.id, "title": u.title}
    def first_unfinished(kinds):
        for u in store.unit_list:
            if u.kind in kinds and not (pm.get(u.id) and pm[u.id].completed_at):
                return {"id": u.id, "title": u.title}
        return None
    return {"lesson1": first, "lesson2": second, "listening": first_unfinished({"listening"}), "reading": first_unfinished({"reading"}),
            "speaking": first_unfinished({"speaking"}), "writing": first_unfinished({"writing"})}


def _action(bid: str, cat: str, nexts: dict, vp: dict, gaps: dict, today) -> dict:
    even = today.toordinal() % 2 == 0
    if bid == "warmup":
        return {"label": f"Ôn {vp['due_today']} từ đến hạn" if vp["due_today"] else "Ôn nhanh từ đã học", "type": "vocab_session",
                "kind": "review" if vp["due_today"] else "speed"}
    if bid in ("gaps", "final"):
        return {"label": "Ôn tập thông minh" if gaps["total"] else "Không còn lỗ hổng — ôn trộn nhanh", "type": "link",
                "link": "/review" + ("?quick=1" if bid == "final" else "")}
    if bid in ("lesson1", "lesson2"):
        l = nexts.get(bid)
        return {"label": f"{l['id']} · {l['title']}", "type": "link", "link": f"/learn/{l['id']}"} if l else \
            {"label": "Mở lộ trình", "type": "link", "link": "/path"}
    if bid == "input":
        u = nexts.get("listening" if even else "reading") or nexts.get("reading" if even else "listening")
        if u:
            return {"label": f"{u['id']} · {u['title']}", "type": "link", "link": f"/learn/{u['id']}"}
        return {"label": "Listening Studio" if even else "Reading Studio", "type": "link", "link": "/listening-studio" if even else "/reading-studio"}
    if bid == "vocab_new":
        if vp["new_left"] > 10:  # intensive goal: batches of 10 on the sprint page
            return {"label": f"Học cấp tốc: còn {vp['new_left']} từ (đợt 10 từ)", "type": "link", "link": "/vocabulary/sprint"}
        return {"label": f"Học {vp['new_left']} từ mới" if vp["new_left"] else "Luyện collocation", "type": "vocab_session",
                "kind": "learn" if vp["new_left"] else "collocation"}
    if bid == "write":
        return {"label": "Luyện viết mỗi ngày (dịch câu, đặt câu, đoạn văn)", "type": "link", "link": "/writing-daily"}
    if bid == "speak":
        return {"label": "Speaking Studio: Phát âm → hội thoại", "type": "link", "link": "/speaking-studio"}
    return {"label": "Mở", "type": "link", "link": "/"}


def gap_counts(db: Session, user: User, store: ContentStore) -> dict:
    from .models import VocabMistake

    curriculum = len(P.recent_mistakes(db, user.id, store, limit=500))
    corrections = db.scalar(select(func.count(MistakeRecord.id)).where(
        MistakeRecord.user_id == user.id, MistakeRecord.review_status != "mastered", MistakeRecord.source_type != "curriculum",
        MistakeRecord.corrected_answer != "")) or 0
    vocab_due = P.vocab_due_count(db, user.id)
    vocab_mistakes = db.scalar(select(func.count(func.distinct(VocabMistake.entry_id))).where(
        VocabMistake.user_id == user.id, VocabMistake.resolved_at.is_(None))) or 0
    return {"curriculum": curriculum, "corrections": corrections, "vocab_due": vocab_due, "vocab_mistakes": vocab_mistakes,
            "total": curriculum + corrections + vocab_due + vocab_mistakes}


def quests(db: Session, user: User, store: ContentStore, rows: list[StudyLog], gaps: dict) -> list[dict]:
    """Three daily quests; XP is granted once per quest per day when the journal shows it done."""
    today = P.today()
    fixed = db.scalar(select(func.count(MistakeRecord.id)).where(
        MistakeRecord.user_id == user.id, MistakeRecord.review_status.in_(("reviewing", "mastered")),
        MistakeRecord.last_seen >= P.utcnow() - timedelta(days=1))) or 0
    correct_today = sum(r.items_correct for r in rows)
    lessons_done = sum(1 for r in rows if r.kind == "lesson" and r.completed)
    output_items = sum(r.items_answered for r in rows if _category(store, r) == "output")
    qs = [
        {"id": "lessons", "title": "Hoàn thành 2 bài", "progress": lessons_done, "goal": 2, "xp": 30},
        {"id": "correct", "title": "Trả lời đúng 60 câu", "progress": correct_today, "goal": 60, "xp": 30},
        {"id": "output", "title": "Nói hoặc viết 5 lượt với AI", "progress": output_items, "goal": 5, "xp": 30},
    ]
    if gaps["total"]:
        qs[1] = {"id": "fix", "title": "Sửa 10 lỗi / từ yếu", "progress": fixed + sum(r.cards_reviewed for r in rows if r.activity_key == "vocab"),
                 "goal": 10, "xp": 30}
    for q in qs:
        q["done"] = q["progress"] >= q["goal"]
        if q["done"]:  # idempotent: one award per quest per day
            P.award(db, user.id, f"quest:{today.isoformat()}:{q['id']}", "quest", q["xp"])
    return qs
