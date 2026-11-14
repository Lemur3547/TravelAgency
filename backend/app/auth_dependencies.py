from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decode_token


def get_active_refresh_session(
    db: Session,
    employee_id: int,
    session_id: str,
) -> models.EmployeeRefreshSession | None:
    try:
        session_pk = int(session_id)
    except ValueError:
        return None
    refresh_session = (
        db.query(models.EmployeeRefreshSession)
        .filter(
            models.EmployeeRefreshSession.id == session_pk,
            models.EmployeeRefreshSession.employee_id == employee_id,
        )
        .first()
    )
    if refresh_session is None:
        return None
    expires_at = refresh_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        return None
    return refresh_session


def get_current_employee(
    request: Request,
    db: Session = Depends(get_db),
) -> models.Employee:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = decode_token(token)
        if claims.get("type") != "access":
            raise InvalidTokenError("Неверный тип токена")
        employee_id = int(claims["sub"])
        session_id = claims["sid"]
        if not isinstance(session_id, str) or not session_id:
            raise InvalidTokenError("В токене отсутствует идентификатор сессии")
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия истекла или недействительна",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    employee = db.get(models.Employee, employee_id)
    if (
        employee is None
        or not employee.is_active
        or get_active_refresh_session(db, employee_id, session_id) is None
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Учетная запись неактивна или не найдена",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return employee


def require_roles(*allowed_slugs: str):
    def role_dependency(
        employee: models.Employee = Depends(get_current_employee),
    ) -> models.Employee:
        if employee.role.slug not in allowed_slugs:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав",
            )
        return employee

    return role_dependency
