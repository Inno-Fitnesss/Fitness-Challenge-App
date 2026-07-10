from app.core.database import Base
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, func


class WithingsConnection(Base):
    """One row per user who has linked their Withings account. Tokens are
    refreshed in place (access_token has a short lifetime — a few hours —
    refresh_token is long-lived and used to silently renew it)."""
    __tablename__ = "withings_connections"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    withings_user_id = Column(String(50), nullable=False)
    access_token = Column(String(500), nullable=False)
    refresh_token = Column(String(500), nullable=False)
    token_expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
