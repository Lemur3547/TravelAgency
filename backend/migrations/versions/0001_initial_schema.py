"""Create the initial application schema.

Revision ID: 0001_initial_schema
Revises:
"""
from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("last_name", sa.String(length=50), nullable=False),
        sa.Column("first_name", sa.String(length=50), nullable=False),
        sa.Column("father_name", sa.String(length=50), nullable=True),
        sa.Column("passport_number", sa.String(length=10), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("foreign_passport_number", sa.String(length=9), nullable=True),
        sa.Column("latin_first_name", sa.String(length=50), nullable=True),
        sa.Column("latin_last_name", sa.String(length=50), nullable=True),
        sa.Column("foreign_passport_expire_date", sa.Date(), nullable=True),
        sa.Column("phone", sa.String(length=15), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("passport_number"),
        sa.UniqueConstraint("foreign_passport_number"),
    )
    op.create_index(
        "ix_clients_full_name",
        "clients",
        ["last_name", "first_name", "father_name"],
        unique=False,
    )

    op.create_table(
        "tour_operators",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=False),
        sa.Column("inn", sa.String(length=10), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=15), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("website", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("inn"),
    )


def downgrade() -> None:
    op.drop_table("tour_operators")
    op.drop_index("ix_clients_full_name", table_name="clients")
    op.drop_table("clients")
