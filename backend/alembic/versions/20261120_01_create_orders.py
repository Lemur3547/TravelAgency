"""create orders

Revision ID: 20261120_01
Revises: 7d9c2e1f4a6b
Create Date: 2026-11-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261120_01"
down_revision: Union[str, Sequence[str], None] = "7d9c2e1f4a6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("tour_id", sa.Integer(), nullable=False),
        sa.Column("client_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("commission_percent", sa.Numeric(5, 2), nullable=False),
        sa.Column("agency_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("agency_commission", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("payment_status", sa.String(length=30), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["request_id"], ["client_requests.id"]),
        sa.ForeignKeyConstraint(["tour_id"], ["tours.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_orders_client_id", "orders", ["client_id"])
    op.create_index("ix_orders_employee_id", "orders", ["employee_id"])
    op.create_index("ix_orders_request_id", "orders", ["request_id"])
    op.create_index("ix_orders_tour_id", "orders", ["tour_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_tour_id", table_name="orders")
    op.drop_index("ix_orders_request_id", table_name="orders")
    op.drop_index("ix_orders_employee_id", table_name="orders")
    op.drop_index("ix_orders_client_id", table_name="orders")
    op.drop_table("orders")
