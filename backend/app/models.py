import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Index,
    Integer,
    String,
    UniqueConstraint,
)

from .database import Base


class Client(Base):
    __tablename__ = "clients"

    __table_args__ = (
        Index("ix_clients_full_name", "last_name", "first_name", "father_name"),
    )

    # Уникальный идентификатор
    id = Column(Integer, primary_key=True)
    
    # Основная информация
    last_name = Column(String(50), nullable=False)
    first_name = Column(String(50), nullable=False)
    father_name = Column(String(50), nullable=True)

    phone = Column(String(15), nullable=False)
    email = Column(String(255), nullable=False)

    # Документы
    passport_number = Column(String(10), nullable=True, unique=True)
    birth_date = Column(Date, nullable=True)
    foreign_passport_number = Column(String(9), nullable=True, unique=True)
    latin_first_name = Column(String(50), nullable=True)
    latin_last_name = Column(String(50), nullable=True)
    foreign_passport_expire_date = Column(Date, nullable=True)

    # Таймстампы
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )

class TourOperator(Base):
    __tablename__ = "tour_operators"

    id = Column(Integer, primary_key=True)

    # Документы: Юридическое лицо
    name = Column(String(50), nullable=False)
    legal_name = Column(String(255), nullable=False)
    inn = Column(String(10), unique=True, nullable=False)
    address = Column(String(255), nullable=False)

    # Контактные данные
    phone = Column(String(15), nullable=False)
    email = Column(String(255), nullable=False)
    website = Column(String(255), nullable=False)

    # Статус сотруднчества
    is_active = Column(Boolean, nullable=False, default=True)

    # Таймстампы
    created_at = Column(
            DateTime(timezone=True),
            nullable=False,
            default=lambda: datetime.datetime.now(datetime.timezone.utc),
        )


class Destination(Base):
    __tablename__ = "destinations"
    __table_args__ = (
        UniqueConstraint("country", "city", name="uq_destinations_country_city"),
        UniqueConstraint(
            "country_slug",
            "city_slug",
            name="uq_destinations_country_slug_city_slug",
        ),
    )

    id = Column(Integer, primary_key=True)
    country = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    country_slug = Column(String(100), nullable=False)
    city_slug = Column(String(100), nullable=False)
