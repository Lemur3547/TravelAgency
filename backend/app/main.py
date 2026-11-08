from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import Base, engine
from .routers.clients import router as clients_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="TravelAgency API", version="0.1.0", lifespan=lifespan)

origins = [
    "http://localhost:5173",  # Адрес вашего React-приложения на Vite
    "http://127.0.0.1:5173",  # Альтернативный локальный адрес
    "https://humble-space-broccoli-9769vpppq7r929pg-5173.app.github.dev"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # Разрешить запросы с этих адресов
    allow_credentials=True,           # Разрешить отправку cookies и заголовков авторизации
    allow_methods=["*"],              # Разрешить все HTTP-методы (GET, POST, PUT, DELETE и др.)
    allow_headers=["*"],              # Разрешить любые заголовки
)

app.include_router(clients_router)


@app.get("/")
async def root():
    return {"message": "Hello, FastAPI!"}


@app.get("/health")
async def health_check():
    return {"status": "super gut!"}