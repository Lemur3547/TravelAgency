from typing import List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from . import models, schemas


def _client_search_query(db: Session, search: Optional[str]):
    query = db.query(models.Client)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Client.last_name.ilike(pattern),
                models.Client.first_name.ilike(pattern),
                models.Client.father_name.ilike(pattern),
                models.Client.phone.ilike(pattern),
                models.Client.email.ilike(pattern),
                models.Client.passport_number.ilike(pattern),
                models.Client.foreign_passport_number.ilike(pattern),
            )
        )
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
