from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api", tags=["Destinations"])


@router.get("/destinations", response_model=list[schemas.DestinationResponse])
@router.get("/destinations/", response_model=list[schemas.DestinationResponse])
def read_destinations(db: Session = Depends(get_db)):
    return crud.get_destinations(db)


@router.get("/countries", response_model=list[schemas.CountryResponse])
def read_countries(db: Session = Depends(get_db)):
    return crud.get_countries(db)


@router.post(
    "/countries",
    response_model=schemas.CountryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_country(country: schemas.CountryCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_country(db, country)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Такая страна уже зарегистрирована",
        ) from exc


@router.get(
    "/destinations/{country_slug}",
    response_model=list[schemas.DestinationResponse],
)
def read_country_destinations(country_slug: str, db: Session = Depends(get_db)):
    return crud.get_destinations_by_country_slug(db, country_slug)


@router.get(
    "/destinations/{country_slug}/{destination_slug}",
    response_model=list[schemas.DestinationResponse],
)
def read_child_destinations(
    country_slug: str,
    destination_slug: str,
    db: Session = Depends(get_db),
):
    return crud.get_child_destinations(db, country_slug, destination_slug)


@router.post(
    "/destinations",
    response_model=schemas.DestinationResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/destinations/",
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
            detail="Указанная страна или родительское направление не существуют",
        ) from exc
