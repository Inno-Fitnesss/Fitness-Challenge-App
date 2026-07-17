"""Tests for the email verification flow:
POST /auth/signup (code sent) + POST /auth/verify-email + POST /auth/resend-verification.

Verification is only enforced while SMTP is configured (Mailer.is_configured()),
so these tests monkeypatch it on. Without SMTP (the rest of the suite) signup
keeps auto-verifying accounts and login works as before.
"""
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

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_email_verification.db"

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

USER_EMAIL = "verify.me@example.com"
USER_PASSWORD = "StrongPass123!"
SIGNUP_BODY = {
    "username": "verifyuser",
    "email": USER_EMAIL,
    "password": USER_PASSWORD,
}


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
def sent_codes(monkeypatch):
    """Force 'SMTP configured' mode and capture every emailed code."""
    codes: list[tuple[str, str]] = []
    monkeypatch.setattr(Mailer, "is_configured", staticmethod(lambda: True))
    monkeypatch.setattr(
        Mailer, "send_verification_code",
        staticmethod(lambda to_email, code: codes.append((to_email, code))))
    monkeypatch.setattr(
        Mailer, "send_reset_code",
        staticmethod(lambda to_email, code: codes.append((to_email, code))))
    return codes


def last_code(codes):
    assert codes, "expected a verification email to have been sent"
    return codes[-1][1]


# ================================================================
# 3. TESTS
# ================================================================

class TestSignupWithVerification:
    def test_signup_creates_unverified_user_and_sends_code(self, sent_codes):
        response = client.post("/auth/signup", json=SIGNUP_BODY)
        assert response.status_code == 201
        assert response.json()["email_verified"] is False
        assert len(sent_codes) == 1
        assert sent_codes[0][0] == USER_EMAIL

    def test_login_blocked_until_verified(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        response = client.post("/auth/login", json={
            "email": USER_EMAIL, "password": USER_PASSWORD,
        })
        assert response.status_code == 403
        assert response.json()["detail"] == "Email not verified"

    def test_verify_with_correct_code_logs_in(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        response = client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": last_code(sent_codes),
        })
        assert response.status_code == 200
        assert "token" in response.json()

        # And a normal password login works from now on.
        response = client.post("/auth/login", json={
            "email": USER_EMAIL, "password": USER_PASSWORD,
        })
        assert response.status_code == 200

    def test_verify_with_wrong_code_fails(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        good = last_code(sent_codes)
        wrong = "000000" if good != "000000" else "111111"
        response = client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": wrong,
        })
        assert response.status_code == 400

        # The right code still works after one wrong attempt.
        response = client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": good,
        })
        assert response.status_code == 200

    def test_verify_attempts_are_limited(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        good = last_code(sent_codes)
        wrong = "000000" if good != "000000" else "111111"
        for _ in range(5):
            client.post("/auth/verify-email", json={
                "email": USER_EMAIL, "code": wrong,
            })
        # Even the correct code is rejected once the limit is reached.
        response = client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": good,
        })
        assert response.status_code == 400

    def test_expired_code_rejected(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        db = TestingSessionLocal()
        user = db.query(User).filter_by(email=USER_EMAIL).first()
        user.verify_code_expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.commit()
        db.close()

        response = client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": last_code(sent_codes),
        })
        assert response.status_code == 400


class TestResendVerification:
    def test_resend_issues_new_code(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        response = client.post("/auth/resend-verification", json={"email": USER_EMAIL})
        assert response.status_code == 200
        assert len(sent_codes) == 2

        # Only the latest code is valid.
        response = client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": sent_codes[-1][1],
        })
        assert response.status_code == 200

    def test_resend_does_not_reveal_registered_emails(self, sent_codes):
        response = client.post(
            "/auth/resend-verification", json={"email": "ghost@example.com"})
        assert response.status_code == 200
        assert len(sent_codes) == 0

    def test_resend_noop_for_verified_account(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": last_code(sent_codes),
        })
        before = len(sent_codes)
        response = client.post("/auth/resend-verification", json={"email": USER_EMAIL})
        assert response.status_code == 200
        assert len(sent_codes) == before


class TestUnverifiedReSignup:
    def test_re_signup_takes_over_unverified_email(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        # Same email, new username/password — the address was never confirmed.
        response = client.post("/auth/signup", json={
            "username": "verifyuser2",
            "email": USER_EMAIL,
            "password": "OtherPass456!",
        })
        assert response.status_code == 201
        assert len(sent_codes) == 2

        response = client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": sent_codes[-1][1],
        })
        assert response.status_code == 200

        response = client.post("/auth/login", json={
            "email": USER_EMAIL, "password": "OtherPass456!",
        })
        assert response.status_code == 200

    def test_signup_rejected_for_verified_email(self, sent_codes):
        client.post("/auth/signup", json=SIGNUP_BODY)
        client.post("/auth/verify-email", json={
            "email": USER_EMAIL, "code": last_code(sent_codes),
        })
        response = client.post("/auth/signup", json={
            "username": "verifyuser3",
            "email": USER_EMAIL,
            "password": "OtherPass456!",
        })
        assert response.status_code == 400
        assert response.json()["detail"] == "Please Login"


class TestDevFallbackWithoutSmtp:
    def test_signup_auto_verifies_when_smtp_not_configured(self):
        """Regression guard: without SMTP the old signup→login flow must work."""
        response = client.post("/auth/signup", json=SIGNUP_BODY)
        assert response.status_code == 201
        assert response.json()["email_verified"] is True

        response = client.post("/auth/login", json={
            "email": USER_EMAIL, "password": USER_PASSWORD,
        })
        assert response.status_code == 200
