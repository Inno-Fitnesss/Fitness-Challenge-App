from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput
from app.db.schema.challenge import ChallengeCreate, ChallengeEdit, JoinIn, SessionIn
from app.service.challengeService import ChallengeService
from app.service.sessionService import SessionService

challengeRouter = APIRouter()


@challengeRouter.get("/presets")
def presets(user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    return ChallengeService(db).presets()


@challengeRouter.post("", status_code=201)
def create_challenge(data: ChallengeCreate, user: UserOutput = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    return ChallengeService(db).create(user.id, data)


@challengeRouter.post("/join", status_code=201)
def join_by_code(data: JoinIn, user: UserOutput = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    return ChallengeService(db).join_by_code(user.id, data.join_code)


@challengeRouter.get("/{challenge_id}")
def challenge_detail(challenge_id: int, user: UserOutput = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    return ChallengeService(db).detail(user.id, challenge_id)


@challengeRouter.patch("/{challenge_id}")
def edit_challenge(challenge_id: int, data: ChallengeEdit,
                   user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    return ChallengeService(db).edit(user.id, challenge_id, data)


@challengeRouter.post("/{challenge_id}/archive")
def archive_challenge(challenge_id: int, user: UserOutput = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    return ChallengeService(db).archive(user.id, challenge_id)


@challengeRouter.post("/{challenge_id}/join", status_code=201)
def join_by_id(challenge_id: int, user: UserOutput = Depends(get_current_user),
               db: Session = Depends(get_db)):
    return ChallengeService(db).join_by_id(user.id, challenge_id)


@challengeRouter.post("/{challenge_id}/leave")
def leave_challenge(challenge_id: int, user: UserOutput = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return ChallengeService(db).leave(user.id, challenge_id)


@challengeRouter.get("/{challenge_id}/leaderboard")
def leaderboard(challenge_id: int, user: UserOutput = Depends(get_current_user),
                db: Session = Depends(get_db)):
    return ChallengeService(db).leaderboard(challenge_id)


@challengeRouter.post("/{challenge_id}/sessions")
def submit_session(challenge_id: int, data: SessionIn,
                   user: UserOutput = Depends(get_current_user), db: Session = Depends(get_db)):
    return SessionService(db).submit(user.id, challenge_id, data)

@challengeRouter.delete("/{challenge_id}", status_code=204)
def delete_challenge(
    challenge_id: int,
    user: UserOutput = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить челлендж. Только создатель."""
    ChallengeService(db).delete(user.id, challenge_id)
    return None