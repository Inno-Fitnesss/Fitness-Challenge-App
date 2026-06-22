import secrets
import string
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.scheduling import local_today, is_scheduled
from app.db.models.user import User
from app.db.models.challenge import (
    Exercise, Challenge, ChallengeExercise, Participation,
    ChallengeExerciseProgress, UserExerciseStats,
)
from app.db.schema.challenge import ChallengeCreate, ChallengeEdit


class ChallengeService:
    def __init__(self, session: Session):
        self.s = session

    # --- helpers ---
    def _unique_code(self) -> str:
        for _ in range(10):
            code = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            if not self.s.query(Challenge.id).filter_by(join_code=code).first():
                return code
        raise HTTPException(status_code=500, detail="Could not generate join code")

    def _get_challenge(self, challenge_id: int) -> Challenge:
        challenge = self.s.get(Challenge, challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        return challenge

    def _exercises_of(self, challenge_id: int):
        rows = (
            self.s.query(ChallengeExercise, Exercise)
            .join(Exercise, ChallengeExercise.exercise_id == Exercise.id)
            .filter(ChallengeExercise.challenge_id == challenge_id)
            .all()
        )
        return [
            {"challenge_exercise_id": ce.id, "exercise_id": ex.id,
             "name": ex.name, "metric": ex.metric, "goal": ce.goal}
            for ce, ex in rows
        ]

    # --- reads ---
    def list_exercises(self):
        return [{"id": e.id, "name": e.name, "metric": e.metric}
                for e in self.s.query(Exercise).order_by(Exercise.id).all()]

    def presets(self):
        rows = self.s.query(Challenge).filter_by(is_preset=True, status="active").all()
        return [{"id": c.id, "name": c.name, "description": c.description,
                 "schedule_type": c.schedule_type} for c in rows]

    def detail(self, user_id: int, challenge_id: int):
        c = self._get_challenge(challenge_id)
        part = self.s.query(Participation).filter_by(user_id=user_id, challenge_id=challenge_id).first()
        participants = self.s.query(Participation).filter_by(challenge_id=challenge_id).count()
        return {
            "id": c.id, "name": c.name, "description": c.description,
            "schedule_type": c.schedule_type, "schedule_days": c.schedule_days,
            "start_date": c.start_date, "end_date": c.end_date,
            "is_private": c.is_private, "is_preset": c.is_preset, "status": c.status,
            "join_code": c.join_code if c.created_by == user_id else None,
            "exercises": self._exercises_of(challenge_id),
            "participants": participants,
            "joined": part is not None,
        }

    def leaderboard(self, challenge_id: int):
        self._get_challenge(challenge_id)
        rows = (
            self.s.query(Participation, User.username)
            .join(User, Participation.user_id == User.id)
            .filter(Participation.challenge_id == challenge_id)
            .order_by(
                Participation.days_completed.desc(),
                Participation.challenge_streak.desc(),
                Participation.total_clean_reps.desc(),
                Participation.joined_at.asc(),
            ).all()
        )
        return [
            {"place": i + 1, "username": username,
             "days_completed": p.days_completed, "challenge_streak": p.challenge_streak,
             "total_clean_reps": p.total_clean_reps}
            for i, (p, username) in enumerate(rows)
        ]

    def my_challenges(self, user_id: int, status: str = "active"):
        rows = (
            self.s.query(Challenge, Participation)
            .join(Participation, Participation.challenge_id == Challenge.id)
            .filter(Participation.user_id == user_id, Challenge.status == status)
            .all()
        )
        return [
            {"id": c.id, "name": c.name, "status": c.status,
             "days_completed": p.days_completed, "challenge_streak": p.challenge_streak}
            for c, p in rows
        ]

    def today(self, user_id: int):
        user = self.s.get(User, user_id)
        day = local_today(user.timezone)
        rows = (
            self.s.query(Challenge, Participation)
            .join(Participation, Participation.challenge_id == Challenge.id)
            .filter(Participation.user_id == user_id, Challenge.status == "active")
            .all()
        )
        out = []
        for c, p in rows:
            if c.start_date and day < c.start_date:
                continue
            if not is_scheduled(c, day):
                continue
            exercises = []
            for ex in self._exercises_of(c.id):
                ep = self.s.query(ChallengeExerciseProgress).filter_by(
                    participation_id=p.id, challenge_exercise_id=ex["challenge_exercise_id"], date=day
                ).first()
                exercises.append({**ex,
                                  "clean_today": ep.clean_reps if ep else 0,
                                  "closed": bool(ep and ep.is_closed)})
            out.append({"id": c.id, "name": c.name, "exercises": exercises})
        return out

    # --- writes ---
    def create(self, user_id: int, data: ChallengeCreate):
        user = self.s.get(User, user_id)
        challenge = Challenge(
            name=data.name, description=data.description, created_by=user_id,
            schedule_type=data.schedule_type, schedule_days=data.schedule_days,
            start_date=data.start_date or local_today(user.timezone),
            end_date=data.end_date, is_private=data.is_private,
            join_code=self._unique_code(),
        )
        self.s.add(challenge)
        self.s.flush()
        for ex in data.exercises:
            if not self.s.get(Exercise, ex.exercise_id):
                raise HTTPException(status_code=400, detail=f"Exercise {ex.exercise_id} not found")
            self.s.add(ChallengeExercise(challenge_id=challenge.id, exercise_id=ex.exercise_id, goal=ex.goal))
        self.s.add(Participation(user_id=user_id, challenge_id=challenge.id))  # creator auto-joins
        self.s.commit()
        return self.detail(user_id, challenge.id)

    def edit(self, user_id: int, challenge_id: int, data: ChallengeEdit):
        c = self._get_challenge(challenge_id)
        if c.created_by != user_id:
            raise HTTPException(status_code=403, detail="Only the creator can edit")
        if data.name is not None:
            c.name = data.name
        if data.description is not None:
            c.description = data.description
        self.s.commit()
        return self.detail(user_id, challenge_id)

    def archive(self, user_id: int, challenge_id: int):
        c = self._get_challenge(challenge_id)
        if c.created_by != user_id:
            raise HTTPException(status_code=403, detail="Only the creator can archive")
        c.status = "archived"
        c.archived_at = datetime.now(timezone.utc)
        self.s.commit()
        return {"id": c.id, "status": c.status}

    def join_by_code(self, user_id: int, code: str):
        c = self.s.query(Challenge).filter_by(join_code=code).first()
        if not c:
            raise HTTPException(status_code=404, detail="Invalid code")
        return self._join(user_id, c)

    def join_by_id(self, user_id: int, challenge_id: int):
        c = self._get_challenge(challenge_id)
        if c.is_private and not c.is_preset:
            raise HTTPException(status_code=403, detail="Private challenge, join by code")
        return self._join(user_id, c)

    def _join(self, user_id: int, c: Challenge):
        if c.status != "active":
            raise HTTPException(status_code=409, detail="Challenge is not active")
        if self.s.query(Participation).filter_by(user_id=user_id, challenge_id=c.id).first():
            raise HTTPException(status_code=409, detail="Already joined")
        part = Participation(user_id=user_id, challenge_id=c.id)
        self.s.add(part)
        self.s.commit()
        return {"participation_id": part.id, "challenge_id": c.id}

    def leave(self, user_id: int, challenge_id: int):
        part = self.s.query(Participation).filter_by(user_id=user_id, challenge_id=challenge_id).first()
        if not part:
            raise HTTPException(status_code=404, detail="Not a participant")
        self.s.delete(part)
        self.s.commit()
        return {"left": True}
