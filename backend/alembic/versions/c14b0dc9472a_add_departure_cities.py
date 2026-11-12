"""add departure cities

Revision ID: c14b0dc9472a
Revises: 89d4c37ab612
Create Date: 2026-11-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c14b0dc9472a"
down_revision: Union[str, Sequence[str], None] = "89d4c37ab612"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "departure_cities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_departure_cities_name"),
    )
    op.execute(
        """
        INSERT INTO departure_cities (name)
        SELECT DISTINCT departure_city
        FROM tours
        """
    )
    op.add_column(
        "tours", sa.Column("departure_city_id", sa.Integer(), nullable=True)
    )
    op.execute(
        """
        UPDATE tours
        SET departure_city_id = (
            SELECT departure_cities.id
            FROM departure_cities
            WHERE departure_cities.name = tours.departure_city
        )
        """
    )
    with op.batch_alter_table("tours") as batch_op:
        batch_op.alter_column(
            "departure_city_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.create_foreign_key(
            "fk_tours_departure_city_id_departure_cities",
            "departure_cities",
            ["departure_city_id"],
            ["id"],
        )
        batch_op.create_index("ix_tours_departure_city_id", ["departure_city_id"])
        batch_op.drop_column("departure_city")


def downgrade() -> None:
    with op.batch_alter_table("tours") as batch_op:
        batch_op.add_column(sa.Column("departure_city", sa.String(length=100), nullable=True))
    op.execute(
        """
        UPDATE tours
        SET departure_city = (
            SELECT departure_cities.name
            FROM departure_cities
            WHERE departure_cities.id = tours.departure_city_id
        )
        """
    )
    with op.batch_alter_table("tours") as batch_op:
        batch_op.alter_column(
            "departure_city",
            existing_type=sa.String(length=100),
            nullable=False,
        )
        batch_op.drop_index("ix_tours_departure_city_id")
        batch_op.drop_constraint(
            "fk_tours_departure_city_id_departure_cities",
            type_="foreignkey",
        )
        batch_op.drop_column("departure_city_id")
    op.drop_table("departure_cities")
