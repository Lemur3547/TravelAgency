from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth_dependencies import get_current_employee, require_roles
from ..database import get_db


router = APIRouter(
    prefix="/api/orders",
    tags=["Orders"],
    dependencies=[Depends(require_roles("client_manager", "director"))],
)


@router.get("/", response_model=list[schemas.OrderResponse])
def read_orders(db: Session = Depends(get_db)):
    return crud.get_orders(db)


@router.get("/{order_id}", response_model=schemas.OrderResponse)
def read_order(order_id: int, db: Session = Depends(get_db)):
    db_order = crud.get_order(db, order_id)
    if db_order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден",
        )
    return db_order


@router.post(
    "/",
    response_model=schemas.OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    order: schemas.OrderCreate,
    employee: models.Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    client_request = db.get(models.ClientRequest, order.request_id)
    if client_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )

    if db.get(models.Client, order.client_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден",
        )
    if client_request.client_id != order.client_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Клиент должен совпадать с клиентом заявки",
        )

    tour = db.get(models.Tour, order.tour_id)
    if tour is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тур не найден",
        )
    if not tour.is_available:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Нельзя оформить заказ на недоступный тур",
        )

    try:
        return crud.create_order(db, order, employee.id)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Не удалось оформить заказ: связанные данные изменились",
        ) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put("/{order_id}", response_model=schemas.OrderResponse)
def update_order(
    order_id: int,
    order_update: schemas.OrderUpdate,
    db: Session = Depends(get_db),
):
    db_order = crud.get_order(db, order_id)
    if db_order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден",
        )

    update_data = order_update.model_dump(exclude_unset=True)
    if any(
        value is None for field, value in update_data.items() if field != "note"
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Обязательные поля заказа нельзя сбросить в null",
        )

    if "request_id" in update_data and "client_id" not in update_data:
        client_request = db.get(models.ClientRequest, update_data["request_id"])
        if client_request is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Заявка не найдена",
            )
        update_data["client_id"] = client_request.client_id

    request_id = update_data.get("request_id", db_order.request_id)
    client_id = update_data.get("client_id", db_order.client_id)
    tour_id = update_data.get("tour_id", db_order.tour_id)
    client_request = db.get(models.ClientRequest, request_id)
    if client_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    if db.get(models.Client, client_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден",
        )
    if client_request.client_id != client_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Клиент должен совпадать с клиентом заявки",
        )

    tour = db.get(models.Tour, tour_id)
    if tour is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тур не найден",
        )
    if tour_id != db_order.tour_id and not tour.is_available:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Нельзя изменить заказ на недоступный тур",
        )

    try:
        return crud.update_order(
            db,
            db_order,
            schemas.OrderUpdate.model_validate(update_data),
        )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Не удалось обновить заказ: связанные данные изменились",
        ) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    db_order = crud.get_order(db, order_id)
    if db_order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден",
        )
    crud.delete_order(db, db_order)
