from typing import List, Optional
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session, aliased

from . import models, schemas

def _client_search_query(db: Session, search: Optional[str]):
    query = db.query(models.Client)
    
    if search:
        # 1. Разбираем строку на отдельные слова и убираем лишние пробелы
        words = [word.strip() for word in search.split() if word.strip()]
        
        # Список условий для каждого слова
        word_filters = []
        
        for word in words:
            pattern = f"%{word}%"
            # Для КАЖДОГО слова создаем блок OR (слово должно быть хоть в одном поле)
            word_condition = or_(
                models.Client.last_name.ilike(pattern),
                models.Client.first_name.ilike(pattern),
                models.Client.father_name.ilike(pattern),
                models.Client.phone.ilike(pattern),
                models.Client.email.ilike(pattern),
                models.Client.passport_number.ilike(pattern),
                models.Client.foreign_passport_number.ilike(pattern),
            )
            word_filters.append(word_condition)
        
        # 2. Объединяем условия через AND (все слова должны совпасть)
        if word_filters:
            query = query.filter(and_(*word_filters))
            
    return query

def get_clients(
    db: Session,
    offset: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
) -> List[models.Client]:
    return (
        _client_search_query(db, search)
        .order_by(models.Client.id)
        .offset(offset)
        .limit(limit)
        .all()
    )


def count_clients(db: Session, search: Optional[str] = None) -> int:
    return _client_search_query(db, search).with_entities(func.count(models.Client.id)).scalar() or 0


def get_client(db: Session, client_id: int) -> Optional[models.Client]:
    return db.query(models.Client).filter(models.Client.id == client_id).first()


def create_client(db: Session, client: schemas.ClientCreate) -> models.Client:
    db_client = models.Client(**client.model_dump())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


def update_client(
    db: Session,
    db_client: models.Client,
    client_update: schemas.ClientUpdate,
) -> models.Client:
    update_data = client_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_client, field, value)
    db.commit()
    db.refresh(db_client)
    return db_client


def delete_client(db: Session, db_client: models.Client) -> None:
    db.delete(db_client)
    db.commit()


def _tour_operator_search_query(db: Session, search: Optional[str]):
    query = db.query(models.TourOperator)

    if search:
        words = [word.strip() for word in search.split() if word.strip()]
        word_filters = []

        for word in words:
            pattern = f"%{word}%"
            word_filters.append(
                or_(
                    models.TourOperator.name.ilike(pattern),
                    models.TourOperator.legal_name.ilike(pattern),
                    models.TourOperator.inn.ilike(pattern),
                    models.TourOperator.address.ilike(pattern),
                    models.TourOperator.phone.ilike(pattern),
                    models.TourOperator.email.ilike(pattern),
                    models.TourOperator.website.ilike(pattern),
                )
            )

        if word_filters:
            query = query.filter(and_(*word_filters))

    return query


def get_tour_operators(
    db: Session,
    search: Optional[str] = None,
) -> List[models.TourOperator]:
    return (
        _tour_operator_search_query(db, search)
        .order_by(models.TourOperator.is_active.desc(), models.TourOperator.id)
        .all()
    )


def get_tour_operator(db: Session, tour_operator_id: int) -> Optional[models.TourOperator]:
    return (
        db.query(models.TourOperator)
        .filter(models.TourOperator.id == tour_operator_id)
        .first()
    )


def create_tour_operator(
    db: Session,
    tour_operator: schemas.TourOperatorCreate,
) -> models.TourOperator:
    db_tour_operator = models.TourOperator(**tour_operator.model_dump())
    db.add(db_tour_operator)
    db.commit()
    db.refresh(db_tour_operator)
    return db_tour_operator


def update_tour_operator(
    db: Session,
    db_tour_operator: models.TourOperator,
    tour_operator_update: schemas.TourOperatorUpdate,
) -> models.TourOperator:
    update_data = tour_operator_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_tour_operator, field, value)
    db.commit()
    db.refresh(db_tour_operator)
    return db_tour_operator


def delete_tour_operator(db: Session, db_tour_operator: models.TourOperator) -> None:
    db.delete(db_tour_operator)
    db.commit()


def get_destinations(db: Session) -> List[models.Destination]:
    return (
        db.query(models.Destination)
        .order_by(
            models.Destination.country_id,
            models.Destination.name,
            models.Destination.id,
        )
        .all()
    )


def get_countries(db: Session) -> List[models.Country]:
    return (
        db.query(models.Country)
        .order_by(models.Country.name, models.Country.id)
        .all()
    )


def get_destinations_by_country_slug(
    db: Session,
    country_slug: str,
) -> List[models.Destination]:
    return (
        db.query(models.Destination)
        .join(models.Country)
        .filter(
            models.Country.slug == country_slug,
        )
        .order_by(models.Destination.name, models.Destination.id)
        .all()
    )


def get_child_destinations(
    db: Session,
    country_slug: str,
    destination_slug: str,
) -> List[models.Destination]:
    parent = aliased(models.Destination)
    return (
        db.query(models.Destination)
        .join(models.Country, models.Destination.country_id == models.Country.id)
        .join(parent, models.Destination.parent_id == parent.id)
        .filter(
            models.Country.slug == country_slug,
            parent.slug == destination_slug,
            parent.country_id == models.Country.id,
        )
        .order_by(models.Destination.name, models.Destination.id)
        .all()
    )


def create_country(db: Session, country: schemas.CountryCreate) -> models.Country:
    db_country = models.Country(**country.model_dump())
    db.add(db_country)
    db.commit()
    db.refresh(db_country)
    return db_country


def create_destination(
    db: Session,
    destination: schemas.DestinationCreate,
) -> models.Destination:
    db_destination = models.Destination(**destination.model_dump())
    db.add(db_destination)
    db.commit()
    db.refresh(db_destination)
    return db_destination


def _tour_prices(client_price: Decimal, commission_percent: Decimal) -> tuple[Decimal, Decimal]:
    commission = (client_price * commission_percent / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return (client_price - commission).quantize(Decimal("0.01")), commission


def get_tours(db: Session) -> List[models.Tour]:
    return db.query(models.Tour).order_by(models.Tour.start_date, models.Tour.id).all()


def get_tour(db: Session, tour_id: int) -> Optional[models.Tour]:
    return db.query(models.Tour).filter(models.Tour.id == tour_id).first()


def create_tour(db: Session, tour: schemas.TourCreate) -> models.Tour:
    data = tour.model_dump()
    data["agency_price"], data["agency_commission"] = _tour_prices(
        data["client_price"], data["commission_percent"]
    )
    db_tour = models.Tour(**data)
    db.add(db_tour)
    db.commit()
    db.refresh(db_tour)
    return db_tour


def update_tour(
    db: Session,
    db_tour: models.Tour,
    tour_update: schemas.TourUpdate,
) -> models.Tour:
    update_data = tour_update.model_dump(exclude_unset=True)
    client_price = update_data.get("client_price", db_tour.client_price)
    commission_percent = update_data.get(
        "commission_percent", db_tour.commission_percent
    )
    update_data["agency_price"], update_data["agency_commission"] = _tour_prices(
        client_price, commission_percent
    )
    for field, value in update_data.items():
        setattr(db_tour, field, value)
    db.commit()
    db.refresh(db_tour)
    return db_tour


def delete_tour(db: Session, db_tour: models.Tour) -> None:
    db.delete(db_tour)
    db.commit()
