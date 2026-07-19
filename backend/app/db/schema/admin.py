from pydantic import BaseModel


class AdminLoginIn(BaseModel):
    password: str


class AdminLoginOut(BaseModel):
    token: str


class PieSlice(BaseModel):
    label: str
    value: int


class ChallengeBreakdown(BaseModel):
    total: int
    by_duration: list[PieSlice]        # бессрочные / с датой окончания
    by_visibility: list[PieSlice]      # индивидуальные / групповые
    by_schedule: list[PieSlice]        # daily / weekly
    by_exercise_count: list[PieSlice]  # 1 упражнение / несколько


class TopStreakUser(BaseModel):
    username: str
    streak_longest: int


class ExerciseVolume(BaseModel):
    exercise: str
    total: int
    unit: str  # "повторений" | "минут"


class RegistrationPoint(BaseModel):
    date: str  # ISO yyyy-mm-dd
    count: int


class ActivityStats(BaseModel):
    """Active = made at least one authenticated request in the window
    (users.last_seen_at); rolling windows of 1/7/30 days from now (UTC)."""
    active_today: int
    active_week: int
    active_month: int
    new_today: int  # registered during the current UTC day


class AdminStatsOut(BaseModel):
    total_users: int
    activity: ActivityStats
    challenges: ChallengeBreakdown
    top_streaks: list[TopStreakUser]
    exercise_totals: list[ExerciseVolume]
    registrations_daily: list[RegistrationPoint]