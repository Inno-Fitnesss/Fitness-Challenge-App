"""
Input validation edge cases for challenge creation/editing and session
submission. Existing tests (test_challenges.py) cover the "happy path" plus
a few basic validation failures (missing exercises, invalid exercise id,
end_date before start_date). This file pushes on the actual boundary values
defined in app/db/schema/challenge.py, plus a couple of gaps that schema
validation does NOT currently catch.
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.challenge import Exercise

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_validation.db"

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


@pytest.fixture(autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.add_all([
        Exercise(id=1, name="Приседания", metric="reps"),
        Exercise(id=2, name="Отжимания", metric="reps"),
        Exercise(id=3, name="Планка", metric="seconds"),
    ])
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def auth_token():
    data = {
        "username": "validationuser", "email": "validation@example.com", "password": "Test123!",
        "first_name": "Val", "last_name": "User",
    }
    client.post("/auth/signup", json=data)
    resp = client.post("/auth/login", json={"email": "validation@example.com", "password": "Test123!"})
    return resp.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def base_payload(**overrides):
    payload = {
        "name": "Valid Name",
        "schedule_type": "daily",
        "start_date": date.today().isoformat(),
        "exercises": [{"exercise_id": 1, "goal": 10}],
    }
    payload.update(overrides)
    return payload


def create(token, **overrides):
    return client.post("/challenges", json=base_payload(**overrides), headers=_auth(token))


# ======================================================================
# name
# ======================================================================
class TestNameValidation:

    def test_empty_name_rejected(self, auth_token):
        r = create(auth_token, name="")
        assert r.status_code == 422

    def test_name_at_max_length_accepted(self, auth_token):
        r = create(auth_token, name="A" * 50)
        assert r.status_code == 201

    def test_name_over_max_length_rejected(self, auth_token):
        r = create(auth_token, name="A" * 51)
        assert r.status_code == 422

    def test_name_missing_rejected(self, auth_token):
        payload = base_payload()
        del payload["name"]
        r = client.post("/challenges", json=payload, headers=_auth(auth_token))
        assert r.status_code == 422

    def test_whitespace_only_name_currently_accepted(self, auth_token):
        """No trim/blank check exists in the schema today — documenting the
        current (permissive) behavior so a future fix is a visible diff."""
        r = create(auth_token, name="   ")
        assert r.status_code == 201


# ======================================================================
# description
# ======================================================================
class TestDescriptionValidation:

    def test_description_at_max_length_accepted(self, auth_token):
        r = create(auth_token, description="D" * 200)
        assert r.status_code == 201

    def test_description_over_max_length_rejected(self, auth_token):
        r = create(auth_token, description="D" * 201)
        assert r.status_code == 422

    def test_description_optional(self, auth_token):
        payload = base_payload()
        payload.pop("description", None)
        r = client.post("/challenges", json=payload, headers=_auth(auth_token))
        assert r.status_code == 201


# ======================================================================
# exercise goal
# ======================================================================
class TestGoalValidation:

    def test_goal_zero_rejected(self, auth_token):
        r = create(auth_token, exercises=[{"exercise_id": 1, "goal": 0}])
        assert r.status_code == 422

    def test_goal_negative_rejected(self, auth_token):
        r = create(auth_token, exercises=[{"exercise_id": 1, "goal": -5}])
        assert r.status_code == 422

    def test_goal_at_cap_accepted(self, auth_token):
        r = create(auth_token, exercises=[{"exercise_id": 1, "goal": 100_000}])
        assert r.status_code == 201

    def test_goal_over_cap_rejected(self, auth_token):
        r = create(auth_token, exercises=[{"exercise_id": 1, "goal": 100_001}])
        assert r.status_code == 422

    def test_goal_of_one_accepted(self, auth_token):
        r = create(auth_token, exercises=[{"exercise_id": 1, "goal": 1}])
        assert r.status_code == 201


# ======================================================================
# exercises list
# ======================================================================
class TestExerciseListValidation:

    def test_empty_exercise_list_rejected(self, auth_token):
        r = create(auth_token, exercises=[])
        assert r.status_code == 422

    def test_duplicate_exercise_in_list_rejected(self, auth_token):
        r = create(auth_token, exercises=[
            {"exercise_id": 1, "goal": 10}, {"exercise_id": 1, "goal": 20},
        ])
        assert r.status_code == 422

    def test_nonexistent_exercise_id_rejected(self, auth_token):
        r = create(auth_token, exercises=[{"exercise_id": 9999, "goal": 10}])
        assert r.status_code == 400

    def test_three_distinct_exercises_accepted(self, auth_token):
        r = create(auth_token, exercises=[
            {"exercise_id": 1, "goal": 10},
            {"exercise_id": 2, "goal": 10},
            {"exercise_id": 3, "goal": 60},
        ])
        assert r.status_code == 201

    def test_edit_to_duplicate_exercises_rejected(self, auth_token):
        cid = create(auth_token).json()["id"]
        r = client.patch(f"/challenges/{cid}", json={
            "exercises": [{"exercise_id": 1, "goal": 10}, {"exercise_id": 1, "goal": 5}],
        }, headers=_auth(auth_token))
        assert r.status_code == 422

    def test_edit_to_empty_exercise_list_rejected(self, auth_token):
        cid = create(auth_token).json()["id"]
        r = client.patch(f"/challenges/{cid}", json={"exercises": []}, headers=_auth(auth_token))
        assert r.status_code == 422


# ======================================================================
# schedule_type / schedule_days
# ======================================================================
class TestScheduleValidation:

    def test_weekly_without_schedule_days_rejected(self, auth_token):
        r = create(auth_token, schedule_type="weekly")
        assert r.status_code == 422

    def test_weekly_with_empty_schedule_days_rejected(self, auth_token):
        r = create(auth_token, schedule_type="weekly", schedule_days=[])
        assert r.status_code == 422

    def test_schedule_day_zero_rejected(self, auth_token):
        r = create(auth_token, schedule_type="weekly", schedule_days=[0, 1])
        assert r.status_code == 422

    def test_schedule_day_eight_rejected(self, auth_token):
        r = create(auth_token, schedule_type="weekly", schedule_days=[1, 8])
        assert r.status_code == 422

    def test_schedule_days_1_to_7_all_accepted(self, auth_token):
        r = create(auth_token, schedule_type="weekly", schedule_days=[1, 2, 3, 4, 5, 6, 7])
        assert r.status_code == 201

    def test_invalid_schedule_type_rejected(self, auth_token):
        r = create(auth_token, schedule_type="monthly")
        assert r.status_code == 422

    def test_daily_ignores_provided_schedule_days(self, auth_token):
        """schedule_type=daily forces schedule_days to null regardless of
        what the client sends (see ChallengeCreate._consistency)."""
        r = create(auth_token, schedule_type="daily", schedule_days=[1, 2])
        assert r.status_code == 201
        assert r.json()["schedule_days"] is None

    def test_schedule_days_with_duplicates_currently_accepted(self, auth_token):
        """Not deduped/validated today — [1, 1, 1] is treated the same as [1]."""
        r = create(auth_token, schedule_type="weekly", schedule_days=[1, 1, 1])
        assert r.status_code == 201


# ======================================================================
# dates
# ======================================================================
class TestDateValidation:

    def test_start_date_in_past_rejected(self, auth_token):
        r = create(auth_token, start_date=(date.today() - timedelta(days=1)).isoformat())
        assert r.status_code == 422

    def test_start_date_missing_defaults_to_today(self, auth_token):
        payload = base_payload()
        del payload["start_date"]
        r = client.post("/challenges", json=payload, headers=_auth(auth_token))
        assert r.status_code == 201
        assert r.json()["start_date"] == date.today().isoformat()

    def test_end_date_equal_to_start_date_accepted(self, auth_token):
        today = date.today().isoformat()
        r = create(auth_token, start_date=today, end_date=today)
        assert r.status_code == 201

    def test_end_date_before_start_date_rejected(self, auth_token):
        r = create(
            auth_token,
            start_date=date.today().isoformat(),
            end_date=(date.today() - timedelta(days=1)).isoformat(),
        )
        assert r.status_code == 422


# ======================================================================
# session submission
# ======================================================================
class TestSessionSubmissionValidation:

    def test_negative_total_reps_rejected(self, auth_token):
        cid = create(auth_token).json()["id"]
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        r = client.post(
            f"/challenges/{cid}/sessions",
            json={"challenge_exercise_id": ce_id, "total_reps": -1, "clean_reps": 0},
            headers=_auth(auth_token),
        )
        assert r.status_code == 422

    def test_negative_clean_reps_rejected(self, auth_token):
        cid = create(auth_token).json()["id"]
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        r = client.post(
            f"/challenges/{cid}/sessions",
            json={"challenge_exercise_id": ce_id, "total_reps": 10, "clean_reps": -1},
            headers=_auth(auth_token),
        )
        assert r.status_code == 422

    def test_zero_reps_session_accepted_but_does_not_close(self, auth_token):
        cid = create(auth_token).json()["id"]
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        r = client.post(
            f"/challenges/{cid}/sessions",
            json={"challenge_exercise_id": ce_id, "total_reps": 0, "clean_reps": 0},
            headers=_auth(auth_token),
        )
        assert r.status_code == 200
        assert r.json()["exercise"]["closed"] is False

    def test_clean_reps_greater_than_total_reps_currently_accepted(self, auth_token):
        """There is no cross-field check that clean_reps <= total_reps, so a
        client (buggy or malicious) can report more 'clean' reps than total
        reps performed and it's accepted at face value. Flagging as a data
        integrity gap worth a follow-up, not asserting it should fail."""
        cid = create(auth_token, exercises=[{"exercise_id": 1, "goal": 10_000}]).json()["id"]
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        r = client.post(
            f"/challenges/{cid}/sessions",
            json={"challenge_exercise_id": ce_id, "total_reps": 5, "clean_reps": 50},
            headers=_auth(auth_token),
        )
        assert r.status_code == 200
        assert r.json()["exercise"]["clean"] == 50


# ======================================================================
# join code
# ======================================================================
class TestJoinCodeValidation:

    def test_empty_join_code_rejected(self, auth_token):
        r = client.post("/challenges/join", json={"join_code": ""}, headers=_auth(auth_token))
        assert r.status_code == 422

    def test_nonexistent_join_code_returns_404(self, auth_token):
        r = client.post("/challenges/join", json={"join_code": "NOTAREALCODE"}, headers=_auth(auth_token))
        assert r.status_code == 404

    def test_join_code_is_case_sensitive(self, auth_token):
        cid = create(auth_token).json()["id"]
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        code = detail["join_code"]
        r = client.post("/challenges/join", json={"join_code": code.lower()}, headers=_auth(auth_token))
        # Generated codes are uppercase A-Z0-9; lowering a code with any
        # letters makes it a different, nonexistent code.
        if code.lower() != code:
            assert r.status_code == 404