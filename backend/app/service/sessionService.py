from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.core.scheduling import local_today, is_scheduled, previous_scheduled_day
from app.db.models.user import User
from app.db.models.challenge import (
    Challenge, ChallengeExercise, Participation, Session,
    ChallengeExerciseProgress, ChallengeDayProgress, UserExerciseStats,
)
from app.db.schema.challenge import SessionIn


class SessionService:
    def __init__(self, session: DBSession):
        self.s = session

    def submit(self, user_id: int, challenge_id: int, data: SessionIn):
        user = self.s.get(User, user_id)
        challenge = self.s.get(Challenge, challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        part = self.s.query(Participation).filter_by(user_id=user_id, challenge_id=challenge_id).first()
        if not part:
            raise HTTPException(status_code=403, detail="Join the challenge first")
        if challenge.status != "active":
            raise HTTPException(status_code=409, detail="Challenge is not active")
        ce = self.s.query(ChallengeExercise).filter_by(
            id=data.challenge_exercise_id, challenge_id=challenge_id).first()
        if not ce:
            raise HTTPException(status_code=404, detail="Exercise is not part of this challenge")

        day = local_today(user.timezone)
        if not is_scheduled(challenge, day):
            raise HTTPException(status_code=409, detail="Challenge is not scheduled for today")

        clean = data.clean_reps

        # raw log (append-only)
        self.s.add(Session(
            participation_id=part.id, challenge_exercise_id=ce.id, end_time=func.now(),
            total_reps=data.total_reps, clean_reps=clean, duration_seconds=data.duration_seconds,
        ))

        # volume counters grow on every session, regardless of closing
        part.total_clean_reps = (part.total_clean_reps or 0) + clean
        stat = self.s.query(UserExerciseStats).filter_by(user_id=user_id, exercise_id=ce.exercise_id).first()
        if not stat:
            stat = UserExerciseStats(user_id=user_id, exercise_id=ce.exercise_id, total_clean_reps=0)
            self.s.add(stat)
        stat.total_clean_reps = (stat.total_clean_reps or 0) + clean

        # per-exercise progress for today
        ep = self.s.query(ChallengeExerciseProgress).filter_by(
            participation_id=part.id, challenge_exercise_id=ce.id, date=day).first()
        if not ep:
            ep = ChallengeExerciseProgress(
                participation_id=part.id, challenge_exercise_id=ce.id, date=day,
                clean_reps=0, is_closed=False)
            self.s.add(ep)
        was_closed = ep.is_closed
        ep.clean_reps += clean
        ep.is_closed = ep.clean_reps >= ce.goal
        self.s.flush()

        day_closed = False
        # only act on the transition not-closed -> closed for this exercise
        if ep.is_closed and not was_closed and self._all_exercises_closed(challenge_id, part.id, day):
            day_closed = self._close_day(challenge, part, user, day)

        self.s.commit()
        return {
            "exercise": {"clean": ep.clean_reps, "goal": ce.goal, "closed": ep.is_closed},
            "day_closed": day_closed,
            "challenge_streak": part.challenge_streak,
            "user_streak": user.streak_current,
            "place": self._place(challenge_id, part.id),
        }

    def _all_exercises_closed(self, challenge_id: int, part_id: int, day) -> bool:
        total = self.s.query(ChallengeExercise).filter_by(challenge_id=challenge_id).count()
        closed = (
            self.s.query(ChallengeExerciseProgress)
            .join(ChallengeExercise, ChallengeExerciseProgress.challenge_exercise_id == ChallengeExercise.id)
            .filter(ChallengeExercise.challenge_id == challenge_id,
                    ChallengeExerciseProgress.participation_id == part_id,
                    ChallengeExerciseProgress.date == day,
                    ChallengeExerciseProgress.is_closed.is_(True))
            .count()
        )
        return total > 0 and closed >= total

    def _close_day(self, challenge, part, user, day) -> bool:
        dp = self.s.query(ChallengeDayProgress).filter_by(participation_id=part.id, date=day).first()
        if not dp:
            dp = ChallengeDayProgress(participation_id=part.id, date=day)
            self.s.add(dp)
        if dp.is_closed:  # idempotent: a day counts only once
            return False
        dp.is_closed = True
        dp.closed_at = func.now()
        part.days_completed = (part.days_completed or 0) + 1
        prev = previous_scheduled_day(challenge, day)
        part.challenge_streak = (part.challenge_streak + 1) if (prev and part.last_closed_date == prev) else 1
        part.last_closed_date = day
        self._bump_user_streak(user, day)
        return True

    def _bump_user_streak(self, user, day):
        # one increment per calendar day across all challenges
        if user.last_activity_date == day:
            return
        if user.last_activity_date == day - timedelta(days=1):
            user.streak_current = (user.streak_current or 0) + 1
        else:
            user.streak_current = 1
        user.last_activity_date = day
        user.streak_longest = max(user.streak_longest or 0, user.streak_current)

    def _place(self, challenge_id: int, part_id: int):
        rows = (
            self.s.query(Participation.id)
            .filter_by(challenge_id=challenge_id)
            .order_by(
                Participation.days_completed.desc(),
                Participation.challenge_streak.desc(),
                Participation.total_clean_reps.desc(),
                Participation.joined_at.asc(),
            ).all()
        )
        for i, (pid,) in enumerate(rows):
            if pid == part_id:
                return i + 1
        return None
