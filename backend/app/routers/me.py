from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput
from app.db.models.user import User
from app.db.models.challenge import UserExerciseStats, Exercise
from app.service.challengeService import ChallengeService

meRouter = APIRouter()


@meRouter.get("")
def me(user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    u = db.get(User, user.id)
    stats = (
        db.query(UserExerciseStats, Exercise)
        .join(Exercise, UserExerciseStats.exercise_id == Exercise.id)
        .filter(UserExerciseStats.user_id == user.id).all()
    )
    return {
        "id": u.id, "username": u.username, "email": u.email,
        "streak_current": u.streak_current, "streak_longest": u.streak_longest,
        "volume": [{"exercise": ex.name, "metric": ex.metric, "total": s.total_clean_reps}
                   for s, ex in stats],
    }


@meRouter.get("/today")
def today(user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    return ChallengeService(db).today(user.id)


@meRouter.get("/challenges")
def my_challenges(status: str = "active", user: UserOutput = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    return ChallengeService(db).my_challenges(user.id, status)
