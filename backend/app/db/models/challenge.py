from app.core.database import Base
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, Boolean, Date, DateTime,
    ForeignKey, JSON, UniqueConstraint, func,
)


class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    metric = Column(String(20), nullable=False, default="reps")  # 'reps' | 'seconds'
    video_url = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())


class Challenge(Base):
    __tablename__ = "challenges"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    schedule_type = Column(String(20), nullable=False)  # 'daily' | 'weekly'
    schedule_days = Column(JSON)                         # [1..7] for weekly, null for daily
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)                              # null = open-ended
    join_code = Column(String(50), unique=True, nullable=False)
    is_preset = Column(Boolean, default=False)
    # Lifecycle: a challenge is created private (individual) and can be made
    # public exactly once. Going public is irreversible: editing is locked
    # forever and other users may join. Presets are public templates.
    is_public = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="active")  # active | completed
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ChallengeExercise(Base):
    __tablename__ = "challenge_exercises"
    id = Column(Integer, primary_key=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    goal = Column(Integer, nullable=False)  # in units of exercises.metric
    __table_args__ = (UniqueConstraint("challenge_id", "exercise_id"),)


class Participation(Base):
    __tablename__ = "participations"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    challenge_id = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False)
    # Per-user view of a shared challenge. Archiving/un-archiving only touches
    # the caller's own participation; deleting removes this row, and the
    # challenge itself is purged once its last participation is gone.
    status = Column(String(20), nullable=False, default="active")  # active | archived
    archived_at = Column(DateTime)
    joined_at = Column(DateTime, server_default=func.now())
    days_completed = Column(Integer, default=0)      # score for the leaderboard
    challenge_streak = Column(Integer, default=0)
    total_clean_reps = Column(Integer, default=0)
    last_closed_date = Column(Date)
    __table_args__ = (UniqueConstraint("user_id", "challenge_id"),)


class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True)
    participation_id = Column(Integer, ForeignKey("participations.id"), nullable=False)
    challenge_exercise_id = Column(Integer, ForeignKey("challenge_exercises.id"), nullable=False)
    start_time = Column(DateTime, server_default=func.now())
    end_time = Column(DateTime)
    total_reps = Column(Integer)
    clean_reps = Column(Integer)  # only these count toward the goal
    duration_seconds = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())


class ChallengeExerciseProgress(Base):
    __tablename__ = "challenge_exercise_progress"
    id = Column(Integer, primary_key=True)
    participation_id = Column(Integer, ForeignKey("participations.id", ondelete="CASCADE"), nullable=False)
    challenge_exercise_id = Column(Integer, ForeignKey("challenge_exercises.id"), nullable=False)
    date = Column(Date, nullable=False)  # user-local date
    clean_reps = Column(Integer, default=0)
    is_closed = Column(Boolean, default=False)  # clean_reps >= goal
    __table_args__ = (UniqueConstraint("participation_id", "challenge_exercise_id", "date"),)


class ChallengeDayProgress(Base):
    __tablename__ = "challenge_day_progress"
    id = Column(Integer, primary_key=True)
    participation_id = Column(Integer, ForeignKey("participations.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    is_closed = Column(Boolean, default=False)  # true when every exercise is closed that day
    closed_at = Column(DateTime)
    __table_args__ = (UniqueConstraint("participation_id", "date"),)


class UserExerciseStats(Base):
    __tablename__ = "user_exercise_stats"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    total_clean_reps = Column(BigInteger, default=0)  # all-time volume (seconds for plank)
    __table_args__ = (UniqueConstraint("user_id", "exercise_id"),)
