from app.core.database import Base
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, UniqueConstraint, func


class StepsDaily(Base):
    """One row per user per local calendar day.

    Populated by the mobile companion app, which reads step data from
    Health Connect (Android) or HealthKit (iOS) and pushes it here.
    `source` records where the number came from, in case we ever need to
    debug a discrepancy or support multiple companion platforms.
    """
    __tablename__ = "steps_daily"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    step_count = Column(Integer, nullable=False, default=0)
    source = Column(String(30), nullable=False, default="unknown")  # 'health_connect' | 'healthkit'
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_steps_daily_user_date"),)
