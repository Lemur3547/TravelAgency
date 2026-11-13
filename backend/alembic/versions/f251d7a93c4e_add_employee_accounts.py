"""add employee accounts and roles

Revision ID: f251d7a93c4e
Revises: c14b0dc9472a
Create Date: 2026-11-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f251d7a93c4e"
down_revision: Union[str, Sequence[str], None] = "c14b0dc9472a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )
    roles = sa.table(
        "roles",
        sa.column("name", sa.String(length=100)),
        sa.column("slug", sa.String(length=50)),
    )
    op.bulk_insert(
        roles,
        [
            {"name": "Менеджер по работе с клиентами", "slug": "client_manager"},
            {"name": "Менеджер по турпродукту", "slug": "product_manager"},
            {"name": "Администратор", "slug": "admin"},
            {"name": "Директор", "slug": "director"},
        ],
    )

    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("last_name", sa.String(length=50), nullable=False),
        sa.Column("first_name", sa.String(length=50), nullable=False),
        sa.Column("father_name", sa.String(length=50), nullable=True),
        sa.Column("passport_number", sa.String(length=10), nullable=False),
        sa.Column("login", sa.String(length=100), nullable=False),
        sa.Column("password", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=15), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("invite_token", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("invite_token"),
        sa.UniqueConstraint("login"),
        sa.UniqueConstraint("passport_number"),
    )
    op.create_index("ix_employees_role_id", "employees", ["role_id"])

    op.create_table(
        "employee_refresh_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["employee_id"], ["employees.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    op.create_index(
        "ix_employee_refresh_sessions_employee_id",
        "employee_refresh_sessions",
        ["employee_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_employee_refresh_sessions_employee_id",
        table_name="employee_refresh_sessions",
    )
    op.drop_table("employee_refresh_sessions")
    op.drop_index("ix_employees_role_id", table_name="employees")
    op.drop_table("employees")
    op.drop_table("roles")
