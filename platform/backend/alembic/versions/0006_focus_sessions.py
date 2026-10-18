"""Focus (study lock) sessions. Adds one table; nothing existing is changed."""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "focus_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("goal_lessons", sa.Integer(), nullable=False),
        sa.Column("goal_minutes", sa.Integer(), nullable=False),
        sa.Column("max_minutes", sa.Integer(), nullable=False),
        sa.Column("seconds", sa.Integer(), nullable=False),
        sa.Column("lessons_done", sa.JSON(), nullable=False),
        sa.Column("emergency_requested_at", sa.DateTime(), nullable=True),
        sa.Column("end_reason", sa.String(120), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_focus_sessions_user_id", "focus_sessions", ["user_id"])
    op.create_index("ix_focus_sessions_status", "focus_sessions", ["status"])
    op.create_index("ix_focus_sessions_started_at", "focus_sessions", ["started_at"])


def downgrade():
    op.drop_table("focus_sessions")
