"""Distinguish manual progress from completed study activity."""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("lesson_progress", sa.Column("manual", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("lesson_progress", "manual")
