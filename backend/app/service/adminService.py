from datetime import datetime, timedelta

from decouple import config
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security.authHandler import AuthHandler
from app.core.security.hashHelper import HashHelper
from app.db.models.user import User
from app.db.models.challenge import Challenge, ChallengeExercise, Exercise, UserExerciseStats
from app.db.schema.admin import (
    AdminStatsOut, ActivityStats, ChallengeBreakdown, PieSlice, TopStreakUser,
    ExerciseVolume, RegistrationPoint,
)

# Bcrypt hash of the shared admin password, set in .env — never store it in
# plain text. Generate one with:
#   python -c "from app.core.security.hashHelper import HashHelper; print(HashHelper.get_password_hash('your-password'))"
ADMIN_PASSWORD_HASH = config("ADMIN_PASSWORD_HASH", default=None)


class AdminService:
    @staticmethod
    def login(password: str) -> str:
        if not ADMIN_PASSWORD_HASH:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin login is not configured",
            )

        if not HashHelper.verify_password(
            plain_password=password, hashed_password=ADMIN_PASSWORD_HASH
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password",
            )

        return AuthHandler.sign_admin_token()

    @staticmethod
    def get_stats(db: Session) -> AdminStatsOut:
        return AdminStatsOut(
            total_users=AdminService._total_users(db),
            activity=AdminService._activity(db),
            challenges=AdminService._challenge_breakdown(db),
            top_streaks=AdminService._top_streaks(db),
            exercise_totals=AdminService._exercise_totals(db),
            registrations_daily=AdminService._registrations_daily(db),
        )

    # -- individual metrics ---------------------------------------------

    @staticmethod
    def _total_users(db: Session) -> int:
        return db.query(func.count(User.id)).scalar() or 0

    @staticmethod
    def _activity(db: Session) -> ActivityStats:
        now = datetime.utcnow()

        def active_since(cutoff: datetime) -> int:
            return db.query(func.count(User.id)) \
                .filter(User.last_seen_at >= cutoff).scalar() or 0

        new_today = db.query(func.count(User.id)) \
            .filter(func.date(User.created_at) == now.date()).scalar() or 0

        return ActivityStats(
            active_today=active_since(now - timedelta(days=1)),
            active_week=active_since(now - timedelta(days=7)),
            active_month=active_since(now - timedelta(days=30)),
            new_today=new_today,
        )

    @staticmethod
    def _challenge_breakdown(db: Session) -> ChallengeBreakdown:
        # NOTE: "archived" only exists at the Participation level (per-user),
        # not on Challenge itself — a challenge has no single archived flag.
        # So every count below is over ALL challenges ever created,
        # regardless of whether individual participants have archived them.
        total = db.query(func.count(Challenge.id)).scalar() or 0

        open_ended = db.query(func.count(Challenge.id)) \
            .filter(Challenge.end_date.is_(None)).scalar() or 0
        with_end_date = total - open_ended

        individual = db.query(func.count(Challenge.id)) \
            .filter(Challenge.is_public.is_(False)).scalar() or 0
        group = total - individual

        daily = db.query(func.count(Challenge.id)) \
            .filter(Challenge.schedule_type == "daily").scalar() or 0
        weekly = db.query(func.count(Challenge.id)) \
            .filter(Challenge.schedule_type == "weekly").scalar() or 0

        exercise_counts = db.query(
            ChallengeExercise.challenge_id,
            func.count(ChallengeExercise.id).label("cnt"),
        ).group_by(ChallengeExercise.challenge_id).subquery()

        single = db.query(func.count()).select_from(exercise_counts) \
            .filter(exercise_counts.c.cnt == 1).scalar() or 0
        multiple = db.query(func.count()).select_from(exercise_counts) \
            .filter(exercise_counts.c.cnt > 1).scalar() or 0

        return ChallengeBreakdown(
            total=total,
            by_duration=[
                PieSlice(label="Бессрочные", value=open_ended),
                PieSlice(label="С датой окончания", value=with_end_date),
            ],
            by_visibility=[
                PieSlice(label="Индивидуальные", value=individual),
                PieSlice(label="Групповые", value=group),
            ],
            by_schedule=[
                PieSlice(label="Ежедневные", value=daily),
                PieSlice(label="Еженедельные", value=weekly),
            ],
            by_exercise_count=[
                PieSlice(label="1 упражнение", value=single),
                PieSlice(label="Несколько упражнений", value=multiple),
            ],
        )

    @staticmethod
    def _top_streaks(db: Session, limit: int = 3) -> list[TopStreakUser]:
        rows = db.query(User.username, User.streak_longest) \
            .order_by(User.streak_longest.desc()) \
            .limit(limit).all()
        return [TopStreakUser(username=r.username, streak_longest=r.streak_longest or 0) for r in rows]

    @staticmethod
    def _exercise_totals(db: Session) -> list[ExerciseVolume]:
        rows = db.query(
            Exercise.name,
            Exercise.metric,
            func.coalesce(func.sum(UserExerciseStats.total_clean_reps), 0).label("total"),
        ).outerjoin(
            UserExerciseStats, UserExerciseStats.exercise_id == Exercise.id
        ).group_by(Exercise.id, Exercise.name, Exercise.metric).all()

        result: list[ExerciseVolume] = []
        for row in rows:
            if row.metric == "seconds":
                result.append(ExerciseVolume(
                    exercise=row.name, total=int(row.total) // 60, unit="минут",
                ))
            else:
                result.append(ExerciseVolume(
                    exercise=row.name, total=int(row.total), unit="повторений",
                ))
        return result

    @staticmethod
    def _registrations_daily(db: Session) -> list[RegistrationPoint]:
        day_col = func.date(User.created_at).label("day")
        rows = db.query(day_col, func.count(User.id).label("cnt")) \
            .group_by(day_col).order_by(day_col).all()
        return [RegistrationPoint(date=str(r.day), count=r.cnt) for r in rows]