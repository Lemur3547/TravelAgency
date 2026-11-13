import os
from pathlib import Path
from typing import Generator
import sqlite3

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{Path(__file__).resolve().parents[1] / 'travel_agency.db'}",
)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

if DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def sqlite_tune_connection(dbapi_connection, connection_record):
        if isinstance(dbapi_connection, sqlite3.Connection):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")
            # Исправляем функцию LOWER для поддержки кириллицы
            dbapi_connection.create_function("lower", 1, lambda s: s.lower() if s else s)
            
            # Переопределяем оператор LIKE, чтобы он сравнивал строки через Python
            def sqlite_like(pattern, string):
                if pattern is None or string is None:
                    return False
                
                # Приводим к нижнему регистру силами Python (работает с кириллицей)
                pattern = str(pattern).lower()
                string = str(string).lower()
                
                # Убираем знаки % по краям для проверки подстроки
                pure_pattern = pattern.strip('%')
                
                if pattern.startswith('%') and pattern.endswith('%'):
                    return pure_pattern in string
                elif pattern.startswith('%'):
                    return string.endswith(pure_pattern)
                elif pattern.endswith('%'):
                    return string.startswith(pure_pattern)
                else:
                    return string == pure_pattern

            dbapi_connection.create_function("like", 2, sqlite_like)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
