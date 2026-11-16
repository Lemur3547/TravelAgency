"""add client requests

Revision ID: 1a2b3c4d5e6f
Revises: f251d7a93c4e
Create Date: 2026-11-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1a2b3c4d5e6f"
down_revision: Union[str, Sequence[str], None] = "f251d7a93c4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("departure_city_id", sa.Integer(), nullable=False),
        sa.Column("desired_direction", sa.JSON(), nullable=False),
        sa.Column("desired_start_date", sa.Date(), nullable=True),
        sa.Column("desired_end_date", sa.Date(), nullable=True),
        sa.Column("min_nights", sa.Integer(), nullable=True),
        sa.Column("max_nights", sa.Integer(), nullable=True),
        sa.Column("tourists", sa.Integer(), nullable=False),
        sa.Column("min_budget", sa.Numeric(12, 2), nullable=True),
        sa.Column("max_budget", sa.Numeric(12, 2), nullable=True),
        sa.Column("wishes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="Новая", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["departure_city_id"], ["departure_cities.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_requests_client_id", "client_requests", ["client_id"])
    op.create_index("ix_client_requests_employee_id", "client_requests", ["employee_id"])
    op.create_index(
        "ix_client_requests_departure_city_id",
        "client_requests",
        ["departure_city_id"],
    )


def downgrade() -> None:
    indexes = {
        index["name"] for index in sa.inspect(op.get_bind()).get_indexes("client_requests")
    }
    for index_name in (
        "ix_client_requests_departure_city_id",
        "ix_client_requests_employee_id",
        "ix_client_requests_client_id",
    ):
        if index_name in indexes:
            op.drop_index(index_name, table_name="client_requests")
    op.drop_table("client_requests")
