from app.core.database import Base, engine, SessionLocal
from app.db.models import user, challenge  # noqa: F401  -- import registers tables on Base
from app.db.models.challenge import Exercise


def create_tables():
    Base.metadata.create_all(bind=engine)


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
