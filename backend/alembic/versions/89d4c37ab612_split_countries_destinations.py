"""Split countries from destinations.

Revision ID: 89d4c37ab612
Revises: 0b88acd6f0bf
Create Date: 2026-11-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "89d4c37ab612"
down_revision: Union[str, Sequence[str], None] = "0b88acd6f0bf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "countries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.execute(
        """
        INSERT INTO countries (name, slug)
        SELECT MIN(country), country_slug
        FROM destinations
        GROUP BY country_slug
        """
    )
    op.add_column(
        "destinations", sa.Column("name", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "destinations", sa.Column("slug", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "destinations", sa.Column("country_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "destinations", sa.Column("parent_id", sa.Integer(), nullable=True)
    )
    op.execute(
        """
        UPDATE destinations
        SET name = city,
            slug = city_slug,
            country_id = (
                SELECT countries.id
                FROM countries
                WHERE countries.slug = destinations.country_slug
            )
        """
    )
    with op.batch_alter_table("destinations") as batch_op:
        batch_op.drop_constraint(
            "uq_destinations_country_city", type_="unique"
        )
        batch_op.drop_constraint(
            "uq_destinations_country_slug_city_slug", type_="unique"
        )
        batch_op.alter_column("name", existing_type=sa.String(length=100), nullable=False)
        batch_op.alter_column("slug", existing_type=sa.String(length=100), nullable=False)
        batch_op.alter_column(
            "country_id", existing_type=sa.Integer(), nullable=False
        )
        batch_op.create_foreign_key(
            "fk_destinations_country_id_countries",
            "countries",
            ["country_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_destinations_parent_id_destinations",
            "destinations",
            ["parent_id"],
            ["id"],
        )
        batch_op.create_index("ix_destinations_country_id", ["country_id"])
        batch_op.create_index("ix_destinations_parent_id", ["parent_id"])
        batch_op.drop_column("country")
        batch_op.drop_column("city")
        batch_op.drop_column("country_slug")
        batch_op.drop_column("city_slug")


def downgrade() -> None:
    op.add_column(
        "destinations", sa.Column("country", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "destinations", sa.Column("city", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "destinations", sa.Column("country_slug", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "destinations", sa.Column("city_slug", sa.String(length=100), nullable=True)
    )
    op.execute(
        """
        UPDATE destinations
        SET country = (
                SELECT countries.name
                FROM countries
                WHERE countries.id = destinations.country_id
            ),
            country_slug = (
                SELECT countries.slug
                FROM countries
                WHERE countries.id = destinations.country_id
            ),
            city = name,
            city_slug = slug
        """
    )
    with op.batch_alter_table("destinations") as batch_op:
        batch_op.drop_index("ix_destinations_parent_id")
        batch_op.drop_index("ix_destinations_country_id")
        batch_op.drop_constraint(
            "fk_destinations_parent_id_destinations", type_="foreignkey"
        )
        batch_op.drop_constraint(
            "fk_destinations_country_id_countries", type_="foreignkey"
        )
        batch_op.alter_column(
            "country", existing_type=sa.String(length=100), nullable=False
        )
        batch_op.alter_column("city", existing_type=sa.String(length=100), nullable=False)
        batch_op.alter_column(
            "country_slug", existing_type=sa.String(length=100), nullable=False
        )
        batch_op.alter_column(
            "city_slug", existing_type=sa.String(length=100), nullable=False
        )
        batch_op.create_unique_constraint(
            "uq_destinations_country_city", ["country", "city"]
        )
        batch_op.create_unique_constraint(
            "uq_destinations_country_slug_city_slug",
            ["country_slug", "city_slug"],
        )
        batch_op.drop_column("country_id")
        batch_op.drop_column("parent_id")
        batch_op.drop_column("name")
        batch_op.drop_column("slug")
    op.drop_table("countries")
