import hashlib
import os
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth_dependencies import require_roles
from ..database import get_db


router = APIRouter(prefix="/api/admin", tags=["Employees"])
_REGISTRAR_ROLES = ("admin", "director")
_MANAGER_ROLE_SLUGS = {"client_manager", "product_manager"}
_ROLE_HIERARCHY = {
    "client_manager": 1,
    "product_manager": 1,
    "admin": 2,
    "director": 3,
}


def _build_activation_url(invite_token: str) -> str:
    activation_base_url = os.getenv(
        "ACTIVATION_URL_BASE", "http://localhost:5173/activate"
    ).rstrip("?&")
    separator = "&" if "?" in activation_base_url else "?"
    return f"{activation_base_url}{separator}{urlencode({'token': invite_token})}"


@router.get("/employees", response_model=list[schemas.EmployeeResponse])
def read_employees(
    registrar: models.Employee = Depends(require_roles(*_REGISTRAR_ROLES)),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Employee)
        .options(joinedload(models.Employee.role))
        .order_by(models.Employee.last_name, models.Employee.first_name, models.Employee.id)
        .all()
    )


@router.get("/roles", response_model=list[schemas.RoleResponse])
def read_registrable_roles(
    registrar: models.Employee = Depends(require_roles(*_REGISTRAR_ROLES)),
    db: Session = Depends(get_db),
):
    allowed_slugs = set(_MANAGER_ROLE_SLUGS)
    if registrar.role.slug == "director":
        allowed_slugs.add("admin")
    return (
        db.query(models.Role)
        .filter(models.Role.slug.in_(allowed_slugs))
        .order_by(models.Role.id)
        .all()
    )


@router.post(
    "/employees",
    response_model=schemas.EmployeeInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_employee(
    employee_data: schemas.EmployeeRegistration,
    registrar: models.Employee = Depends(require_roles(*_REGISTRAR_ROLES)),
    db: Session = Depends(get_db),
):
    role = db.get(models.Role, employee_data.role_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Указанная роль не найдена",
        )
    if role.slug not in _MANAGER_ROLE_SLUGS and not (
        role.slug == "admin" and registrar.role.slug == "director"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для назначения этой роли",
        )

    invite_token = secrets.token_urlsafe(32)
    employee = models.Employee(
        **employee_data.model_dump(),
        invite_token=hashlib.sha256(invite_token.encode("utf-8")).hexdigest(),
        is_active=False,
    )
    db.add(employee)
    try:
        db.commit()
        db.refresh(employee)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Логин, email или паспорт уже зарегистрирован",
        ) from exc

    return {
        "employee": employee,
        "activation_url": _build_activation_url(invite_token),
    }


@router.post(
    "/employees/{employee_id}/activation-link",
    response_model=schemas.EmployeeInviteResponse,
)
def regenerate_activation_link(
    employee_id: int,
    registrar: models.Employee = Depends(require_roles(*_REGISTRAR_ROLES)),
    db: Session = Depends(get_db),
):
    employee = (
        db.query(models.Employee)
        .options(joinedload(models.Employee.role))
        .filter(models.Employee.id == employee_id)
        .first()
    )
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сотрудник не найден",
        )
    if employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя создать ссылку для уже активированного сотрудника",
        )

    invite_token = secrets.token_urlsafe(32)
    updated = db.execute(
        update(models.Employee)
        .where(
            models.Employee.id == employee_id,
            models.Employee.is_active.is_(False),
        )
        .values(
            invite_token=hashlib.sha256(invite_token.encode("utf-8")).hexdigest(),
        )
    )
    if updated.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя создать ссылку для уже активированного сотрудника",
        )
    db.commit()
    db.refresh(employee)
    return {
        "employee": employee,
        "activation_url": _build_activation_url(invite_token),
    }


@router.post(
    "/employees/{employee_id}/block",
    response_model=schemas.EmployeeResponse,
)
def block_employee(
    employee_id: int,
    registrar: models.Employee = Depends(require_roles(*_REGISTRAR_ROLES)),
    db: Session = Depends(get_db),
):
    employee = (
        db.query(models.Employee)
        .options(joinedload(models.Employee.role))
        .filter(models.Employee.id == employee_id)
        .first()
    )
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сотрудник не найден",
        )
    if employee_id == registrar.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя заблокировать собственную учетную запись",
        )
    if employee.role.slug == "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учетную запись директора нельзя заблокировать",
        )
    employee_level = _ROLE_HIERARCHY.get(employee.role.slug)
    registrar_level = _ROLE_HIERARCHY.get(registrar.role.slug)
    if (
        employee_level is None
        or registrar_level is None
        or employee_level >= registrar_level
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя блокировать сотрудника с равной или более высокой ролью",
        )

    db.execute(
        update(models.Employee)
        .where(models.Employee.id == employee_id)
        .values(is_active=False, invite_token=None)
    )
    (
        db.query(models.EmployeeRefreshSession)
        .filter(models.EmployeeRefreshSession.employee_id == employee_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    db.refresh(employee)
    return employee
