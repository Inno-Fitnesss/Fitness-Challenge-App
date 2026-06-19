from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput
from app.service.challengeService import ChallengeService

exerciseRouter = APIRouter()


@exerciseRouter.get("")
def list_exercises(user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    return ChallengeService(db).list_exercises()
