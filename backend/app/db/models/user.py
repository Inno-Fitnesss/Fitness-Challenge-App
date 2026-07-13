from app.core.database import Base
from sqlalchemy import Column, Integer, String, Date, DateTime, JSON, func

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(70), unique=True, nullable=False)
    password_hash = Column(String(250), nullable=False)
    # Google OAuth subject (stable Google user id). Set once the account is
    # created via / linked to "Sign in with Google"; NULL for password-only accounts.
    google_sub = Column(String(64), unique=True)
    # "Forgot password" one-time code: bcrypt hash of the 6-digit code, its
    # expiry, and how many wrong guesses were made (anti-bruteforce).
    reset_code_hash = Column(String(250))
    reset_code_expires_at = Column(DateTime)
    reset_code_attempts = Column(Integer, default=0)
    first_name = Column(String(50))
    last_name = Column(String(100))
    height_cm = Column(Integer)
    weight_kg = Column(Integer)
    fitness_level = Column(String(20))  # beginner | intermediate | advanced (free-form)
    streak_current = Column(Integer, default=0)
    streak_longest = Column(Integer, default=0)
    last_activity_date = Column(Date)
    timezone = Column(String(50), default="UTC")
    # Account-level UI flags (onboarding completed, "don't show again" dismissals).
    # Flat {key: bool} map merged by PATCH /me so the flags follow the account
    # across devices instead of living in localStorage.
    ui_flags = Column(JSON, default=dict)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
