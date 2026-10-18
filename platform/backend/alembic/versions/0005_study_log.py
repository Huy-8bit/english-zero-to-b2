"""Study journal (study_log) + one-time backfill from existing records.

Backfill (local server day): quiz attempts per lesson, lesson completions with score, vocabulary reviews, AI practice
submissions, writing and speaking. Older study time was only stored per day, so it is kept as one "_untracked" row
per day. Nothing existing is modified.
"""
from collections import defaultdict
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def _day(v):
    if v is None:
        return None
    dt = v if isinstance(v, datetime) else datetime.fromisoformat(str(v))
    return dt.replace(tzinfo=timezone.utc).astimezone().date()


def upgrade():
    op.create_table(
        "study_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("activity_key", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("seconds", sa.Integer(), nullable=False),
        sa.Column("items_answered", sa.Integer(), nullable=False),
        sa.Column("items_correct", sa.Integer(), nullable=False),
        sa.Column("cards_reviewed", sa.Integer(), nullable=False),
        sa.Column("words_learned", sa.Integer(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("source", sa.String(12), nullable=False),
        sa.Column("first_at", sa.DateTime(), nullable=False),
        sa.Column("last_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "day", "activity_key"),
    )
    for col in ("user_id", "day", "activity_key"):
        op.create_index(f"ix_study_log_{col}", "study_log", [col])
    bind = op.get_bind()
    rows: dict = defaultdict(lambda: {"kind": "lesson", "seconds": 0, "items": 0, "correct": 0, "cards": 0, "learned": 0,
                                      "completed": False, "score": None, "first": None, "last": None})

    def touch(user, at, key, kind="lesson", **kw):
        d = _day(at)
        if d is None:
            return
        r = rows[(user, d, key)]
        r["kind"] = kind
        for k, v in kw.items():
            if k in ("completed",):
                r[k] = r[k] or v
            elif k == "score":
                r[k] = v
            else:
                r[k] += v
        at = at if isinstance(at, datetime) else datetime.fromisoformat(str(at))
        r["first"] = min(r["first"] or at, at)
        r["last"] = max(r["last"] or at, at)

    def q(sql):
        try:
            return bind.execute(sa.text(sql)).fetchall()
        except Exception:  # noqa: BLE001 — a missing optional table must not block the migration
            return []

    for u, unit, verdict, selfc, aic, at in q("SELECT user_id, unit_id, verdict, self_correct, ai_correct, created_at FROM attempts"):
        ok = verdict == "correct" or selfc == 1 or aic == 1
        touch(u, at, unit, items=1, correct=int(ok))
    for u, unit, at, score in q("SELECT user_id, unit_id, completed_at, score FROM lesson_progress WHERE completed_at IS NOT NULL"):
        touch(u, at, unit, completed=True, score=score)
    for u, mode, correct, rating, at in q("SELECT user_id, mode, correct, rating, reviewed_at FROM vocab_review_log"):
        if str(mode).startswith("use:"):
            continue
        touch(u, at, "vocab", "module", items=int(correct is not None), correct=int(correct == 1), cards=int(rating is not None))
    for u, at in q("SELECT user_id, learned_at FROM vocab_progress WHERE learned_at IS NOT NULL"):
        touch(u, at, "vocab", "module", learned=1)
    for u, at in q("SELECT user_id, reviewed_at FROM vocab_reviews"):
        touch(u, at, "vocab", "module", items=1, cards=1)
    for u, kind, lesson, at, score, mx in q("SELECT s.user_id, e.kind, e.lesson_id, s.created_at, s.score, s.max_score FROM exercise_submissions s "
                                             "JOIN exercise_sets e ON e.id = s.set_id"):
        key = {"listening": "listening-studio", "reading": "reading-studio"}.get(kind, "ai-practice")
        touch(u, at, key, "module", items=int(mx or 0), correct=int(round(score or 0)))
    for u, at in q("SELECT user_id, created_at FROM writing_submissions"):
        touch(u, at, "writing-studio", "module", items=1)
    for u, at in q("SELECT s.user_id, t.created_at FROM speaking_turns t JOIN speaking_sessions s ON s.id = t.session_id WHERE t.role = 'user'"):
        touch(u, at, "speaking-studio", "module", items=1)
    for u, d, secs in q("SELECT user_id, day, seconds FROM activity_days WHERE seconds > 0"):
        day = d if not isinstance(d, str) else datetime.fromisoformat(d).date()
        r = rows[(u, day, "_untracked")]
        r.update(kind="module", seconds=int(secs))
        r["first"] = r["last"] = datetime(day.year, day.month, day.day)
    types = {"day": sa.Date(), "first_at": sa.DateTime(), "last_at": sa.DateTime(), "completed": sa.Boolean(), "score": sa.Float()}
    table = sa.table("study_log", *[sa.column(c, types.get(c, sa.Integer() if c not in ("activity_key", "kind", "source") else sa.String()))
                                    for c in ("user_id", "day", "activity_key", "kind", "seconds", "items_answered", "items_correct",
                                              "cards_reviewed", "words_learned", "completed", "score", "source", "first_at", "last_at")])
    data = [{"user_id": u, "day": d, "activity_key": k[:64], "kind": r["kind"], "seconds": r["seconds"], "items_answered": r["items"],
             "items_correct": r["correct"], "cards_reviewed": r["cards"], "words_learned": r["learned"], "completed": r["completed"],
             "score": r["score"], "source": "backfill", "first_at": r["first"], "last_at": r["last"]} for (u, d, k), r in rows.items() if k]
    if data:
        op.bulk_insert(table, data)


def downgrade():
    op.drop_table("study_log")
