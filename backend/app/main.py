from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.clients import router as clients_router
from .routers.destinations import router as destinations_router
from .routers.departures import router as departures_router
from .routers.tour_operators import router as tour_operators_router
from .routers.tours import router as tours_router


app = FastAPI(title="TravelAgency API", version="0.1.0")

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
app.include_router(destinations_router)
app.include_router(departures_router)
app.include_router(tour_operators_router)
app.include_router(tours_router)


@app.get("/")
async def root():
    return {"message": "Hello, FastAPI!"}


@app.get("/health")
async def health_check():
    return {"status": "super gut!"}