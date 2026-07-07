from pydantic import EmailStr, BaseModel, Field, model_validator
from typing import Optional
from zoneinfo import ZoneInfo

class UserInCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserOutput(BaseModel):
    id: int
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserInLogin(BaseModel):
    email: EmailStr
    password: str

class UserWithToken(BaseModel):
    token: str
    refresh_token: Optional[str] = None

class MeUpdate(BaseModel):
    """Partial profile update (PATCH /me). All fields optional."""
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(default=None, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=100)
    height_cm: Optional[int] = Field(default=None, ge=0, le=300)
    weight_kg: Optional[int] = Field(default=None, ge=0, le=500)
    fitness_level: Optional[str] = Field(default=None, max_length=20)
    new_password: Optional[str] = Field(default=None, min_length=8)
    confirm_password: Optional[str] = None
    timezone: Optional[str] = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def _passwords_match(self):
        if self.new_password and self.new_password != self.confirm_password:
            raise ValueError("passwords do not match")
        return self

    @model_validator(mode="after")
    def _valid_timezone(self):
        if self.timezone is not None:
            try:
                ZoneInfo(self.timezone)
            except Exception:
                raise ValueError(f"Unknown timezone: {self.timezone!r}")
        return self

class RefreshIn(BaseModel):
    refresh_token: str

class GoogleLoginIn(BaseModel):
    """POST /auth/google — Google ID token issued to our client id."""
    id_token: str

class ForgotPasswordIn(BaseModel):
    """POST /auth/forgot-password — request a reset code by email."""
    email: EmailStr

class ResetPasswordIn(BaseModel):
    """POST /auth/reset-password — set a new password using the emailed code."""
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8)
    confirm_password: str

    @model_validator(mode="after")
    def _passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("passwords do not match")
        return self