from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ClientBase(BaseModel):
    last_name: str = Field(..., min_length=1, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=50)
    father_name: Optional[str] = Field(None, max_length=50)
    passport_number: str = Field(..., min_length=1, max_length=10)
    birth_date: date
    foreign_passport_number: str = Field(..., min_length=1, max_length=9)
    latin_first_name: str = Field(..., min_length=1, max_length=50)
    latin_last_name: str = Field(..., min_length=1, max_length=50)
    foreign_passport_expire_date: date
    phone: str = Field(..., min_length=1, max_length=15)
    email: EmailStr = Field(..., max_length=255)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    father_name: Optional[str] = Field(None, max_length=50)
    passport_number: Optional[str] = Field(None, min_length=1, max_length=10)
    birth_date: Optional[date] = None
    foreign_passport_number: Optional[str] = Field(None, min_length=1, max_length=9)
    latin_first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    latin_last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    foreign_passport_expire_date: Optional[date] = None
    phone: Optional[str] = Field(None, min_length=1, max_length=15)
    email: Optional[EmailStr] = Field(None, max_length=255)


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_name: str
    first_name: str
    father_name: Optional[str]
    passport_number: str
    birth_date: date
    foreign_passport_number: str
    latin_first_name: str
    latin_last_name: str
    foreign_passport_expire_date: date
    phone: str
    email: EmailStr
    created_at: datetime
    updated_at: datetime


class ClientPageResponse(BaseModel):
    items: list[ClientResponse]
    total: int