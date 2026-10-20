"""Lesson test-outs ("kiểm tra vượt bài"): server-picked questions, graded from the learner's first answers. Adds one table."""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "lesson_test_outs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("unit_id", sa.String(64), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("correct", sa.Integer(), nullable=True),
        sa.Column("total", sa.Integer(), nullable=True),
        sa.Column("passed", sa.Boolean(), nullable=True),
    )
    op.create_index("ix_lesson_test_outs_user_unit", "lesson_test_outs", ["user_id", "unit_id"])


def downgrade():
    op.drop_table("lesson_test_outs")
