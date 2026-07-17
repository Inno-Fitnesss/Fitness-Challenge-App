from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.scheduling import local_today, effective_user_streak
from app.core.security.hashHelper import HashHelper
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput, MeUpdate
from app.db.models.user import User
from app.db.models.challenge import (
    UserExerciseStats, Exercise, Participation, ChallengeDayProgress,
)
from app.service.challengeService import ChallengeService

meRouter = APIRouter()


def _serialize_me(db: Session, user_id: int) -> dict:
    u = db.get(User, user_id)
    stats = (
        db.query(UserExerciseStats, Exercise)
        .join(Exercise, UserExerciseStats.exercise_id == Exercise.id)
        .filter(UserExerciseStats.user_id == user_id).all()
    )
    today = local_today(u.timezone)
    return {
        "id": u.id, "username": u.username, "email": u.email,
        "first_name": u.first_name, "last_name": u.last_name,
        "height_cm": u.height_cm, "weight_kg": u.weight_kg,
        "fitness_level": u.fitness_level, "timezone": u.timezone,
        "streak_current": effective_user_streak(u.last_activity_date, u.streak_current, today),
        "streak_longest": u.streak_longest,
        "ui_flags": u.ui_flags or {},
        "volume": [{"exercise": ex.name, "metric": ex.metric, "total": s.total_clean_reps}
                   for s, ex in stats],
    }


@meRouter.get("")
def me(user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    return _serialize_me(db, user.id)


@meRouter.patch("")
def update_me(data: MeUpdate, user: UserOutput = Depends(get_current_user),
              db: Session = Depends(get_db)):
    u = db.get(User, user.id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if data.username is not None and data.username != u.username:
        if db.query(User).filter(User.username == data.username, User.id != u.id).first():
            raise HTTPException(status_code=400, detail="Username already taken")
        u.username = data.username
    if data.email is not None and data.email.lower() != u.email:
        email = data.email.lower()
        if db.query(User).filter(User.email == email, User.id != u.id).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        u.email = email
    for field in ("first_name", "last_name", "height_cm", "weight_kg", "fitness_level", "timezone"):
        value = getattr(data, field)
        if value is not None:
            setattr(u, field, value)
    if data.new_password:
        u.password_hash = HashHelper.get_password_hash(plain_password=data.new_password)
    if data.ui_flags is not None:
        merged = dict(u.ui_flags or {})
        for key, value in data.ui_flags.items():
            if value:
                merged[key] = True
            else:
                merged.pop(key, None)
        if len(merged) > 200:
            raise HTTPException(status_code=400, detail="Too many ui_flags")
        u.ui_flags = merged  # reassign: plain JSON column doesn't track in-place mutation

    db.commit()
    return _serialize_me(db, user.id)


@meRouter.get("/today")
def today(user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    return ChallengeService(db).today(user.id)


@meRouter.get("/challenges")
def my_challenges(status: str = "active", user: UserOutput = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    return ChallengeService(db).my_challenges(user.id, status)


@meRouter.get("/week")
def week(week_start: Optional[date] = None, user: UserOutput = Depends(get_current_user),
         db: Session = Depends(get_db)):
    u = db.get(User, user.id)
    today_local = local_today(u.timezone)
    # Default to the Monday of the current local week.
    start = week_start or (today_local - timedelta(days=today_local.weekday()))
    end = start + timedelta(days=6)

    closed = (
        db.query(ChallengeDayProgress.date)
        .join(Participation, ChallengeDayProgress.participation_id == Participation.id)
        .filter(Participation.user_id == user.id,
                ChallengeDayProgress.is_closed.is_(True),
                ChallengeDayProgress.date >= start,
                ChallengeDayProgress.date <= end)
        .distinct().all()
    )
    completed = sorted({d for (d,) in closed})
    return {
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "completed_dates": [d.isoformat() for d in completed],
        "streak_current": effective_user_streak(u.last_activity_date, u.streak_current, today_local) or 0,
    }