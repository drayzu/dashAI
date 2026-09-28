"""Merge fine-tuning and September develop heads

Revision ID: f1cc66e6c097
Revises: 4f1c8e2a9b6d, m6n7o8p9q0r1
Create Date: 2026-09-28 06:56:42.695689

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1cc66e6c097'
down_revision: Union[str, None] = ('4f1c8e2a9b6d', 'm6n7o8p9q0r1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
