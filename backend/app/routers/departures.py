from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api", tags=["Departure cities"])


@router.get(
    "/departures",
    response_model=list[schemas.DepartureCityResponse],
)
@router.get(
    "/departures/",
    response_model=list[schemas.DepartureCityResponse],
)
def read_departure_cities(db: Session = Depends(get_db)):
    return crud.get_departure_cities(db)


@router.post(
    "/departures",
    response_model=schemas.DepartureCityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_departure_city(
    departure_city: schemas.DepartureCityCreate,
    db: Session = Depends(get_db),
):
    try:
        return crud.create_departure_city(db, departure_city)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Такой город вылета уже зарегистрирован",
        ) from exc
