import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

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


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(50), nullable=False, unique=True)

    employees = relationship("Employee", back_populates="role")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)
    last_name = Column(String(50), nullable=False)
    first_name = Column(String(50), nullable=False)
    father_name = Column(String(50), nullable=True)
    passport_number = Column(String(10), nullable=False, unique=True)
    login = Column(String(100), nullable=False, unique=True)
    password = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False, unique=True)
    phone = Column(String(15), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
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
    is_active = Column(Boolean, nullable=False, default=False)
    invite_token = Column(String(64), nullable=True, unique=True)

    role = relationship("Role", back_populates="employees")
    refresh_sessions = relationship(
        "EmployeeRefreshSession",
        back_populates="employee",
        cascade="all, delete-orphan",
    )


class EmployeeRefreshSession(Base):
    __tablename__ = "employee_refresh_sessions"

    id = Column(Integer, primary_key=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jti = Column(String(64), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    employee = relationship("Employee", back_populates="refresh_sessions")


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


class Country(Base):
    __tablename__ = "countries"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)


class Destination(Base):
    __tablename__ = "destinations"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=False, index=True)
    parent_id = Column(
        Integer, ForeignKey("destinations.id"), nullable=True, index=True
    )


class DepartureCity(Base):
    __tablename__ = "departure_cities"
    __table_args__ = (UniqueConstraint("name", name="uq_departure_cities_name"),)

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)

    tours = relationship("Tour", back_populates="departure")


class Tour(Base):
    __tablename__ = "tours"

    id = Column(Integer, primary_key=True)
    operator_id = Column(
        Integer, ForeignKey("tour_operators.id"), nullable=False, index=True
    )
    title = Column(String(255), nullable=False)
    destination_id = Column(
        Integer, ForeignKey("destinations.id"), nullable=False, index=True
    )
    departure_city_id = Column(
        Integer, ForeignKey("departure_cities.id"), nullable=False, index=True
    )
    departure = relationship("DepartureCity", back_populates="tours")
    hotel_name = Column(String(255), nullable=False)
    room_type = Column(String(100), nullable=False)
    meal_types = Column(JSON, nullable=False)
    start_date = Column(Date, nullable=False)
    nights = Column(Integer, nullable=False)
    tourists = Column(Integer, nullable=False)
    description = Column(Text, nullable=False, default="")
    is_available = Column(Boolean, nullable=False, default=True)
    client_price = Column(Numeric(12, 2), nullable=False)
    commission_percent = Column(Numeric(5, 2), nullable=False)
    agency_price = Column(Numeric(12, 2), nullable=False)
    agency_commission = Column(Numeric(12, 2), nullable=False)

    @property
    def departure_city(self):
        return self.departure.name
