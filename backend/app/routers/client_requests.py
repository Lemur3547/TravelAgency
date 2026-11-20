from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth_dependencies import get_current_employee, require_roles
from ..database import get_db


router = APIRouter(
    prefix="/api/requests",
    tags=["Client requests"],
    dependencies=[Depends(require_roles("client_manager", "director"))],
)


def _validate_references(
    db: Session,
    client_id: int,
    departure_city_id: int,
    directions: list[schemas.DesiredDirectionItem],
) -> None:
    if db.get(models.Client, client_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Указанный клиент не найден",
        )
    if db.get(models.DepartureCity, departure_city_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Указанный город вылета не найден",
        )

    country_ids = {item.id for item in directions if item.kind == "country"}
    destination_ids = {item.id for item in directions if item.kind == "destination"}
    found_country_ids = {
        row[0]
        for row in db.query(models.Country.id)
        .filter(models.Country.id.in_(country_ids))
        .all()
    } if country_ids else set()
    found_destination_ids = {
        row[0]
        for row in db.query(models.Destination.id)
        .filter(models.Destination.id.in_(destination_ids))
        .all()
    } if destination_ids else set()

    if found_country_ids != country_ids or found_destination_ids != destination_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Одно или несколько направлений не найдены",
        )


@router.get("/", response_model=list[schemas.ClientRequestResponse])
def read_client_requests(db: Session = Depends(get_db)):
    return crud.get_client_requests(db)


@router.get("/{request_id}", response_model=schemas.ClientRequestResponse)
def read_client_request(request_id: int, db: Session = Depends(get_db)):
    db_request = crud.get_client_request(db, request_id)
    if db_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    return db_request


@router.post(
    "/",
    response_model=schemas.ClientRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client_request(
    client_request: schemas.ClientRequestCreate,
    employee: models.Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    _validate_references(
        db,
        client_request.client_id,
        client_request.departure_city_id,
        client_request.desired_direction,
    )
    return crud.create_client_request(db, client_request, employee.id)


@router.put("/{request_id}", response_model=schemas.ClientRequestResponse)
def update_client_request(
    request_id: int,
    client_request: schemas.ClientRequestUpdate,
    db: Session = Depends(get_db),
):
    db_request = crud.get_client_request(db, request_id)
    if db_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    _validate_references(
        db,
        client_request.client_id,
        client_request.departure_city_id,
        client_request.desired_direction,
    )
    return crud.update_client_request(db, db_request, client_request)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_request(request_id: int, db: Session = Depends(get_db)):
    db_request = crud.get_client_request(db, request_id)
    if db_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    try:
        crud.delete_client_request(db, db_request)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя удалить заявку, по которой оформлен заказ",
        ) from exc
