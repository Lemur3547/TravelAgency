import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _validate_legal_entity_inn(value: str) -> str:
    if len(value) != 10 or not value.isascii() or not value.isdigit():
        raise ValueError("ИНН юридического лица должен состоять из 10 цифр")

    weights = (2, 4, 10, 3, 5, 9, 4, 6, 8)
    checksum = sum(int(digit) * weight for digit, weight in zip(value[:9], weights))
    if checksum % 11 % 10 != int(value[9]):
        raise ValueError("Указан некорректный ИНН")

    return value


def _normalize_russian_phone(value: object) -> object:
    if not isinstance(value, str) or not re.fullmatch(r"\+?[\d\s()-]+", value):
        raise ValueError("Введите корректный номер телефона")
    if "+" in value and not value.lstrip().startswith("+"):
        raise ValueError("Введите корректный номер телефона")

    digits = re.sub(r"\D", "", value)
    if value.lstrip().startswith("+") and not digits.startswith("7"):
        raise ValueError("Для международного формата используйте код +7")
    if len(digits) == 10:
        national_number = digits
    elif len(digits) == 11 and digits[0] in {"7", "8"}:
        national_number = digits[1:]
    else:
        raise ValueError("Номер должен содержать код страны и 10 цифр")

    if national_number[0] not in "3456789":
        raise ValueError("Введите корректный номер телефона")

    return f"+7{national_number}"


def _validate_name(value: Optional[str], alphabet: str) -> Optional[str]:
    if value is None:
        return None
    if alphabet == "russian":
        pattern = r"^[А-Яа-яЁё]+(?:[- ][А-Яа-яЁё]+)*$"
    else:
        pattern = r"^[A-Za-z]+(?:[- ][A-Za-z]+)*$"
    if not re.fullmatch(pattern, value):
        language = "русские" if alphabet == "russian" else "латинские"
        raise ValueError(f"Используйте только {language} буквы")
    return value


def _normalize_passport_number(value: object, expected_length: int) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str) or not re.fullmatch(r"[0-9 ]+", value):
        raise ValueError("Номер паспорта должен состоять из цифр")
    series_length = 4 if expected_length == 10 else 2
    formatted_pattern = rf"[0-9]{{{series_length}}} [0-9]{{{expected_length - series_length}}}"
    if " " in value and not re.fullmatch(formatted_pattern, value):
        raise ValueError("Номер паспорта указан в неверном формате")
    digits = value.replace(" ", "")
    if len(digits) != expected_length:
        raise ValueError(f"Номер паспорта должен содержать {expected_length} цифр")
    return digits


class ClientBase(BaseModel):
    last_name: str = Field(..., min_length=1, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=50)
    father_name: Optional[str] = Field(None, max_length=50)
    passport_number: Optional[str] = Field(None, max_length=11)
    birth_date: Optional[date] = None
    foreign_passport_number: Optional[str] = Field(None, max_length=10)
    latin_first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    latin_last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    foreign_passport_expire_date: Optional[date] = None
    phone: str = Field(..., min_length=1, max_length=15)
    email: EmailStr = Field(..., max_length=255)

    @field_validator("last_name", "first_name")
    @classmethod
    def validate_russian_name(cls, value: str) -> str:
        return _validate_name(value, "russian") or value

    @field_validator("father_name")
    @classmethod
    def validate_russian_father_name(cls, value: Optional[str]) -> Optional[str]:
        return _validate_name(value, "russian")

    @field_validator("latin_first_name", "latin_last_name")
    @classmethod
    def validate_latin_name(cls, value: Optional[str]) -> Optional[str]:
        return _validate_name(value, "latin")

    @field_validator("passport_number", mode="before")
    @classmethod
    def normalize_passport_number(cls, value: object) -> Optional[str]:
        return _normalize_passport_number(value, 10)

    @field_validator("foreign_passport_number", mode="before")
    @classmethod
    def normalize_foreign_passport_number(cls, value: object) -> Optional[str]:
        return _normalize_passport_number(value, 9)

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: object) -> object:
        return _normalize_russian_phone(value)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    father_name: Optional[str] = Field(None, max_length=50)
    passport_number: Optional[str] = Field(None, max_length=11)
    birth_date: Optional[date] = None
    foreign_passport_number: Optional[str] = Field(None, max_length=10)
    latin_first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    latin_last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    foreign_passport_expire_date: Optional[date] = None
    phone: Optional[str] = Field(None, min_length=1, max_length=15)
    email: Optional[EmailStr] = Field(None, max_length=255)

    @field_validator("last_name", "first_name")
    @classmethod
    def validate_russian_name(cls, value: Optional[str]) -> Optional[str]:
        return _validate_name(value, "russian")

    @field_validator("father_name")
    @classmethod
    def validate_russian_father_name(cls, value: Optional[str]) -> Optional[str]:
        return _validate_name(value, "russian")

    @field_validator("latin_first_name", "latin_last_name")
    @classmethod
    def validate_latin_name(cls, value: Optional[str]) -> Optional[str]:
        return _validate_name(value, "latin")

    @field_validator("passport_number", mode="before")
    @classmethod
    def normalize_passport_number(cls, value: object) -> Optional[str]:
        return _normalize_passport_number(value, 10)

    @field_validator("foreign_passport_number", mode="before")
    @classmethod
    def normalize_foreign_passport_number(cls, value: object) -> Optional[str]:
        return _normalize_passport_number(value, 9)

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: object) -> object:
        if value is None:
            return None
        return _normalize_russian_phone(value)


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_name: str
    first_name: str
    father_name: Optional[str]
    passport_number: Optional[str]
    birth_date: Optional[date]
    foreign_passport_number: Optional[str]
    latin_first_name: Optional[str]
    latin_last_name: Optional[str]
    foreign_passport_expire_date: Optional[date]
    phone: str
    email: EmailStr
    created_at: datetime
    updated_at: datetime


class ClientPageResponse(BaseModel):
    items: list[ClientResponse]
    total: int


class TourOperatorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    legal_name: str = Field(..., min_length=1, max_length=255)
    inn: str = Field(..., min_length=1, max_length=10)
    address: str = Field(..., min_length=1, max_length=255)
    phone: str = Field(..., min_length=12, max_length=12, pattern=r"^\+7[3-9]\d{9}$")
    email: EmailStr = Field(..., max_length=255)
    website: str = Field(..., min_length=1, max_length=255)
    is_active: bool = True

    @field_validator("inn")
    @classmethod
    def validate_inn(cls, value: str) -> str:
        return _validate_legal_entity_inn(value)

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: object) -> object:
        return _normalize_russian_phone(value)


class TourOperatorCreate(TourOperatorBase):
    pass


class TourOperatorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    legal_name: Optional[str] = Field(None, min_length=1, max_length=255)
    inn: Optional[str] = Field(None, min_length=1, max_length=10)
    address: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(
        None,
        min_length=12,
        max_length=12,
        pattern=r"^\+7[3-9]\d{9}$",
    )
    email: Optional[EmailStr] = Field(None, max_length=255)
    website: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None

    @field_validator("inn")
    @classmethod
    def validate_inn(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_legal_entity_inn(value)

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: object) -> object:
        if value is None:
            return None
        return _normalize_russian_phone(value)


class TourOperatorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    legal_name: str
    inn: str
    address: str
    phone: str
    email: EmailStr
    website: str
    is_active: bool
    created_at: datetime


class DestinationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    country: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=100)
    country_slug: str = Field(..., min_length=1, max_length=100)
    city_slug: str = Field(..., min_length=1, max_length=100)


class DestinationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    country: str
    city: str
    country_slug: str
    city_slug: str


class CountryResponse(BaseModel):
    country: str
    country_slug: str


class CityResponse(BaseModel):
    city: str
    city_slug: str
