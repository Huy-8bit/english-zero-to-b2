"""Pronunciation attempts (read a sentence or word aloud → word-by-word check). Adds one table; nothing existing is changed."""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pronunciation_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source", sa.String(24), nullable=False),
        sa.Column("source_ref", sa.String(80), nullable=True),
        sa.Column("reference", sa.Text(), nullable=False),
        sa.Column("heard", sa.Text(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("words", sa.JSON(), nullable=False),
        sa.Column("audio_seconds", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_pronunciation_attempts_user_id", "pronunciation_attempts", ["user_id"])
    op.create_index("ix_pronunciation_attempts_created_at", "pronunciation_attempts", ["created_at"])


def downgrade():
    op.drop_table("pronunciation_attempts")
