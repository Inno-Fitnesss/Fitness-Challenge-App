"""GET /me/steps `connected` flag:

- false for a fresh user (no steps, no Withings link);
- true right after a Withings account is linked, even with zero step rows
  (regression: the widget kept showing "connect" after a successful link
  because `connected` only looked at steps_daily rows);
- true when step rows exist without a Withings link (mobile app path).
"""
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.steps import StepsDaily
from app.db.models.user import User
from app.db.models.withings import WithingsConnection


# ================================================================
# TEST DATABASE SETUP (same pattern as test_auth.py)
# ================================================================

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_steps_connected.db"

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

USER_EMAIL = "steps.user@example.com"
USER_PASSWORD = "StepsPass123!"


@pytest.fixture(autouse=True)
def setup_database():
    # Re-point the override on every test: other test modules assign their
    # own engine to the same app object when the whole suite runs.
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def auth_header():
    client.post("/auth/signup", json={
        "username": "stepsuser",
        "email": USER_EMAIL,
        "password": USER_PASSWORD,
        "terms_accepted": True, "privacy_accepted": True,
    })
    response = client.post("/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD,
    })
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def get_user_id() -> int:
    db = TestingSessionLocal()
    try:
        return db.query(User).filter(User.email == USER_EMAIL).one().id
    finally:
        db.close()


def test_fresh_user_is_not_connected(auth_header):
    response = client.get("/me/steps?days=7", headers=auth_header)
    assert response.status_code == 200
    body = response.json()
    assert body["connected"] is False
    assert body["days"] == []
    assert body["total_steps"] == 0


def test_withings_link_without_steps_counts_as_connected(auth_header):
    db = TestingSessionLocal()
    try:
        db.add(WithingsConnection(
            user_id=get_user_id(),
            withings_user_id="12345678",
            access_token="access",
            refresh_token="refresh",
            token_expires_at=datetime.utcnow() + timedelta(hours=3),
        ))
        db.commit()
    finally:
        db.close()

    response = client.get("/me/steps?days=7", headers=auth_header)
    assert response.status_code == 200
    body = response.json()
    assert body["connected"] is True
    assert body["days"] == []
    assert body["total_steps"] == 0


def test_step_rows_without_withings_count_as_connected(auth_header):
    db = TestingSessionLocal()
    try:
        db.add(StepsDaily(
            user_id=get_user_id(),
            date=date.today(),
            step_count=1234,
            source="mobile",
        ))
        db.commit()
    finally:
        db.close()

    response = client.get("/me/steps?days=7", headers=auth_header)
    assert response.status_code == 200
    body = response.json()
    assert body["connected"] is True
    assert body["total_steps"] == 1234


def test_last_synced_at_carries_its_timezone(auth_header):
    """`synced_at` is stored naive-but-UTC, and a zone-less ISO string is read
    by browsers as *local* time. Shipping it bare shifted both "обновлено N ч
    назад" and the stale-steps warning by the viewer's offset — three hours in
    Moscow, so the 5h warning fired after two.
    """
    db = TestingSessionLocal()
    try:
        db.add(StepsDaily(
            user_id=get_user_id(),
            date=date.today(),
            step_count=500,
            source="mobile",
        ))
        db.commit()
    finally:
        db.close()

    body = client.get("/me/steps?days=7", headers=auth_header).json()
    last_synced_at = body["last_synced_at"]
    assert last_synced_at is not None
    assert datetime.fromisoformat(last_synced_at).tzinfo is not None, last_synced_at


def test_dropped_link_is_visible_even_though_old_steps_remain(auth_header):
    """Swapping the Withings app invalidated every stored refresh token, so the
    links had to be dropped and re-made. But `connected` is sticky — one step
    row ever keeps it true — and the widget hangs its "connect" button off it,
    so a user whose link was dropped had no way back in. `withings_linked`
    reports the link itself, independently of leftover rows.
    """
    db = TestingSessionLocal()
    try:
        # Steps that arrived while the link was still alive; the link itself is
        # gone (deleted after the app swap), which is exactly the broken state.
        db.add(StepsDaily(
            user_id=get_user_id(), date=date.today(), step_count=4200, source="withings",
        ))
        db.commit()
    finally:
        db.close()

    body = client.get("/me/steps?days=7", headers=auth_header).json()
    assert body["connected"] is True, "старые записи шагов никуда не делись"
    assert body["withings_linked"] is False, "а вот привязки уже нет"
