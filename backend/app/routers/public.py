from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput
from app.service.challengeService import ChallengeService

publicRouter = APIRouter()

@publicRouter.get("/challenge/{join_code}")
def get_public_challenge(
    join_code: str,
    db: Session = Depends(get_db)
):
    return ChallengeService(db).get_public_challenge(join_code)

@publicRouter.post("/challenge/{join_code}/join")
def join_public_challenge(
    join_code: str,
    user: UserOutput = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return ChallengeService(db).join_by_code(user.id, join_code)
