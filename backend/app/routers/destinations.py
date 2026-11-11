from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/destinations", tags=["Destinations"])


@router.get("/", response_model=list[schemas.DestinationResponse])
def read_destinations(db: Session = Depends(get_db)):
    return crud.get_destinations(db)


@router.get("/countries", response_model=list[schemas.CountryResponse])
def read_countries(db: Session = Depends(get_db)):
    return crud.get_countries(db)


@router.get(
    "/{country_slug}/cities",
    response_model=list[schemas.CityResponse],
)
def read_cities(country_slug: str, db: Session = Depends(get_db)):
    return crud.get_cities_by_country_slug(db, country_slug)


@router.post(
    "/",
    response_model=schemas.DestinationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_destination(
    destination: schemas.DestinationCreate,
    db: Session = Depends(get_db),
):
    try:
        return crud.create_destination(db, destination)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Такое направление уже зарегистрировано",
        ) from exc
