"""Tests for POST /auth/google — "Sign in with Google".

Google's token verification is monkeypatched: these tests cover OUR logic
(find by sub -> link by email -> create), not Google's crypto.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.user import User
from app.core.security import googleVerifier


# ================================================================
# TEST DATABASE SETUP (same pattern as the other test modules)
# ================================================================

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_google_auth.db"

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
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# ================================================================
# FAKE GOOGLE VERIFICATION
# ================================================================

def make_claims(sub="google-sub-1", email="ivan@gmail.com", verified=True,
                given_name="Ivan", family_name="Petrov"):
    return {
        "sub": sub,
        "email": email,
        "email_verified": verified,
        "given_name": given_name,
        "family_name": family_name,
    }


@pytest.fixture
def google_ok(monkeypatch):
    """Make token verification succeed and return controllable claims."""
    state = {"claims": make_claims()}
    monkeypatch.setattr(googleVerifier, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(
        googleVerifier.google_id_token, "verify_oauth2_token",
        lambda token, request, client_id: state["claims"],
    )
    return state


@pytest.fixture
def google_invalid(monkeypatch):
    """Make token verification fail the way google-auth does."""
    monkeypatch.setattr(googleVerifier, "GOOGLE_CLIENT_ID", "test-client-id")

    def boom(token, request, client_id):
        raise ValueError("Token expired")

    monkeypatch.setattr(googleVerifier.google_id_token, "verify_oauth2_token", boom)


def google_login(token="fake-google-id-token"):
    return client.post("/auth/google", json={"id_token": token})


def get_user_by_email(email):
    db = TestingSessionLocal()
    user = db.query(User).filter_by(email=email).first()
    db.close()
    return user


# ================================================================
# TESTS
# ================================================================

class TestGoogleAuthConfig:

    def test_returns_503_when_not_configured(self, monkeypatch):
        """Without GOOGLE_CLIENT_ID the endpoint refuses instead of 500ing."""
        monkeypatch.setattr(googleVerifier, "GOOGLE_CLIENT_ID", None)
        response = google_login()
        assert response.status_code == 503

    def test_invalid_token_rejected(self, google_invalid):
        response = google_login("garbage")
        assert response.status_code == 401

    def test_unverified_email_rejected(self, google_ok):
        google_ok["claims"] = make_claims(verified=False)
        response = google_login()
        assert response.status_code == 401
        assert get_user_by_email("ivan@gmail.com") is None

    def test_missing_id_token_field(self, google_ok):
        response = client.post("/auth/google", json={})
        assert response.status_code == 422


class TestGoogleSignup:
    """First-ever Google sign-in -> account is created."""

    def test_creates_account_and_returns_tokens(self, google_ok):
        response = google_login()
        assert response.status_code == 200
        data = response.json()
        assert data["token"]
        assert data["refresh_token"]

        # the access token actually works
        me = client.get("/me", headers={"Authorization": f"Bearer {data['token']}"})
        assert me.status_code == 200
        assert me.json()["email"] == "ivan@gmail.com"
        assert me.json()["first_name"] == "Ivan"
        assert me.json()["last_name"] == "Petrov"

    def test_username_derived_from_email(self, google_ok):
        google_login()
        user = get_user_by_email("ivan@gmail.com")
        assert user.username == "ivan"
        assert user.google_sub == "google-sub-1"

    def test_username_collision_gets_suffix(self, google_ok):
        client.post("/auth/signup", json={
            "username": "ivan", "email": "other@example.com",
            "password": "Test123!",
        })
        google_login()
        user = get_user_by_email("ivan@gmail.com")
        assert user.username == "ivan2"

    def test_placeholder_password_is_unusable(self, google_ok):
        """No password can log into a Google-created account."""
        google_login()
        user = get_user_by_email("ivan@gmail.com")
        assert user.password_hash.startswith("$2")  # bcrypt, not empty
        response = client.post("/auth/login", json={
            "email": "ivan@gmail.com", "password": "anything123",
        })
        assert response.status_code == 400

    def test_email_stored_lowercase(self, google_ok):
        google_ok["claims"] = make_claims(email="Ivan@Gmail.com")
        google_login()
        assert get_user_by_email("ivan@gmail.com") is not None

    def test_refresh_token_works(self, google_ok):
        data = google_login().json()
        response = client.post("/auth/refresh",
                               json={"refresh_token": data["refresh_token"]})
        assert response.status_code == 200
        assert response.json()["token"]


class TestGoogleRepeatLogin:
    """Second sign-in with the same Google account -> same user, no duplicates."""

    def test_no_duplicate_account(self, google_ok):
        google_login()
        response = google_login()
        assert response.status_code == 200
        db = TestingSessionLocal()
        count = db.query(User).count()
        db.close()
        assert count == 1

    def test_matches_by_sub_even_if_email_changed(self, google_ok):
        """Google sub is the stable id: changed Google email still logs into
        the same account (and must not create a new one)."""
        first = google_login().json()
        google_ok["claims"] = make_claims(email="renamed@gmail.com")
        second = google_login()
        assert second.status_code == 200
        me1 = client.get("/me", headers={"Authorization": f"Bearer {first['token']}"}).json()
        me2 = client.get("/me", headers={"Authorization": f"Bearer {second.json()['token']}"}).json()
        assert me1["id"] == me2["id"]


class TestGoogleLinkExistingAccount:
    """Google sign-in with the email of an existing password account -> link."""

    PASSWORD_USER = {
        "username": "oldschool",
        "email": "ivan@gmail.com",
        "password": "Classic123!",
    }

    def _signup_password_user(self):
        response = client.post("/auth/signup", json=self.PASSWORD_USER)
        assert response.status_code == 201

    def test_links_to_existing_account(self, google_ok):
        self._signup_password_user()
        response = google_login()
        assert response.status_code == 200

        user = get_user_by_email("ivan@gmail.com")
        assert user.username == "oldschool"      # same account, not a new one
        assert user.google_sub == "google-sub-1"

        me = client.get("/me", headers={
            "Authorization": f"Bearer {response.json()['token']}"})
        assert me.json()["username"] == "oldschool"

    def test_link_invalidates_old_password(self, google_ok):
        """Emails are never verified at signup, so linking resets the password
        (protects against pre-registered accounts on someone else's email)."""
        self._signup_password_user()
        google_login()
        response = client.post("/auth/login", json={
            "email": self.PASSWORD_USER["email"],
            "password": self.PASSWORD_USER["password"],
        })
        assert response.status_code == 400

    def test_user_can_set_new_password_after_link(self, google_ok):
        """PATCH /me lets a linked user regain password login."""
        self._signup_password_user()
        token = google_login().json()["token"]
        patch = client.patch("/me", json={
            "new_password": "BrandNew123", "confirm_password": "BrandNew123",
        }, headers={"Authorization": f"Bearer {token}"})
        assert patch.status_code == 200
        login = client.post("/auth/login", json={
            "email": "ivan@gmail.com", "password": "BrandNew123",
        })
        assert login.status_code == 200

    def test_link_is_case_insensitive_on_email(self, google_ok):
        self._signup_password_user()
        google_ok["claims"] = make_claims(email="IVAN@GMAIL.COM")
        response = google_login()
        assert response.status_code == 200
        db = TestingSessionLocal()
        count = db.query(User).count()
        db.close()
        assert count == 1
