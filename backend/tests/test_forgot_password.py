"""Tests for the "forgot password" flow:
POST /auth/forgot-password + POST /auth/reset-password.

Covers: no user enumeration, happy path, wrong/expired codes, attempt
limiting, one-time use, input validation, and the dev fallback where the
code is logged instead of emailed (empty SMTP credentials).
"""
import logging
import re
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.core.mailer import Mailer
from app.db.models.user import User


# ================================================================
# 1. TEST DATABASE SETUP (same pattern as test_auth.py)
# ================================================================

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_forgot_password.db"

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

USER_EMAIL = "reset.me@example.com"
USER_PASSWORD = "OldPass123!"
NEW_PASSWORD = "NewPass456!"


# ================================================================
# 2. FIXTURES
# ================================================================

@pytest.fixture(autouse=True)
def setup_database():
    """Fresh tables per test; re-bind get_db override (see test_auth.py)."""
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def registered_user():
    response = client.post("/auth/signup", json={
        "username": "resetuser",
        "email": USER_EMAIL,
        "password": USER_PASSWORD,
        "terms_accepted": True, "privacy_accepted": True,
    })
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def sent_codes(monkeypatch):
    """Capture reset codes instead of hitting SMTP / the dev logger."""
    codes: list[tuple[str, str]] = []
    monkeypatch.setattr(
        Mailer, "send_reset_code",
        staticmethod(lambda to_email, code: codes.append((to_email, code))),
    )
    return codes


def request_code(email: str = USER_EMAIL):
    return client.post("/auth/forgot-password", json={"email": email})


def reset_password(code: str, email: str = USER_EMAIL,
                   new_password: str = NEW_PASSWORD,
                   confirm_password: str = None):
    return client.post("/auth/reset-password", json={
        "email": email,
        "code": code,
        "new_password": new_password,
        "confirm_password": confirm_password if confirm_password is not None else new_password,
    })


# ================================================================
# 3. NO USER ENUMERATION
# ================================================================

class TestNoUserEnumeration:
    def test_same_response_for_known_and_unknown_email(self, registered_user, sent_codes):
        known = request_code(USER_EMAIL)
        unknown = request_code("nobody@example.com")
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()

    def test_no_code_issued_for_unknown_email(self, registered_user, sent_codes):
        request_code("nobody@example.com")
        assert sent_codes == []

    def test_reset_with_unknown_email_is_generic_400(self, sent_codes):
        response = reset_password("123456", email="nobody@example.com")
        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid or expired code"


# ================================================================
# 4. HAPPY PATH
# ================================================================

class TestHappyPath:
    def test_full_flow_resets_password(self, registered_user, sent_codes):
        assert request_code().status_code == 200
        (to_email, code), = sent_codes
        assert to_email == USER_EMAIL
        assert re.fullmatch(r"\d{6}", code)

        response = reset_password(code)
        assert response.status_code == 200

        # Old password no longer works, new one does.
        old = client.post("/auth/login", json={"email": USER_EMAIL,
                                               "password": USER_PASSWORD})
        assert old.status_code == 400
        new = client.post("/auth/login", json={"email": USER_EMAIL,
                                               "password": NEW_PASSWORD})
        assert new.status_code == 200
        assert "token" in new.json()

    def test_email_is_case_insensitive(self, registered_user, sent_codes):
        assert request_code(USER_EMAIL.upper()).status_code == 200
        (_, code), = sent_codes
        assert reset_password(code, email=USER_EMAIL.upper()).status_code == 200

    def test_code_is_stored_hashed_not_plaintext(self, registered_user, sent_codes):
        request_code()
        (_, code), = sent_codes
        db = TestingSessionLocal()
        user = db.query(User).filter_by(email=USER_EMAIL).first()
        assert user.reset_code_hash
        assert code not in user.reset_code_hash
        assert user.reset_code_expires_at is not None
        db.close()

    def test_new_request_overwrites_previous_code(self, registered_user, sent_codes):
        request_code()
        request_code()
        first_code, second_code = sent_codes[0][1], sent_codes[1][1]
        if first_code != second_code:
            assert reset_password(first_code).status_code == 400
        assert reset_password(second_code).status_code == 200


# ================================================================
# 5. WRONG / EXPIRED / REUSED CODES
# ================================================================

class TestCodeRejection:
    def test_wrong_code_is_rejected(self, registered_user, sent_codes):
        request_code()
        (_, code), = sent_codes
        wrong = "000000" if code != "000000" else "111111"
        response = reset_password(wrong)
        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid or expired code"
        # The correct code still works after one bad attempt.
        assert reset_password(code).status_code == 200

    def test_code_locked_after_max_attempts(self, registered_user, sent_codes):
        request_code()
        (_, code), = sent_codes
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            assert reset_password(wrong).status_code == 400
        # Even the correct code is now rejected.
        assert reset_password(code).status_code == 400

    def test_expired_code_is_rejected(self, registered_user, sent_codes):
        request_code()
        (_, code), = sent_codes
        db = TestingSessionLocal()
        user = db.query(User).filter_by(email=USER_EMAIL).first()
        user.reset_code_expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.commit()
        db.close()
        response = reset_password(code)
        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid or expired code"

    def test_code_is_single_use(self, registered_user, sent_codes):
        request_code()
        (_, code), = sent_codes
        assert reset_password(code).status_code == 200
        assert reset_password(code, new_password="ThirdPass789!").status_code == 400

    def test_reset_without_requesting_code(self, registered_user, sent_codes):
        response = reset_password("123456")
        assert response.status_code == 400


# ================================================================
# 6. INPUT VALIDATION
# ================================================================

class TestValidation:
    def test_non_digit_code_rejected(self, registered_user):
        assert reset_password("abcdef").status_code == 422

    def test_short_code_rejected(self, registered_user):
        assert reset_password("123").status_code == 422

    def test_short_new_password_rejected(self, registered_user):
        assert reset_password("123456", new_password="short").status_code == 422

    def test_mismatched_passwords_rejected(self, registered_user):
        assert reset_password("123456", confirm_password="Different1!").status_code == 422

    def test_invalid_email_rejected(self):
        assert request_code("not-an-email").status_code == 422


# ================================================================
# 7. DEV FALLBACK — EMPTY SMTP CREDS LOG THE CODE
# ================================================================

class TestDevFallback:
    def test_code_logged_when_smtp_not_configured(self, registered_user,
                                                  monkeypatch, caplog):
        # Simulate empty SMTP creds (the default for local dev).
        import app.core.mailer as mailer_module
        monkeypatch.setattr(mailer_module, "SMTP_USER", None)
        monkeypatch.setattr(mailer_module, "SMTP_PASSWORD", None)
        assert not Mailer.is_configured()

        with caplog.at_level(logging.WARNING, logger="app.core.mailer"):
            assert request_code().status_code == 200

        match = re.search(r"password reset code for {}: (\d{{6}})".format(
            re.escape(USER_EMAIL)), caplog.text)
        assert match, "reset code was not logged in dev mode"

        # The logged code actually works.
        assert reset_password(match.group(1)).status_code == 200
        login = client.post("/auth/login", json={"email": USER_EMAIL,
                                                 "password": NEW_PASSWORD})
        assert login.status_code == 200
