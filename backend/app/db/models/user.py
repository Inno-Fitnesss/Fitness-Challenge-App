from app.core.database import Base
from sqlalchemy import Column, Integer, String, Date, DateTime, func

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(70), unique=True, nullable=False)
    password_hash = Column(String(250), nullable=False)
    first_name = Column(String(50))
    last_name = Column(String(100))
    streak_current = Column(Integer, default=0)
    streak_longest = Column(Integer, default=0)
    last_activity_date = Column(Date)
    timezone = Column(String(50), default="UTC")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
