from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput
from app.db.schema.steps import (
    StepsSyncPayload, StepsSyncResult, StepsRangeOut, StepsDayOut,
)
from app.db.models.steps import StepsDaily

stepsRouter = APIRouter()


@stepsRouter.post("/sync", response_model=StepsSyncResult)
def sync_steps(
    payload: StepsSyncPayload,
    user: UserOutput = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Called by the mobile companion app after it reads step data from
    Health Connect / HealthKit. Upserts one row per (user, date) — safe to
    call repeatedly, e.g. every time the app is opened or brought to the
    foreground, so recent days get overwritten with the latest count."""
    synced = 0
    for day in payload.days:
        existing = (
            db.query(StepsDaily)
            .filter(StepsDaily.user_id == user.id, StepsDaily.date == day.date)
            .first()
        )
        if existing:
            existing.step_count = day.step_count
            existing.source = day.source
        else:
            db.add(StepsDaily(
                user_id=user.id,
                date=day.date,
                step_count=day.step_count,
                source=day.source,
            ))
        synced += 1
    db.commit()
    return StepsSyncResult(synced=synced)


@stepsRouter.get("", response_model=StepsRangeOut)
def get_steps(
    days: int = 7,
    user: UserOutput = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Used by the web page to display recent steps. `days` = how many
    calendar days back to include (default: last 7, including today)."""
    start = date.today() - timedelta(days=days - 1)
    rows = (
        db.query(StepsDaily)
        .filter(StepsDaily.user_id == user.id, StepsDaily.date >= start)
        .order_by(StepsDaily.date.asc())
        .all()
    )
    any_row_ever = (
        db.query(StepsDaily.id).filter(StepsDaily.user_id == user.id).first() is not None
    )
    last_synced = max((r.synced_at for r in rows if r.synced_at), default=None)
    return StepsRangeOut(
        days=[StepsDayOut(date=r.date, step_count=r.step_count, source=r.source) for r in rows],
        total_steps=sum(r.step_count for r in rows),
        connected=any_row_ever,
        last_synced_at=last_synced.isoformat() if last_synced else None,
    )
