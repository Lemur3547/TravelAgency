from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/tour-operators", tags=["Tour operators"])


@router.get("/", response_model=list[schemas.TourOperatorResponse])
def read_tour_operators(
    search: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    normalized_search = search.strip() if search and search.strip() else None
    return crud.get_tour_operators(db, search=normalized_search)


@router.get("/{tour_operator_id}", response_model=schemas.TourOperatorResponse)
def read_tour_operator(tour_operator_id: int, db: Session = Depends(get_db)):
    db_tour_operator = crud.get_tour_operator(db, tour_operator_id)
    if db_tour_operator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Туроператор не найден",
        )
    return db_tour_operator


@router.post(
    "/",
    response_model=schemas.TourOperatorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tour_operator(
    tour_operator: schemas.TourOperatorCreate,
    db: Session = Depends(get_db),
):
    try:
        return crud.create_tour_operator(db, tour_operator)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Туроператор с таким ИНН уже зарегистрирован",
        ) from exc


@router.put(
    "/{tour_operator_id}",
    response_model=schemas.TourOperatorResponse,
)
def update_tour_operator(
    tour_operator_id: int,
    tour_operator_update: schemas.TourOperatorUpdate,
    db: Session = Depends(get_db),
):
    db_tour_operator = crud.get_tour_operator(db, tour_operator_id)
    if db_tour_operator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Туроператор не найден",
        )

    update_data = tour_operator_update.model_dump(exclude_unset=True)
    if any(value is None for value in update_data.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Поля туроператора нельзя сбросить в null",
        )

    try:
        return crud.update_tour_operator(db, db_tour_operator, tour_operator_update)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Туроператор с таким ИНН уже зарегистрирован",
        ) from exc


@router.delete(
    "/{tour_operator_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_tour_operator(tour_operator_id: int, db: Session = Depends(get_db)):
    db_tour_operator = crud.get_tour_operator(db, tour_operator_id)
    if db_tour_operator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Туроператор не найден",
        )
    crud.delete_tour_operator(db, db_tour_operator)
