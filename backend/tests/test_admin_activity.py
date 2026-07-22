"""Tests for the admin activity metrics (DAU/WAU/MAU + new users today):
users.last_seen_at touched by authenticated requests, and the `activity`
block of GET /admin/stats.
"""
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.core.security.hashHelper import HashHelper
from app.db.models.user import User

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_admin_activity.db"

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
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def admin_token(monkeypatch):
    monkeypatch.setattr("app.service.adminService.ADMIN_PASSWORD_HASH", ADMIN_PASSWORD_HASH)
    return client.post("/admin/login", json={"password": ADMIN_PASSWORD}).json()["token"]


def _register(username, email):
    client.post("/auth/signup", json={
        "username": username, "email": email, "password": "Test123!",
        "terms_accepted": True, "privacy_accepted": True,
    })
    resp = client.post("/auth/login", json={"email": email, "password": "Test123!"})
    return resp.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _set_last_seen(email, value):
    db = TestingSessionLocal()
    db.query(User).filter_by(email=email).update({"last_seen_at": value})
    db.commit()
    db.close()


def _get_user_field(email, field):
    db = TestingSessionLocal()
    value = getattr(db.query(User).filter_by(email=email).first(), field)
    db.close()
    return value


def _stats(admin_token):
    resp = client.get("/admin/stats", headers=_auth(admin_token))
    assert resp.status_code == 200
    return resp.json()["activity"]


class TestLastSeenTracking:

    def test_authenticated_request_sets_last_seen(self):
        token = _register("seenuser", "seen@example.com")
        assert _get_user_field("seen@example.com", "last_seen_at") is None

        client.get("/me", headers=_auth(token))
        seen = _get_user_field("seen@example.com", "last_seen_at")
        assert seen is not None
        assert datetime.utcnow() - seen < timedelta(minutes=1)

    def test_recent_last_seen_not_rewritten(self):
        """Throttling: a request within the refresh window keeps the old mark."""
        token = _register("seenuser", "seen@example.com")
        recent = datetime.utcnow() - timedelta(minutes=5)
        _set_last_seen("seen@example.com", recent)

        client.get("/me", headers=_auth(token))
        assert _get_user_field("seen@example.com", "last_seen_at") == recent

    def test_stale_last_seen_is_refreshed(self):
        token = _register("seenuser", "seen@example.com")
        stale = datetime.utcnow() - timedelta(hours=2)
        _set_last_seen("seen@example.com", stale)

        client.get("/me", headers=_auth(token))
        assert _get_user_field("seen@example.com", "last_seen_at") > stale


class TestActivityStats:

    def test_active_counts_by_window(self, admin_token):
        for name in ("act1", "act2", "act3", "act4"):
            _register(name, f"{name}@example.com")

        now = datetime.utcnow()
        _set_last_seen("act1@example.com", now - timedelta(hours=1))    # today
        _set_last_seen("act2@example.com", now - timedelta(days=3))     # this week
        _set_last_seen("act3@example.com", now - timedelta(days=15))    # this month
        # act4 never seen -> counted nowhere

        activity = _stats(admin_token)
        assert activity["active_today"] == 1
        assert activity["active_week"] == 2
        assert activity["active_month"] == 3

    def test_users_outside_month_window_not_counted(self, admin_token):
        _register("olduser", "old@example.com")
        _set_last_seen("old@example.com", datetime.utcnow() - timedelta(days=45))

        activity = _stats(admin_token)
        assert activity["active_today"] == 0
        assert activity["active_week"] == 0
        assert activity["active_month"] == 0

    def test_new_today_counts_only_todays_registrations(self, admin_token):
        _register("newuser", "new@example.com")
        _register("yesterday", "yesterday@example.com")

        db = TestingSessionLocal()
        db.query(User).filter_by(email="yesterday@example.com").update(
            {"created_at": datetime.utcnow() - timedelta(days=2)})
        db.commit()
        db.close()

        activity = _stats(admin_token)
        assert activity["new_today"] == 1

    def test_me_request_makes_user_active_today(self, admin_token):
        token = _register("liveuser", "live@example.com")
        client.get("/me", headers=_auth(token))

        activity = _stats(admin_token)
        assert activity["active_today"] == 1
        assert activity["new_today"] == 1
