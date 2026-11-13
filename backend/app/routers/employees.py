import hashlib
import os
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth_dependencies import require_roles
from ..database import get_db


router = APIRouter(prefix="/api/admin", tags=["Employees"])
_REGISTRAR_ROLES = ("admin", "director")
_MANAGER_ROLE_SLUGS = {"client_manager", "product_manager"}


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

    activation_base_url = os.getenv(
        "ACTIVATION_URL_BASE", "http://localhost:5173/activate"
    ).rstrip("?&")
    separator = "&" if "?" in activation_base_url else "?"
    return {
        "employee": employee,
        "activation_url": (
            f"{activation_base_url}{separator}{urlencode({'token': invite_token})}"
        ),
    }
