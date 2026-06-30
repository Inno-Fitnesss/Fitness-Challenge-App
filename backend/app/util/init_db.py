from sqlalchemy import text

from app.core.database import Base, engine, SessionLocal
from app.db.models import user, challenge  # noqa: F401  -- import registers tables on Base
from app.db.models.challenge import Exercise


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


def seed_exercises():
    db = SessionLocal()
    try:
        if db.query(Exercise).count() == 0:
            db.add_all([
                Exercise(name="Приседания", metric="reps"),
                Exercise(name="Отжимания", metric="reps"),
                Exercise(name="Планка", metric="seconds"),
            ])
            db.commit()
    finally:
        db.close()
