"""
Diagnostic for a reported bug: "групповой лидерборд не увеличивал кол-во
дней" — days_completed not going up in a public/group challenge's
leaderboard. Every existing streak/day test in test_streaks_scheduling.py
uses a single-participant PRIVATE challenge, so this is a genuine gap:
nothing so far has exercised days_completed across multiple participants
in a PUBLIC challenge over several days. This file fills that gap and
should reveal whether the backend actually behaves differently there, or
whether the bug is elsewhere (frontend not refetching, etc).
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.challenge import Exercise, Participation

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_group_leaderboard.db"

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

DAY = [date(2026, 6, 1) + timedelta(days=i) for i in range(7)]  # Monday-anchored


def freeze(monkeypatch, fake_date):
    monkeypatch.setattr("app.service.sessionService.local_today", lambda tz=None: fake_date)
    monkeypatch.setattr("app.service.challengeService.local_today", lambda tz=None: fake_date)


@pytest.fixture(autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.add_all([
        Exercise(id=1, name="Приседания", metric="reps"),
        Exercise(id=2, name="Отжимания", metric="reps"),
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
def owner_token():
    return _register("groupowner", "groupowner@example.com")


@pytest.fixture
def member_token():
    return _register("groupmember", "groupmember@example.com")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _submit_all(token, cid, ce_ids, goal=10):
    resp = None
    for ce_id in ce_ids:
        resp = client.post(
            f"/challenges/{cid}/sessions",
            json={"challenge_exercise_id": ce_id, "total_reps": goal, "clean_reps": goal},
            headers=_auth(token),
        )
        assert resp.status_code == 200, resp.text
    return resp


class TestGroupChallengeDaysCompleted:

    def test_days_completed_increments_independently_for_each_participant_in_a_public_challenge(
        self, monkeypatch, owner_token, member_token
    ):
        freeze(monkeypatch, DAY[0])
        payload = {
            "name": "Group Challenge", "schedule_type": "daily",
            "start_date": DAY[0].isoformat(),
            "exercises": [{"exercise_id": 1, "goal": 10}, {"exercise_id": 2, "goal": 10}],
        }
        cid = client.post("/challenges", json=payload, headers=_auth(owner_token)).json()["id"]
        client.post(f"/challenges/{cid}/publish", headers=_auth(owner_token))

        code = client.get(f"/challenges/{cid}", headers=_auth(owner_token)).json()["join_code"]
        r = client.post("/challenges/join", json={"join_code": code}, headers=_auth(member_token))
        assert r.status_code == 201

        detail = client.get(f"/challenges/{cid}", headers=_auth(owner_token)).json()
        ce_ids = [e["challenge_exercise_id"] for e in detail["exercises"]]

        # Day 0: BOTH complete everything.
        _submit_all(owner_token, cid, ce_ids)
        _submit_all(member_token, cid, ce_ids)

        board = client.get(f"/challenges/{cid}/leaderboard", headers=_auth(owner_token)).json()
        by_username = {e["username"]: e for e in board}
        assert by_username["groupowner"]["days_completed"] == 1, (
            f"owner days_completed did not reach 1 after finishing day 0: {board}"
        )
        assert by_username["groupmember"]["days_completed"] == 1, (
            f"member days_completed did not reach 1 after finishing day 0: {board}"
        )

        # Day 1: ONLY the owner completes it.
        freeze(monkeypatch, DAY[1])
        _submit_all(owner_token, cid, ce_ids)

        board2 = client.get(f"/challenges/{cid}/leaderboard", headers=_auth(member_token)).json()
        by_username2 = {e["username"]: e for e in board2}
        assert by_username2["groupowner"]["days_completed"] == 2, (
            f"owner days_completed did not increment on day 1: {board2}"
        )
        assert by_username2["groupmember"]["days_completed"] == 1, (
            f"member days_completed changed even though they did nothing on day 1: {board2}"
        )

        # Cross-check directly against the DB, bypassing any API-layer mapping.
        from app.db.models.user import User
        db = TestingSessionLocal()
        owner_user = db.query(User).filter_by(username="groupowner").first()
        owner_part = db.query(Participation).filter_by(
            challenge_id=cid, user_id=owner_user.id).first()
        assert owner_part.days_completed == 2
        db.close()

    def test_leaderboard_days_completed_visible_to_a_participant_who_isnt_the_one_who_acted(
        self, monkeypatch, owner_token, member_token
    ):
        """Specifically covers: 'someone completed a day, but a DIFFERENT
        logged-in viewer's leaderboard still shows 0 for them' — i.e. is the
        leaderboard genuinely live/shared, or somehow scoped to the viewer?"""
        freeze(monkeypatch, DAY[0])
        payload = {
            "name": "Group Visibility Check", "schedule_type": "daily",
            "start_date": DAY[0].isoformat(),
            "exercises": [{"exercise_id": 1, "goal": 5}],
        }
        cid = client.post("/challenges", json=payload, headers=_auth(owner_token)).json()["id"]
        client.post(f"/challenges/{cid}/publish", headers=_auth(owner_token))
        code = client.get(f"/challenges/{cid}", headers=_auth(owner_token)).json()["join_code"]
        client.post("/challenges/join", json={"join_code": code}, headers=_auth(member_token))

        detail = client.get(f"/challenges/{cid}", headers=_auth(owner_token)).json()
        ce_ids = [e["challenge_exercise_id"] for e in detail["exercises"]]

        # Only the OWNER acts.
        _submit_all(owner_token, cid, ce_ids, goal=5)

        # The MEMBER (who did nothing) checks the leaderboard.
        board_seen_by_member = client.get(
            f"/challenges/{cid}/leaderboard", headers=_auth(member_token)
        ).json()
        owner_row = next(e for e in board_seen_by_member if e["username"] == "groupowner")
        assert owner_row["days_completed"] == 1, (
            "the leaderboard must show the owner's real progress to any "
            "participant viewing it, not just to the owner themself"
        )