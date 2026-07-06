"""
Coverage for the three routers that had zero dedicated tests: /admin,
/exercises, /public. Admin auth is a shared bcrypt password (not tied to a
user account), so we monkeypatch the module-level ADMIN_PASSWORD_HASH
constant to a hash of a password we control, instead of depending on
whatever is in the local .env.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.core.security.hashHelper import HashHelper
from app.db.models.challenge import Exercise

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_admin_public.db"

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

ADMIN_PASSWORD = "test-admin-password"
ADMIN_PASSWORD_HASH = HashHelper.get_password_hash(ADMIN_PASSWORD)


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
    return _register("adminctxuser", "adminctx@example.com")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def create_challenge(token, public=True):
    payload = {
        "name": "Public API Challenge",
        "schedule_type": "daily",
        "start_date": date.today().isoformat(),
        "exercises": [{"exercise_id": 1, "goal": 10}],
    }
    cid = client.post("/challenges", json=payload, headers=_auth(token)).json()["id"]
    if public:
        client.post(f"/challenges/{cid}/publish", headers=_auth(token))
    return cid


# ======================================================================
# /exercises
# ======================================================================
class TestExercisesRouter:

    def test_list_exercises_requires_auth(self):
        r = client.get("/exercises")
        assert r.status_code == 401

    def test_list_exercises_returns_seeded_exercises(self, auth_token):
        r = client.get("/exercises", headers=_auth(auth_token))
        assert r.status_code == 200
        names = {e["name"] for e in r.json()}
        assert names == {"Приседания", "Отжимания", "Планка"}

    def test_list_exercises_includes_metric(self, auth_token):
        r = client.get("/exercises", headers=_auth(auth_token))
        plank = next(e for e in r.json() if e["name"] == "Планка")
        assert plank["metric"] == "seconds"


# ======================================================================
# /public
# ======================================================================
class TestPublicRouter:

    def test_public_challenge_view_no_auth_required(self, auth_token):
        cid = create_challenge(auth_token)
        code = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()["join_code"]
        r = client.get(f"/public/challenge/{code}")
        assert r.status_code == 200
        assert r.json()["id"] == cid

    def test_public_view_includes_leaderboard_but_no_personal_state(self, auth_token):
        cid = create_challenge(auth_token)
        code = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()["join_code"]
        data = client.get(f"/public/challenge/{code}").json()
        assert "leaderboard" in data
        assert "joined" not in data
        assert "my_status" not in data

    def test_public_view_unknown_code_404(self):
        r = client.get("/public/challenge/DOESNOTEXIST")
        assert r.status_code == 404

    def test_public_join_requires_auth(self):
        r = client.post("/public/challenge/SOMECODE/join")
        assert r.status_code == 401

    def test_public_join_with_valid_code(self, auth_token):
        owner = _register("publicjoinowner", "publicjoinowner@example.com")
        cid = create_challenge(owner)
        code = client.get(f"/challenges/{cid}", headers=_auth(owner)).json()["join_code"]

        r = client.post(f"/public/challenge/{code}/join", headers=_auth(auth_token))
        assert r.status_code == 201

    def test_public_join_invalid_code_404(self, auth_token):
        r = client.post("/public/challenge/DOESNOTEXIST/join", headers=_auth(auth_token))
        assert r.status_code == 404


# ======================================================================
# /admin
# ======================================================================
class TestAdminAuth:

    def test_login_not_configured_returns_500(self, monkeypatch):
        monkeypatch.setattr("app.service.adminService.ADMIN_PASSWORD_HASH", None)
        r = client.post("/admin/login", json={"password": "whatever"})
        assert r.status_code == 500

    def test_login_wrong_password_401(self, monkeypatch):
        monkeypatch.setattr("app.service.adminService.ADMIN_PASSWORD_HASH", ADMIN_PASSWORD_HASH)
        r = client.post("/admin/login", json={"password": "definitely-wrong"})
        assert r.status_code == 401

    def test_login_correct_password_returns_token(self, monkeypatch):
        monkeypatch.setattr("app.service.adminService.ADMIN_PASSWORD_HASH", ADMIN_PASSWORD_HASH)
        r = client.post("/admin/login", json={"password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_stats_requires_admin_token(self):
        r = client.get("/admin/stats")
        assert r.status_code == 401

    def test_regular_user_token_rejected_by_admin_stats(self, auth_token):
        r = client.get("/admin/stats", headers=_auth(auth_token))
        assert r.status_code == 401

    def test_admin_token_grants_stats_access(self, monkeypatch, auth_token):
        monkeypatch.setattr("app.service.adminService.ADMIN_PASSWORD_HASH", ADMIN_PASSWORD_HASH)
        token = client.post("/admin/login", json={"password": ADMIN_PASSWORD}).json()["token"]
        r = client.get("/admin/stats", headers=_auth(token))
        assert r.status_code == 200
        body = r.json()
        assert "total_users" in body
        assert "challenges" in body


class TestAdminStatsAccuracy:

    def test_total_users_reflects_registrations(self, monkeypatch):
        monkeypatch.setattr("app.service.adminService.ADMIN_PASSWORD_HASH", ADMIN_PASSWORD_HASH)
        _register("statsuser1", "statsuser1@example.com")
        _register("statsuser2", "statsuser2@example.com")
        token = client.post("/admin/login", json={"password": ADMIN_PASSWORD}).json()["token"]
        stats = client.get("/admin/stats", headers=_auth(token)).json()
        assert stats["total_users"] == 2

    def test_challenge_breakdown_counts_daily_and_weekly_separately(self, monkeypatch, auth_token):
        monkeypatch.setattr("app.service.adminService.ADMIN_PASSWORD_HASH", ADMIN_PASSWORD_HASH)
        create_challenge(auth_token, public=False)  # daily
        weekly_payload = {
            "name": "Weekly stats challenge", "schedule_type": "weekly",
            "schedule_days": [1, 3, 5], "start_date": date.today().isoformat(),
            "exercises": [{"exercise_id": 2, "goal": 10}],
        }
        client.post("/challenges", json=weekly_payload, headers=_auth(auth_token))

        token = client.post("/admin/login", json={"password": ADMIN_PASSWORD}).json()["token"]
        stats = client.get("/admin/stats", headers=_auth(token)).json()
        by_schedule = {s["label"]: s["value"] for s in stats["challenges"]["by_schedule"]}
        assert by_schedule["Ежедневные"] == 1
        assert by_schedule["Еженедельные"] == 1