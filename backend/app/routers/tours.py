from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/tours", tags=["Tours"])


@router.get("/", response_model=list[schemas.TourResponse])
def read_tours(db: Session = Depends(get_db)):
    return crud.get_tours(db)


@router.get("/{tour_id}", response_model=schemas.TourResponse)
def read_tour(tour_id: int, db: Session = Depends(get_db)):
    db_tour = crud.get_tour(db, tour_id)
    if db_tour is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тур не найден")
    return db_tour


@router.post(
    "/",
    response_model=schemas.TourResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tour(tour: schemas.TourCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_tour(db, tour)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Указанный туроператор или направление не найдено",
        ) from exc


@router.put("/{tour_id}", response_model=schemas.TourResponse)
def update_tour(
    tour_id: int,
    tour_update: schemas.TourUpdate,
    db: Session = Depends(get_db),
):
    db_tour = crud.get_tour(db, tour_id)
    if db_tour is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тур не найден")

    update_data = tour_update.model_dump(exclude_unset=True)
    if any(value is None for value in update_data.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Поля тура нельзя сбросить в null",
        )

    try:
        return crud.update_tour(db, db_tour, tour_update)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Указанный туроператор или направление не найдено",
        ) from exc


@router.delete("/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tour(tour_id: int, db: Session = Depends(get_db)):
    db_tour = crud.get_tour(db, tour_id)
    if db_tour is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тур не найден")
    crud.delete_tour(db, db_tour)
