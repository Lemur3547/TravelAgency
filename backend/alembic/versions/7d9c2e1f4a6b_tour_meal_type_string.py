"""change tour meal type to string

Revision ID: 7d9c2e1f4a6b
Revises: 1a2b3c4d5e6f
Create Date: 2026-11-20

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d9c2e1f4a6b"
down_revision: Union[str, Sequence[str], None] = "1a2b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tours", sa.Column("meal_type", sa.String(length=50), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, meal_types FROM tours")).fetchall()
    for tour_id, meal_types in rows:
        if isinstance(meal_types, str):
            meal_types = json.loads(meal_types)
        meal_type = meal_types[0] if meal_types else ""
        connection.execute(
            sa.text("UPDATE tours SET meal_type = :meal_type WHERE id = :tour_id"),
            {"meal_type": meal_type, "tour_id": tour_id},
        )

    with op.batch_alter_table("tours") as batch_op:
        batch_op.alter_column("meal_type", nullable=False)
        batch_op.drop_column("meal_types")


def downgrade() -> None:
    op.add_column("tours", sa.Column("meal_types", sa.JSON(), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, meal_type FROM tours")).fetchall()
    for tour_id, meal_type in rows:
        serialized = json.dumps([meal_type], ensure_ascii=False)
        connection.execute(
            sa.text("UPDATE tours SET meal_types = :meal_types WHERE id = :tour_id"),
            {"meal_types": serialized, "tour_id": tour_id},
        )

    with op.batch_alter_table("tours") as batch_op:
        batch_op.alter_column("meal_types", nullable=False)
        batch_op.drop_column("meal_type")
