"""Persist idempotent curriculum quiz submissions without changing existing attempts."""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "quiz_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("client_submission_id", sa.String(64), nullable=False),
        sa.Column("quiz_id", sa.String(80), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "client_submission_id"),
    )
    op.create_index("ix_quiz_submissions_user_id", "quiz_submissions", ["user_id"])


def downgrade():
    op.drop_table("quiz_submissions")
