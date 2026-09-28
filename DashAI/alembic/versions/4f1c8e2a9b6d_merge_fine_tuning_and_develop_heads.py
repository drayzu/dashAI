"""Merge the fine-tuning and current develop migration heads.

Revision ID: 4f1c8e2a9b6d
Revises: d033b573e63b, d4a7c1e9f3b2
Create Date: 2026-08-23 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "4f1c8e2a9b6d"
down_revision: Union[str, Sequence[str], None] = (
    "d033b573e63b",
    "d4a7c1e9f3b2",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Join both histories and make managed downloads restart-safe."""
    op.add_column(
        "managed_local_model",
        sa.Column("huey_id", sa.String(), nullable=True),
    )


def downgrade() -> None:
    """Remove download task tracking before splitting the histories."""
    op.drop_column("managed_local_model", "huey_id")
