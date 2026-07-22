"""Steps as a challenge exercise: the steps_daily -> challenge progress bridge.

Steps arrive as an absolute daily total from Withings/companion (not additive
camera reps), so the feeder uses SET semantics and must:
- set the day's per-exercise progress to the current step count;
- close the day (and bump streak / days_completed) once steps >= goal;
- stay idempotent — re-syncing the same day must not double-count or re-close;
- only close the day when EVERY exercise that day is closed (mixed challenge).
"""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.user import User
from app.db.models.challenge import (
    Exercise, Challenge, Participation, ChallengeExercise,
    ChallengeExerciseProgress,
)

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_steps_challenge.db"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

STEPS_ID = 4


@pytest.fixture(autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        db.add_all([
            Exercise(id=1, name="Приседания", metric="reps"),
            Exercise(id=2, name="Отжимания", metric="reps"),
            Exercise(id=3, name="Планка", metric="seconds"),
            Exercise(id=STEPS_ID, name="Шаги", metric="steps"),
        ])
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def auth_header():
    client.post("/auth/signup", json={
        "username": "walker", "email": "walker@example.com", "password": "Walk123!",
        "terms_accepted": True, "privacy_accepted": True,
    })
    token = client.post("/auth/login", json={
        "email": "walker@example.com", "password": "Walk123!",
    }).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _backdate_start(challenge_id, days=1):
    db = TestingSessionLocal()
    try:
        db.get(Challenge, challenge_id).start_date = date.today() - timedelta(days=days)
        db.commit()
    finally:
        db.close()


def _make_challenge(auth_header, exercises):
    resp = client.post("/challenges", json={
        "name": "Steps challenge", "schedule_type": "daily", "exercises": exercises,
    }, headers=auth_header)
    assert resp.status_code in (200, 201), resp.text
    cid = resp.json()["id"]
    _backdate_start(cid)
    return cid


def _sync_steps(auth_header, step_count, day=None):
    return client.post("/me/steps/sync", json={"days": [{
        "date": (day or date.today()).isoformat(),
        "step_count": step_count,
        "source": "health_connect",
    }]}, headers=auth_header)


def _progress(challenge_id):
    """(clean_reps, is_closed, days_completed) for the steps exercise today."""
    db = TestingSessionLocal()
    try:
        part = db.query(Participation).filter_by(challenge_id=challenge_id).one()
        ce = db.query(ChallengeExercise).filter_by(
            challenge_id=challenge_id, exercise_id=STEPS_ID).one()
        ep = db.query(ChallengeExerciseProgress).filter_by(
            participation_id=part.id, challenge_exercise_id=ce.id, date=date.today()).first()
        return (
            ep.clean_reps if ep else None,
            bool(ep and ep.is_closed),
            part.days_completed or 0,
        )
    finally:
        db.close()


def test_steps_below_goal_set_but_not_closed(auth_header):
    cid = _make_challenge(auth_header, [{"exercise_id": STEPS_ID, "goal": 8000}])
    assert _sync_steps(auth_header, 5000).status_code == 200

    clean, closed, days = _progress(cid)
    assert clean == 5000  # SET to the absolute count
    assert closed is False
    assert days == 0


def test_steps_reaching_goal_closes_day(auth_header):
    cid = _make_challenge(auth_header, [{"exercise_id": STEPS_ID, "goal": 8000}])
    assert _sync_steps(auth_header, 8200).status_code == 200

    clean, closed, days = _progress(cid)
    assert clean == 8200
    assert closed is True
    assert days == 1


def test_resync_is_idempotent(auth_header):
    """Re-syncing an already-closed day must not double-count or re-close it —
    the whole point of SET (not +=) semantics."""
    cid = _make_challenge(auth_header, [{"exercise_id": STEPS_ID, "goal": 8000}])
    _sync_steps(auth_header, 8200)
    _sync_steps(auth_header, 9000)  # later in the day, more steps
    _sync_steps(auth_header, 9000)  # a redundant re-sync

    clean, closed, days = _progress(cid)
    assert clean == 9000       # latest count, not summed
    assert closed is True
    assert days == 1           # counted exactly once


def test_mixed_challenge_steps_alone_do_not_close_day(auth_header):
    """With steps + pushups, hitting the step goal must not close the day while
    pushups are still open."""
    cid = _make_challenge(auth_header, [
        {"exercise_id": STEPS_ID, "goal": 8000},
        {"exercise_id": 2, "goal": 10},
    ])
    assert _sync_steps(auth_header, 9000).status_code == 200

    clean, closed, days = _progress(cid)
    assert clean == 9000
    assert closed is True   # the steps exercise itself is closed
    assert days == 0        # but the day isn't — pushups still open
