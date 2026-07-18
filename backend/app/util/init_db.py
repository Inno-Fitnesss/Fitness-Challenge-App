import secrets
import string
from datetime import datetime, timezone

from sqlalchemy import text

from app.core.database import Base, engine, SessionLocal
from app.core.security.hashHelper import HashHelper
from app.db.models import user, challenge, steps, withings  # noqa: F401  -- import registers tables on Base
from app.db.models.challenge import Challenge, ChallengeExercise, Exercise
from app.db.models.user import User


_SYSTEM_PRESET_USER = {
    "username": "wowfit",
    "email": "presets@wowfit.local",
    "timezone": "UTC",
}


_PRESET_CHALLENGES = [
    {
        "name": "Лёгкий старт",
        "description": "Мягкий челлендж для новичков, чтобы просто начать двигаться каждый день.",
        "schedule_type": "daily",
        "schedule_days": None,
        "exercises": [
            {"name": "Приседания", "goal": 10},
            {"name": "Отжимания", "goal": 5},
            {"name": "Планка", "goal": 20},
        ],
    },
    {
        "name": "Утренняя зарядка",
        "description": "Быстрая утренняя активность перед учёбой/работой.",
        "schedule_type": "daily",
        "schedule_days": None,
        "exercises": [
            {"name": "Приседания", "goal": 15},
            {"name": "Отжимания", "goal": 10},
            {"name": "Планка", "goal": 30},
        ],
    },
    {
        "name": "Сильные ноги",
        "description": "Фокус на приседаниях, подходит для простого ежедневного прогресса.",
        "schedule_type": "daily",
        "schedule_days": None,
        "exercises": [
            {"name": "Приседания", "goal": 30},
        ],
    },
    {
        "name": "Первые отжимания",
        "description": "Челлендж для тех, кто хочет прокачать отжимания без перегруза.",
        "schedule_type": "weekly",
        "schedule_days": [1, 3, 5],
        "exercises": [
            {"name": "Отжимания", "goal": 15},
        ],
    },
    {
        "name": "Неделя корпуса",
        "description": "Недельный челлендж на корпус и выносливость.",
        "schedule_type": "daily",
        "schedule_days": None,
        "exercises": [
            {"name": "Планка", "goal": 45},
        ],
    },
    {
        "name": "Сложный режим",
        "description": "Для активных пользователей, которым нужен вызов посложнее.",
        "schedule_type": "daily",
        "schedule_days": None,
        "exercises": [
            {"name": "Приседания", "goal": 50},
            {"name": "Отжимания", "goal": 25},
            {"name": "Планка", "goal": 60},
        ],
    },
    {
        "name": "Выходные в тонусе",
        "description": "Короткий челлендж только на выходные.",
        "schedule_type": "weekly",
        "schedule_days": [6, 7],
        "exercises": [
            {"name": "Приседания", "goal": 40},
            {"name": "Отжимания", "goal": 20},
            {"name": "Планка", "goal": 45},
        ],
    },
    {
        "name": "Герой планки",
        "description": "Челлендж на постепенное развитие планки.",
        "schedule_type": "daily",
        "schedule_days": None,
        "exercises": [
            {"name": "Планка", "goal": 60},
        ],
    },
    {
        "name": "Три упражнения",
        "description": "Сбалансированный челлендж: ноги, руки и корпус в одной тренировке.",
        "schedule_type": "weekly",
        "schedule_days": [1, 3, 5],
        "exercises": [
            {"name": "Приседания", "goal": 20},
            {"name": "Отжимания", "goal": 10},
            {"name": "Планка", "goal": 30},
        ],
    },
    {
        "name": "Без пропусков",
        "description": "Простой ежедневный челлендж, где главная цель — не терять регулярность.",
        "schedule_type": "daily",
        "schedule_days": None,
        "exercises": [
            {"name": "Приседания", "goal": 15},
            {"name": "Отжимания", "goal": 5},
            {"name": "Планка", "goal": 20},
        ],
    },
]


def create_tables():
    Base.metadata.create_all(bind=engine)


# Lightweight, idempotent schema sync for existing Postgres databases.
# `create_all` only creates missing tables — it never adds new columns to
# tables that already exist. Since the project has no Alembic, we add the
# columns introduced by the challenge/profile redesign here so deployed
# databases don't 500 on missing columns. Safe to run on every startup.
_PG_COLUMN_MIGRATIONS = [
    "ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE participations ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'",
    "ALTER TABLE participations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm INTEGER",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg INTEGER",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS fitness_level VARCHAR(20)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(64)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub ON users (google_sub)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_hash VARCHAR(250)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_attempts INTEGER DEFAULT 0",
    # Email verification: the column is added without a default so rows that
    # existed before the feature come out NULL; the UPDATE right after
    # grandfathers those accounts in as verified (they could already log in,
    # locking them out now would be a regression). New rows get an explicit
    # False from the ORM.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN",
    "UPDATE users SET email_verified = true WHERE email_verified IS NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_code_hash VARCHAR(250)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_code_expires_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_code_attempts INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_flags JSON",
]


def sync_schema():
    # Only needed for Postgres; SQLite (tests/local) always gets a fresh schema
    # from create_all, and lacks `ADD COLUMN IF NOT EXISTS`.
    if engine.dialect.name != "postgresql":
        return
    for stmt in _PG_COLUMN_MIGRATIONS:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception as error:  # never let a sync step block startup
            print(f"schema sync skipped ({stmt!r}): {error}")
    # Carry over visibility from the legacy is_private column if it still exists.
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "UPDATE challenges SET is_public = NOT is_private "
                "WHERE is_private = false"
            ))
    except Exception as error:
        print(f"schema sync backfill skipped: {error}")


_SEED_EXERCISES = [
    ("Приседания", "reps"),
    ("Отжимания", "reps"),
    ("Планка", "seconds"),
    # Steps come from Withings (steps_daily), not a camera session. The 'steps'
    # metric marks the exercise so the UI skips the CV workflow and the backend
    # feeds progress from the daily step count instead of session submissions.
    ("Шаги", "steps"),
]


def seed_exercises():
    # Idempotent upsert by name: unlike a one-shot `count() == 0` seed, this also
    # adds exercises introduced later (e.g. "Шаги") to already-populated databases
    # without duplicating the ones that are already there.
    db = SessionLocal()
    try:
        existing = {e.name for e in db.query(Exercise.name).all()}
        new = [Exercise(name=name, metric=metric)
               for name, metric in _SEED_EXERCISES if name not in existing]
        if new:
            db.add_all(new)
            db.commit()
    finally:
        db.close()


def _unique_join_code(db) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(10):
        code = "".join(secrets.choice(alphabet) for _ in range(8))
        if not db.query(Challenge.id).filter_by(join_code=code).first():
            return code
    raise RuntimeError("Could not generate unique join code for preset challenge")


def _get_or_create_preset_owner(db) -> User:
    owner = (
        db.query(User)
        .filter(
            (User.email == _SYSTEM_PRESET_USER["email"])
            | (User.username == _SYSTEM_PRESET_USER["username"])
        )
        .first()
    )
    if owner:
        owner.timezone = _SYSTEM_PRESET_USER["timezone"]
        return owner

    owner = User(
        username=_SYSTEM_PRESET_USER["username"],
        email=_SYSTEM_PRESET_USER["email"],
        password_hash=HashHelper.get_password_hash(secrets.token_urlsafe(48)),
        timezone=_SYSTEM_PRESET_USER["timezone"],
    )
    db.add(owner)
    db.flush()
    return owner


def _sync_preset_exercises(db, challenge_id: int, exercise_goals: dict[int, int]):
    existing = {
        ce.exercise_id: ce
        for ce in db.query(ChallengeExercise).filter_by(challenge_id=challenge_id).all()
    }

    for exercise_id, challenge_exercise in list(existing.items()):
        if exercise_id not in exercise_goals:
            db.delete(challenge_exercise)

    for exercise_id, goal in exercise_goals.items():
        if exercise_id in existing:
            existing[exercise_id].goal = goal
        else:
            db.add(ChallengeExercise(
                challenge_id=challenge_id,
                exercise_id=exercise_id,
                goal=goal,
            ))


def seed_preset_challenges():
    db = SessionLocal()
    try:
        owner = _get_or_create_preset_owner(db)
        db.flush()

        required_exercise_names = {
            exercise["name"]
            for preset in _PRESET_CHALLENGES
            for exercise in preset["exercises"]
        }
        exercises_by_name = {
            exercise.name: exercise
            for exercise in db.query(Exercise)
            .filter(Exercise.name.in_(required_exercise_names))
            .all()
        }
        missing_exercises = required_exercise_names - set(exercises_by_name)
        if missing_exercises:
            names = ", ".join(sorted(missing_exercises))
            raise RuntimeError(f"Missing exercises for preset challenges: {names}")

        today = datetime.now(timezone.utc).date()
        for preset in _PRESET_CHALLENGES:
            preset_challenge = (
                db.query(Challenge)
                .filter(Challenge.name == preset["name"], Challenge.is_preset.is_(True))
                .first()
            )
            if not preset_challenge:
                preset_challenge = Challenge(
                    name=preset["name"],
                    created_by=owner.id,
                    start_date=today,
                    join_code=_unique_join_code(db),
                )
                db.add(preset_challenge)

            preset_challenge.description = preset["description"]
            preset_challenge.created_by = owner.id
            preset_challenge.schedule_type = preset["schedule_type"]
            preset_challenge.schedule_days = (
                None
                if preset["schedule_type"] == "daily"
                else list(preset["schedule_days"])
            )
            preset_challenge.end_date = None
            preset_challenge.is_preset = True
            preset_challenge.is_public = True
            preset_challenge.status = "active"
            db.flush()

            exercise_goals = {
                exercises_by_name[exercise["name"]].id: exercise["goal"]
                for exercise in preset["exercises"]
            }
            _sync_preset_exercises(db, preset_challenge.id, exercise_goals)

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
