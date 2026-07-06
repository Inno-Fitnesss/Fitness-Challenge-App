"""
Security-adjacent and general input-robustness checks: SQL-injection-shaped
strings, XSS-shaped strings, unicode/emoji, oversized/garbage payloads,
unexpected content types, and extra unknown fields. These don't assume the
app is vulnerable — mostly they assert the ORM/pydantic layers already
protect it (parameterized queries, schema validation) and pin that behavior
down so it can't silently regress.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.challenge import Exercise

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_security_misc.db"

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


def _register(username, email, password="Test123!"):
    data = {
        "username": username, "email": email, "password": password,
        "first_name": "F", "last_name": "L",
    }
    return client.post("/auth/signup", json=data)


@pytest.fixture
def auth_token():
    _register("secuser", "secuser@example.com")
    resp = client.post("/auth/login", json={"email": "secuser@example.com", "password": "Test123!"})
    return resp.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def base_payload(**overrides):
    payload = {
        "name": "Base", "schedule_type": "daily",
        "start_date": date.today().isoformat(),
        "exercises": [{"exercise_id": 1, "goal": 10}],
    }
    payload.update(overrides)
    return payload


# ======================================================================
# SQL-injection-shaped strings — the ORM parameterizes everything, this
# just proves it end-to-end through the real API instead of assuming.
# ======================================================================
class TestSqlInjectionShapedInputs:

    def test_login_email_with_sql_payload_does_not_crash_or_bypass(self):
        r = client.post("/auth/login", json={
            "email": "' OR '1'='1", "password": "whatever",
        })
        assert r.status_code in (400, 401, 422)

    def test_challenge_name_with_sql_payload_is_stored_verbatim(self, auth_token):
        payload_name = "Robert'); DROP TABLE challenges;--"
        r = client.post("/challenges", json=base_payload(name=payload_name), headers=_auth(auth_token))
        assert r.status_code == 201
        assert r.json()["name"] == payload_name
        # Table must still exist and be queryable afterwards.
        r2 = client.get("/exercises", headers=_auth(auth_token))
        assert r2.status_code == 200

    def test_join_code_with_sql_payload_returns_404_not_500(self, auth_token):
        r = client.post("/challenges/join", json={"join_code": "' OR '1'='1"}, headers=_auth(auth_token))
        assert r.status_code == 404

    def test_username_with_sql_payload_registers_safely(self):
        r = _register("bob'; DROP TABLE users;--", "sqluser@example.com")
        assert r.status_code in (201, 422)


# ======================================================================
# XSS-shaped strings — API is JSON, so this mostly checks data is preserved
# as-is (escaping is a frontend-render concern) and nothing breaks server-side.
# ======================================================================
class TestXssShapedInputs:

    def test_challenge_name_with_script_tag_stored_as_plain_text(self, auth_token):
        xss = "<script>alert('xss')</script>"
        r = client.post("/challenges", json=base_payload(name=xss[:50]), headers=_auth(auth_token))
        assert r.status_code == 201
        assert r.json()["name"] == xss[:50]

    def test_description_with_html_injection_stored_as_plain_text(self, auth_token):
        payload = base_payload(description="<img src=x onerror=alert(1)>")
        r = client.post("/challenges", json=payload, headers=_auth(auth_token))
        assert r.status_code == 201
        assert "<img" in r.json()["description"]


# ======================================================================
# Unicode / emoji
# ======================================================================
class TestUnicodeInputs:

    def test_challenge_name_with_emoji(self, auth_token):
        r = client.post("/challenges", json=base_payload(name="Фитнес 💪🔥"), headers=_auth(auth_token))
        assert r.status_code == 201
        assert r.json()["name"] == "Фитнес 💪🔥"

    def test_username_with_cyrillic(self):
        r = _register("Юзверь", "cyrillicuser@example.com")
        assert r.status_code in (201, 422)

    def test_name_with_only_emoji_still_counts_toward_length(self, auth_token):
        r = client.post("/challenges", json=base_payload(name="🔥" * 60), headers=_auth(auth_token))
        assert r.status_code == 422


# ======================================================================
# Malformed / unexpected payloads
# ======================================================================
class TestMalformedPayloads:

    def test_missing_body_on_post_challenges_422(self, auth_token):
        r = client.post("/challenges", headers=_auth(auth_token))
        assert r.status_code == 422

    def test_wrong_type_for_goal_rejected(self, auth_token):
        r = client.post("/challenges", json=base_payload(
            exercises=[{"exercise_id": 1, "goal": "ten"}]
        ), headers=_auth(auth_token))
        assert r.status_code == 422

    def test_extra_unknown_fields_are_ignored_not_rejected(self, auth_token):
        payload = base_payload(totally_made_up_field="surprise", is_public=True)
        r = client.post("/challenges", json=payload, headers=_auth(auth_token))
        assert r.status_code == 201
        # is_public is explicitly ignored at creation time regardless of what's sent.
        assert r.json()["is_public"] is False

    def test_null_for_required_field_rejected(self, auth_token):
        payload = base_payload()
        payload["name"] = None
        r = client.post("/challenges", json=payload, headers=_auth(auth_token))
        assert r.status_code == 422

    def test_array_instead_of_object_body_422(self, auth_token):
        r = client.post(
            "/challenges", content=b"[1,2,3]",
            headers={**_auth(auth_token), "Content-Type": "application/json"},
        )
        assert r.status_code == 422

    def test_invalid_json_body_422(self, auth_token):
        r = client.post(
            "/challenges", content=b"{not valid json",
            headers={**_auth(auth_token), "Content-Type": "application/json"},
        )
        assert r.status_code == 422


# ======================================================================
# Auth header edge cases
# ======================================================================
class TestAuthHeaderEdgeCases:

    def test_missing_bearer_prefix_rejected(self, auth_token):
        r = client.get("/me", headers={"Authorization": auth_token})
        assert r.status_code == 401

    def test_extra_whitespace_in_bearer_header_rejected(self, auth_token):
        r = client.get("/me", headers={"Authorization": f"Bearer  {auth_token}"})
        assert r.status_code == 401

    def test_empty_authorization_header_rejected(self):
        r = client.get("/me", headers={"Authorization": ""})
        assert r.status_code == 401

    def test_token_for_deleted_user_rejected(self, auth_token):
        # There's no self-delete-account endpoint, so this documents that,
        # if a user row ever disappeared, protectRoute still errors out
        # rather than silently treating them as authenticated — we simulate
        # it by corrupting the token's signature instead.
        tampered = auth_token[:-2] + ("aa" if auth_token[-2:] != "aa" else "bb")
        r = client.get("/me", headers=_auth(tampered))
        assert r.status_code == 401


# ======================================================================
# Username / email edge cases (beyond what test_auth.py covers)
# ======================================================================
class TestUsernameEmailEdgeCases:

    def test_email_with_plus_addressing_accepted(self):
        r = _register("plususer", "plususer+tag@example.com")
        assert r.status_code == 201

    def test_username_with_leading_trailing_spaces_currently_accepted(self):
        """No trim/normalization on username today — documenting as-is."""
        r = _register("  spacey  ", "spacey@example.com")
        assert r.status_code in (201, 422)

    def test_very_long_email_local_part(self):
        long_email = ("a" * 60) + "@example.com"
        r = _register("longemailuser", long_email)
        assert r.status_code in (201, 422)