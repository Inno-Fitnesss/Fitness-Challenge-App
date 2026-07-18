from datetime import date

from sqlalchemy.orm import Session as DBSession

from app.core.scheduling import is_scheduled
from app.db.models.user import User
from app.db.models.challenge import (
    Exercise, Challenge, ChallengeExercise, Participation, ChallengeExerciseProgress,
)
from app.service.sessionService import SessionService


class StepsChallengeService(SessionService):
    """Bridges Withings/companion step data (steps_daily) into the challenge
    progress engine.

    Steps are unlike camera exercises: instead of a session *adding* clean reps,
    the day's absolute step total from `steps_daily` *is* the progress. So this
    feeds `ChallengeExerciseProgress` with SET semantics (clean_reps = today's
    steps), not the additive semantics of `SessionService.submit`. That keeps it
    idempotent — re-running a sync for the same day just rewrites the same
    number, it never stacks.

    Day-closing, streaks and leaderboard are reused verbatim from the base
    SessionService, so a step goal met closes the day exactly like reps do.
    Volume counters (total_clean_reps / UserExerciseStats) are deliberately NOT
    touched: steps aren't reps, their all-time volume already lives in
    steps_daily, and mixing thousands of steps into the reps tiebreaker (or
    double-counting the same day across two step challenges) would be wrong.
    """

    def apply_daily_steps(self, user_id: int, steps_by_day: dict[date, int]) -> None:
        if not steps_by_day:
            return
        user = self.s.get(User, user_id)
        if not user:
            return

        step_exercise_ids = {
            row[0]
            for row in self.s.query(Exercise.id).filter(Exercise.metric == "steps").all()
        }
        if not step_exercise_ids:
            return

        # Active participations in active challenges. Lock the participation rows
        # for the rest of the transaction (no-op on SQLite, real lock on Postgres)
        # so a concurrent sync from another tab/device can't race the same rows —
        # same guard SessionService.submit relies on.
        participations = (
            self.s.query(Participation, Challenge)
            .join(Challenge, Participation.challenge_id == Challenge.id)
            .filter(
                Participation.user_id == user_id,
                Participation.status == "active",
                Challenge.status == "active",
            )
            .with_for_update(of=Participation)
            .all()
        )

        # Process days in ascending order so streaks (which look back to the
        # previous scheduled day) build up correctly when a sync backfills
        # several days at once.
        ordered_days = sorted(steps_by_day)

        for part, challenge in participations:
            ce = (
                self.s.query(ChallengeExercise)
                .filter(
                    ChallengeExercise.challenge_id == challenge.id,
                    ChallengeExercise.exercise_id.in_(step_exercise_ids),
                )
                .first()
            )
            if not ce:
                continue

            for day in ordered_days:
                if challenge.start_date and day < challenge.start_date:
                    continue
                if challenge.end_date and day > challenge.end_date:
                    continue
                if not is_scheduled(challenge, day):
                    continue

                step_count = steps_by_day[day]
                ep = (
                    self.s.query(ChallengeExerciseProgress)
                    .filter_by(participation_id=part.id, challenge_exercise_id=ce.id, date=day)
                    .first()
                )
                if not ep:
                    ep = ChallengeExerciseProgress(
                        participation_id=part.id, challenge_exercise_id=ce.id, date=day,
                        clean_reps=0, is_closed=False,
                    )
                    self.s.add(ep)

                was_closed = ep.is_closed
                ep.clean_reps = step_count  # SET, not +=
                # Monotonic: once a goal-met day is closed it stays closed, even
                # if a later correction nudges the count below the goal.
                if step_count >= ce.goal:
                    ep.is_closed = True
                self.s.flush()

                if ep.is_closed and not was_closed and self._all_exercises_closed(
                    challenge.id, part.id, day
                ):
                    self._close_day(challenge, part, user, day)

        self.s.commit()
