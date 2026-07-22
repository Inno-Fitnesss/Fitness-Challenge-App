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
