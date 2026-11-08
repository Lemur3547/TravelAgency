from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/clients", tags=["Clients"])

_REQUIRED_FIELDS = {
    "last_name",
    "first_name",
    "passport_number",
    "birth_date",
    "foreign_passport_number",
    "latin_first_name",
    "latin_last_name",
    "foreign_passport_expire_date",
    "phone",
    "email",
}


@router.get("/", response_model=schemas.ClientPageResponse)
def read_clients(
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    normalized_search = search.strip() if search and search.strip() else None
    return {
        "items": crud.get_clients(
            db,
            offset=offset,
            limit=limit,
            search=normalized_search,
        ),
        "total": crud.count_clients(db, search=normalized_search),
    }


@router.get("/{client_id}", response_model=schemas.ClientResponse)
def read_client(client_id: int, db: Session = Depends(get_db)):
    db_client = crud.get_client(db, client_id)
    if db_client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    return db_client


@router.post(
    "/",
    response_model=schemas.ClientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_client(db, client)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Паспортные данные уже зарегистрированы",
        ) from exc


@router.put("/{client_id}", response_model=schemas.ClientResponse)
def update_client(
    client_id: int,
    client_update: schemas.ClientUpdate,
    db: Session = Depends(get_db),
):
    db_client = crud.get_client(db, client_id)
    if db_client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")

    update_data = client_update.model_dump(exclude_unset=True)
    if any(field in _REQUIRED_FIELDS and value is None for field, value in update_data.items()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Обязательные поля нельзя сбросить в null",
        )

    try:
        return crud.update_client(db, db_client, client_update)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Паспортные данные уже зарегистрированы",
        ) from exc


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    db_client = crud.get_client(db, client_id)
    if db_client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    crud.delete_client(db, db_client)
