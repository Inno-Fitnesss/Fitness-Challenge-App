from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput
from app.service.challengeService import ChallengeService

publicRouter = APIRouter()


@publicRouter.get("/challenge/{join_code}")
def public_challenge(join_code: str, db: Session = Depends(get_db)):
    """Unauthenticated preview of a challenge by its invite code."""
    return ChallengeService(db).public_view(join_code)


@publicRouter.post("/challenge/{join_code}/join", status_code=201)
def public_join(join_code: str, user: UserOutput = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """Join a challenge via its invite code (authentication required)."""
    return ChallengeService(db).join_by_code(user.id, join_code)
