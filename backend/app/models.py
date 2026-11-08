import datetime

from sqlalchemy import Column, Date, DateTime, Index, Integer, String

from .database import Base


class Client(Base):
    __tablename__ = "clients"

    __table_args__ = (
        Index("ix_clients_full_name", "last_name", "first_name", "father_name"),
    )

    # Уникальный идентификатор
    id = Column(Integer, primary_key=True)
    
    # Документы: Паспорт РФ (для внутренних договоров)
    last_name = Column(String(50), nullable=False)
    first_name = Column(String(50), nullable=False)
    father_name = Column(String(50), nullable=True)
    passport_number = Column(String(10), nullable=False, unique=True) 
    birth_date = Column(Date, nullable=False)

    # Документы: Загранпаспорт 
    foreign_passport_number = Column(String(9), nullable=False, unique=True)
    latin_first_name = Column(String(50), nullable=False)
    latin_last_name = Column(String(50), nullable=False)
    foreign_passport_expire_date = Column(Date, nullable=False)

    # Контактные данные
    phone = Column(String(15), nullable=False)
    email = Column(String(255), nullable=False)
    
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
