from fastapi import Depends, HTTPException, Request, status
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decode_token


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
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия истекла или недействительна",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    employee = db.get(models.Employee, employee_id)
    if employee is None or not employee.is_active:
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
