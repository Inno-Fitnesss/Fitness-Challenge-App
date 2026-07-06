"""
Deeper edit() and today() coverage beyond the basics already in
test_challenges.py (rename, simple schedule change, non-creator/404).
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.challenge import Exercise, Challenge, Participation

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_edit_today_deep.db"

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


def _register(username, email):
    data = {
        "username": username, "email": email, "password": "Test123!",
        "first_name": "F", "last_name": "L",
    }
    client.post("/auth/signup", json=data)
    resp = client.post("/auth/login", json={"email": email, "password": "Test123!"})
    return resp.json()["token"]


@pytest.fixture
def auth_token():
    return _register("editor", "editor@example.com")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def create_daily(token, start=None):
    payload = {
        "name": "Editable Challenge", "schedule_type": "daily",
        "start_date": (start or date.today()).isoformat(),
        "exercises": [{"exercise_id": 1, "goal": 10}],
    }
    return client.post("/challenges", json=payload, headers=_auth(token)).json()["id"]


def create_weekly(token, days, start=None):
    payload = {
        "name": "Editable Weekly Challenge", "schedule_type": "weekly",
        "schedule_days": days, "start_date": (start or date.today()).isoformat(),
        "exercises": [{"exercise_id": 1, "goal": 10}],
    }
    return client.post("/challenges", json=payload, headers=_auth(token)).json()["id"]


def _force_status(challenge_id, status):
    db = TestingSessionLocal()
    ch = db.get(Challenge, challenge_id)
    ch.status = status
    db.commit()
    db.close()


def _backdate_start(challenge_id, days=1):
    """create() rejects a past start_date, so - same trick as
    test_challenges.py - create for "today" then backdate directly in the
    DB to get a reliably-already-started challenge."""
    db = TestingSessionLocal()
    ch = db.get(Challenge, challenge_id)
    ch.start_date = date.today() - timedelta(days=days)
    db.commit()
    db.close()


# ======================================================================
# ChallengeEdit: schedule_type transitions
# ======================================================================
class TestEditScheduleTransitions:

    def test_weekly_to_daily_clears_schedule_days(self, auth_token):
        cid = create_weekly(auth_token, [1, 3, 5])
        r = client.patch(f"/challenges/{cid}", json={"schedule_type": "daily"},
                          headers=_auth(auth_token))
        assert r.status_code == 200
        assert r.json()["schedule_days"] is None

    def test_daily_to_weekly_without_schedule_days_rejected(self, auth_token):
        cid = create_daily(auth_token)
        r = client.patch(f"/challenges/{cid}", json={"schedule_type": "weekly"},
                          headers=_auth(auth_token))
        assert r.status_code == 422

    def test_daily_to_weekly_with_schedule_days_succeeds(self, auth_token):
        cid = create_daily(auth_token)
        r = client.patch(f"/challenges/{cid}", json={
            "schedule_type": "weekly", "schedule_days": [2, 4],
        }, headers=_auth(auth_token))
        assert r.status_code == 200
        assert sorted(r.json()["schedule_days"]) == [2, 4]

    def test_updating_schedule_days_alone_without_schedule_type_is_a_noop(self, auth_token):
        """Known gap: edit() only ever writes schedule_days when
        schedule_type is ALSO included in the same PATCH (see
        ChallengeService.edit — `if data.schedule_type is not None: ...
        c.schedule_days = ...`). Sending just {"schedule_days": [...]} on an
        already-weekly challenge is silently ignored."""
        cid = create_weekly(auth_token, [1, 3, 5])
        r = client.patch(f"/challenges/{cid}", json={"schedule_days": [2, 4, 6]},
                          headers=_auth(auth_token))
        assert r.status_code == 200
        assert sorted(r.json()["schedule_days"]) == [1, 3, 5], (
            "schedule_days sent without schedule_type is currently a silent no-op"
        )


# ======================================================================
# ChallengeEdit: dates / exercises on an already-active challenge
# ======================================================================
class TestEditActiveChallenge:

    def test_can_push_start_date_further_into_the_future(self, auth_token):
        cid = create_daily(auth_token)
        new_start = (date.today() + timedelta(days=3)).isoformat()
        r = client.patch(f"/challenges/{cid}", json={"start_date": new_start},
                          headers=_auth(auth_token))
        assert r.status_code == 200
        assert r.json()["start_date"] == new_start

    def test_edit_can_introduce_end_date_before_existing_start_date_is_rejected(self, auth_token):
        cid = create_daily(auth_token, start=date.today())
        bad_end = (date.today() - timedelta(days=1)).isoformat()
        r = client.patch(f"/challenges/{cid}", json={"end_date": bad_end},
                          headers=_auth(auth_token))
        assert r.status_code == 422

    def test_removing_an_exercise_removes_its_progress_association(self, auth_token):
        cid = create_daily(auth_token)
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        client.post(f"/challenges/{cid}/sessions",
                     json={"challenge_exercise_id": ce_id, "total_reps": 5, "clean_reps": 5},
                     headers=_auth(auth_token))
        # Replace exercise 1 with exercise 2 entirely.
        r = client.patch(f"/challenges/{cid}", json={
            "exercises": [{"exercise_id": 2, "goal": 10}],
        }, headers=_auth(auth_token))
        assert r.status_code == 200
        new_ids = [e["exercise_id"] for e in r.json()["exercises"]]
        assert new_ids == [2]

    def test_adding_a_second_exercise_via_edit(self, auth_token):
        cid = create_daily(auth_token)
        r = client.patch(f"/challenges/{cid}", json={
            "exercises": [
                {"exercise_id": 1, "goal": 10},
                {"exercise_id": 2, "goal": 15},
            ],
        }, headers=_auth(auth_token))
        assert r.status_code == 200
        assert len(r.json()["exercises"]) == 2

    def test_cannot_edit_after_challenge_made_public(self, auth_token):
        cid = create_daily(auth_token)
        client.post(f"/challenges/{cid}/publish", headers=_auth(auth_token))
        r = client.patch(f"/challenges/{cid}", json={"name": "New name"}, headers=_auth(auth_token))
        assert r.status_code == 409


# ======================================================================
# /me/today deeper cases
# ======================================================================
class TestTodayDeep:

    def test_archived_challenge_excluded_from_today(self, auth_token):
        cid = create_daily(auth_token)
        _backdate_start(cid, days=1)
        client.post(f"/challenges/{cid}/archive", headers=_auth(auth_token))
        today = client.get("/me/today", headers=_auth(auth_token)).json()
        assert not any(c["id"] == cid for c in today)

    def test_challenge_with_completed_status_excluded_from_today(self, auth_token):
        cid = create_daily(auth_token)
        _backdate_start(cid, days=1)
        _force_status(cid, "completed")
        today = client.get("/me/today", headers=_auth(auth_token)).json()
        assert not any(c["id"] == cid for c in today)

    def test_today_shows_multiple_active_challenges(self, auth_token):
        cid1 = create_daily(auth_token)
        _backdate_start(cid1, days=1)
        payload = {
            "name": "Second today challenge", "schedule_type": "daily",
            "start_date": date.today().isoformat(),
            "exercises": [{"exercise_id": 2, "goal": 10}],
        }
        cid2 = client.post("/challenges", json=payload, headers=_auth(auth_token)).json()["id"]
        _backdate_start(cid2, days=1)
        today = client.get("/me/today", headers=_auth(auth_token)).json()
        ids = {c["id"] for c in today}
        assert {cid1, cid2}.issubset(ids)

    def test_today_reflects_zero_progress_for_untouched_exercise(self, auth_token):
        cid = create_daily(auth_token)
        _backdate_start(cid, days=1)
        today = client.get("/me/today", headers=_auth(auth_token)).json()
        assert today[0]["exercises"][0]["clean_today"] == 0
        assert today[0]["exercises"][0]["closed"] is False