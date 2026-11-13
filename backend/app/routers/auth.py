import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jwt import InvalidTokenError
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import (
    ACCESS_TOKEN_MINUTES,
    REFRESH_TOKEN_DAYS,
    access_token_expiry,
    cookie_settings,
    create_token,
    create_token_id,
    decode_token,
    hash_password,
    refresh_token_expiry,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["Authentication"])
_ACCESS_COOKIE = "access_token"
_REFRESH_COOKIE = "refresh_token"


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    secure, same_site = cookie_settings()
    common_settings = {
        "httponly": True,
        "secure": secure,
        "samesite": same_site,
        "path": "/",
    }
    response.set_cookie(
        _ACCESS_COOKIE,
        access_token,
        max_age=ACCESS_TOKEN_MINUTES * 60,
        **common_settings,
    )
    response.set_cookie(
        _REFRESH_COOKIE,
        refresh_token,
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        **common_settings,
    )


def _clear_auth_cookies(response: Response) -> None:
    secure, same_site = cookie_settings()
    response.delete_cookie(
        _ACCESS_COOKIE,
        path="/",
        httponly=True,
        secure=secure,
        samesite=same_site,
    )
    response.delete_cookie(
        _REFRESH_COOKIE,
        path="/",
        httponly=True,
        secure=secure,
        samesite=same_site,
    )


def _issue_auth_tokens(
    db: Session,
    employee: models.Employee,
    session: models.EmployeeRefreshSession | None = None,
) -> tuple[str, str]:
    access_expires_at = access_token_expiry()
    refresh_expires_at = refresh_token_expiry()
    refresh_jti = create_token_id()
    refresh_token = create_token(
        employee.id, "refresh", refresh_jti, refresh_expires_at
    )
    if session is None:
        db.add(
            models.EmployeeRefreshSession(
                employee_id=employee.id,
                jti=refresh_jti,
                expires_at=refresh_expires_at,
            )
        )
    else:
        session.jti = refresh_jti
        session.expires_at = refresh_expires_at
    db.commit()
    access_token = create_token(
        employee.id, "access", create_token_id(), access_expires_at
    )
    return access_token, refresh_token


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверный логин или пароль, либо учетная запись неактивна",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _has_open_session(request: Request, db: Session) -> bool:
    access_token = request.cookies.get(_ACCESS_COOKIE)
    if access_token:
        try:
            claims = decode_token(access_token)
            if claims.get("type") == "access":
                employee = db.get(models.Employee, int(claims["sub"]))
                if employee is not None and employee.is_active:
                    return True
        except (InvalidTokenError, KeyError, TypeError, ValueError):
            pass

    refresh_token = request.cookies.get(_REFRESH_COOKIE)
    if not refresh_token:
        return False
    try:
        claims = decode_token(refresh_token)
        if claims.get("type") != "refresh":
            return False
        employee_id = int(claims["sub"])
        refresh_jti = claims["jti"]
    except (InvalidTokenError, KeyError, TypeError, ValueError):
        return False

    refresh_session = (
        db.query(models.EmployeeRefreshSession)
        .filter(
            models.EmployeeRefreshSession.jti == refresh_jti,
            models.EmployeeRefreshSession.employee_id == employee_id,
        )
        .first()
    )
    employee = db.get(models.Employee, employee_id)
    if refresh_session is None or employee is None or not employee.is_active:
        return False

    expires_at = refresh_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at > datetime.now(timezone.utc)


def _require_signed_out(request: Request, db: Session) -> None:
    if _has_open_session(request, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Выйдите из текущей учетной записи, чтобы выполнить это действие",
        )


@router.post("/setup", response_model=schemas.EmployeeResponse)
def setup_director(
    request_data: schemas.DirectorSetupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _require_signed_out(request, db)
    db.execute(
        update(models.Role)
        .where(models.Role.slug == "director")
        .values(slug=models.Role.slug)
    )
    director_role = (
        db.query(models.Role)
        .filter(models.Role.slug == "director")
        .first()
    )
    if director_role is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Роли не инициализированы. Выполните миграции базы данных",
        )
    if db.query(models.Employee.id).first() is not None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Первоначальная настройка уже выполнена",
        )

    employee_data = request_data.model_dump(exclude={"password"})
    employee = models.Employee(
        **employee_data,
        role_id=director_role.id,
        password=hash_password(request_data.password),
        invite_token=None,
        is_active=True,
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

    access_token, refresh_token = _issue_auth_tokens(db, employee)
    _set_auth_cookies(response, access_token, refresh_token)
    return employee


@router.post("/login", response_model=schemas.EmployeeResponse)
def login(
    credentials: schemas.LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _require_signed_out(request, db)
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.login == credentials.login.strip().lower())
        .first()
    )
    valid_password = verify_password(
        credentials.password,
        employee.password if employee is not None else None,
    )
    if employee is None or not employee.is_active or not valid_password:
        raise _unauthorized()

    access_token, refresh_token = _issue_auth_tokens(db, employee)
    _set_auth_cookies(response, access_token, refresh_token)
    return employee


@router.post("/activate", response_model=schemas.EmployeeResponse)
def activate_account(
    request_data: schemas.ActivateAccountRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _require_signed_out(request, db)
    token_digest = hashlib.sha256(
        request_data.invite_token.encode("utf-8")
    ).hexdigest()
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.invite_token == token_digest)
        .first()
    )
    if employee is None or employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка активации недействительна или уже использована",
        )

    employee_id = employee.id
    updated = db.execute(
        update(models.Employee)
        .where(
            models.Employee.id == employee_id,
            models.Employee.invite_token == token_digest,
            models.Employee.is_active.is_(False),
        )
        .values(
            password=hash_password(request_data.password),
            invite_token=None,
            is_active=True,
            updated_at=datetime.now(timezone.utc),
        )
    )
    if updated.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка активации недействительна или уже использована",
        )
    db.commit()
    employee = db.get(models.Employee, employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Учетная запись не найдена",
        )
    db.refresh(employee)
    access_token, refresh_token = _issue_auth_tokens(db, employee)
    _set_auth_cookies(response, access_token, refresh_token)
    return employee


@router.post("/refresh", response_model=schemas.EmployeeResponse)
def refresh_authentication(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(_REFRESH_COOKIE)
    if not token:
        raise _unauthorized()
    try:
        claims = decode_token(token)
        if claims.get("type") != "refresh":
            raise InvalidTokenError("Неверный тип токена")
        employee_id = int(claims["sub"])
        refresh_jti = claims["jti"]
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise _unauthorized() from exc

    refresh_session = (
        db.query(models.EmployeeRefreshSession)
        .filter(
            models.EmployeeRefreshSession.jti == refresh_jti,
            models.EmployeeRefreshSession.employee_id == employee_id,
        )
        .with_for_update()
        .first()
    )
    employee = db.get(models.Employee, employee_id)
    expires_at = refresh_session.expires_at if refresh_session is not None else None
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if (
        refresh_session is None
        or employee is None
        or not employee.is_active
        or expires_at <= datetime.now(timezone.utc)
    ):
        raise _unauthorized()

    access_token, refresh_token = _issue_auth_tokens(
        db, employee, session=refresh_session
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return employee


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(_REFRESH_COOKIE)
    if token:
        try:
            claims = decode_token(token)
            if claims.get("type") == "refresh":
                refresh_session = (
                    db.query(models.EmployeeRefreshSession)
                    .filter(
                        models.EmployeeRefreshSession.jti == claims.get("jti"),
                        models.EmployeeRefreshSession.employee_id == int(claims["sub"]),
                    )
                    .first()
                )
                if refresh_session is not None:
                    db.delete(refresh_session)
                    db.commit()
        except (InvalidTokenError, KeyError, TypeError, ValueError):
            pass
    _clear_auth_cookies(response)
