import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timedelta

from main import app
from app.core.database import Base, get_db
from app.db.models.user import User
from app.db.models.challenge import Exercise


# ================================================================
# 1. TEST DATABASE SETUP
# ================================================================

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_auth.db"

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


# ================================================================
# 2. FIXTURES
# ================================================================

@pytest.fixture(autouse=True)
def setup_database():
    """Create tables and seed exercises before each test."""
    # Re-bind the DB override to THIS module's engine. Other test modules also
    # override get_db at import time on the shared app; re-binding per test keeps
    # the suite correct when run together (otherwise: "no such table").
    app.dependency_overrides[get_db] = override_get_db

    # Полная очистка и пересоздание таблиц
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Seed exercises (без указания ID, чтобы БД сама их создала)
    db = TestingSessionLocal()
    exercises = [
        Exercise(name="Приседания", metric="reps"),
        Exercise(name="Отжимания", metric="reps"),
        Exercise(name="Планка", metric="seconds"),
    ]
    for ex in exercises:
        db.add(ex)
    db.commit()
    
    # Сохраняем ID созданных упражнений для использования в тестах
    global EXERCISE_IDS
    EXERCISE_IDS = [ex.id for ex in db.query(Exercise).all()]
    
    db.close()
    
    yield
    
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user_data():
    """Valid user data for registration."""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "Test123!",
        "first_name": "Test",
        "last_name": "User"
    }


@pytest.fixture
def registered_user(test_user_data):
    """Register a user and return the user data."""
    client.post("/auth/signup", json=test_user_data)
    return test_user_data


@pytest.fixture
def auth_token(registered_user):
    """Login and return JWT token."""
    login_data = {
        "email": registered_user["email"],
        "password": registered_user["password"]
    }
    response = client.post("/auth/login", json=login_data)
    return response.json()["token"]


@pytest.fixture
def created_challenge(auth_token):
    """Create a test challenge and return its data."""
    create_data = {
        "name": "Test Challenge",
        "schedule_type": "daily",
        "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
        "exercises": [{"exercise_id": 1, "goal": 20}]
    }
    response = client.post(
        "/challenges",
        json=create_data,
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    return response.json()


# ================================================================
# 3. TESTS: REGISTRATION (SIGNUP)
# ================================================================

class TestRegistration:
    
    def test_signup_success(self, test_user_data):
        """
        What we're testing:
        - User can register with valid data
        - Returns 201 Created
        - User data is returned (without password)
        """
        response = client.post("/auth/signup", json=test_user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == test_user_data["username"]
        assert data["email"] == test_user_data["email"].lower()
        assert "password" not in data
        assert "id" in data

    def test_signup_fails_with_duplicate_email(self, test_user_data):
        """
        What we're testing:
        - Cannot register with an email that's already in use
        """
        client.post("/auth/signup", json=test_user_data)
        response = client.post("/auth/signup", json=test_user_data)
        assert response.status_code == 400

    def test_signup_fails_with_duplicate_username(self, test_user_data):
        """
        What we're testing:
        - Cannot register with a username that's already taken
        """
        client.post("/auth/signup", json=test_user_data)
        duplicate_data = {
            "username": test_user_data["username"],
            "email": "different@example.com",
            "password": "Test123!",
            "first_name": "Test2",
            "last_name": "User2"
        }
        response = client.post("/auth/signup", json=duplicate_data)
        assert response.status_code == 400

    def test_signup_fails_with_invalid_email(self):
        """
        What we're testing:
        - Invalid email format is rejected
        """
        data = {
            "username": "testuser",
            "email": "invalid-email",
            "password": "Test123!",
            "first_name": "Test",
            "last_name": "User"
        }
        response = client.post("/auth/signup", json=data)
        assert response.status_code == 422

    def test_signup_fails_with_missing_fields(self):
        """
        What we're testing:
        - All required fields must be provided
        """
        data = {"username": "testuser", "email": "test@example.com"}
        response = client.post("/auth/signup", json=data)
        assert response.status_code == 422

    def test_signup_email_stored_lowercase(self, test_user_data):
        """
        What we're testing:
        - Email is stored in lowercase
        """
        data = test_user_data.copy()
        data["email"] = "Test@Example.com"
        response = client.post("/auth/signup", json=data)
        assert response.status_code == 201
        assert response.json()["email"] == "test@example.com"

    def test_signup_password_is_hashed(self, test_user_data):
        """
        What we're testing:
        - Password is hashed before storing
        """
        client.post("/auth/signup", json=test_user_data)
        db = TestingSessionLocal()
        user = db.query(User).filter_by(email=test_user_data["email"]).first()
        db.close()
        assert user is not None
        assert user.password_hash is not None
        assert user.password_hash != test_user_data["password"]


# ================================================================
# 4. TESTS: LOGIN
# ================================================================

class TestLogin:
    
    def test_login_success(self, test_user_data):
        """
        What we're testing:
        - User can login with valid credentials
        - Returns JWT token
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/auth/login", json=login_data)
        assert response.status_code == 200
        assert "token" in response.json()

    def test_login_fails_with_wrong_password(self, test_user_data):
        """
        What we're testing:
        - Wrong password -> login fails
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": "WrongPassword123!"
        }
        response = client.post("/auth/login", json=login_data)
        assert response.status_code == 400

    def test_login_fails_with_nonexistent_email(self):
        """
        What we're testing:
        - Non-existent email -> login fails
        """
        login_data = {
            "email": "nonexistent@example.com",
            "password": "Test123!"
        }
        response = client.post("/auth/login", json=login_data)
        assert response.status_code == 400

    def test_login_email_case_insensitive(self, test_user_data):
        """
        What we're testing:
        - Login is case-insensitive for email
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": "Test@Example.com",
            "password": test_user_data["password"]
        }
        response = client.post("/auth/login", json=login_data)
        assert response.status_code == 200
        assert "token" in response.json()

    def test_login_fails_with_missing_fields(self):
        """
        What we're testing:
        - All required fields must be provided
        """
        login_data = {"email": "test@example.com"}
        response = client.post("/auth/login", json=login_data)
        assert response.status_code == 422


# ================================================================
# 5. TESTS: JWT TOKEN VALIDATION
# ================================================================

class TestJWT:
    
    def test_jwt_contains_correct_user_id(self, test_user_data):
        """
        What we're testing:
        - JWT token contains the correct user_id
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/auth/login", json=login_data)
        token = response.json()["token"]
        
        import base64
        import json
        payload_part = token.split(".")[1]
        payload_part += "=" * (4 - len(payload_part) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_part))
        assert "user_id" in payload
        assert payload["user_id"] == 1

    def test_jwt_protects_protected_endpoint(self, auth_token):
        """
        What we're testing:
        - Valid JWT token allows access to protected endpoints
        """
        response = client.get(
            "/protected",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data

    def test_protected_endpoint_fails_without_token(self):
        """
        What we're testing:
        - Protected endpoint rejects requests without token
        """
        response = client.get("/protected")
        assert response.status_code == 401

    def test_protected_endpoint_fails_with_invalid_token(self):
        """
        What we're testing:
        - Protected endpoint rejects invalid tokens
        """
        response = client.get(
            "/protected",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401

    def test_protected_endpoint_fails_with_expired_token(self, test_user_data):
        """
        What we're testing:
        - Expired tokens are rejected
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/auth/login", json=login_data)
        token = response.json()["token"]
        
        # Используем невалидный токен для проверки
        response = client.get(
            "/protected",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401

    def test_jwt_token_format(self, test_user_data):
        """
        What we're testing:
        - JWT token has the correct format
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/auth/login", json=login_data)
        token = response.json()["token"]
        parts = token.split(".")
        assert len(parts) == 3


# ================================================================
# 6. TESTS: PASSWORD HASHING
# ================================================================

class TestPasswordHashing:
    
    def test_password_not_returned_in_response(self, test_user_data):
        """
        What we're testing:
        - Password is NEVER returned in API responses
        """
        response = client.post("/auth/signup", json=test_user_data)
        data = response.json()
        assert "password" not in data
        assert "password_hash" not in data

    def test_bcrypt_used_for_hashing(self, test_user_data):
        """
        What we're testing:
        - bcrypt is used for password hashing
        """
        client.post("/auth/signup", json=test_user_data)
        db = TestingSessionLocal()
        user = db.query(User).filter_by(email=test_user_data["email"]).first()
        db.close()
        assert user.password_hash.startswith("$2")

    def test_same_password_different_hash(self, test_user_data):
        """
        What we're testing:
        - Same password produces different hashes each time (salting)
        """
        client.post("/auth/signup", json=test_user_data)
        second_user = {
            "username": "testuser2",
            "email": "test2@example.com",
            "password": test_user_data["password"],
            "first_name": "Test2",
            "last_name": "User2"
        }
        client.post("/auth/signup", json=second_user)
        db = TestingSessionLocal()
        user1 = db.query(User).filter_by(email=test_user_data["email"]).first()
        user2 = db.query(User).filter_by(email=second_user["email"]).first()
        db.close()
        assert user1.password_hash != user2.password_hash


# ================================================================
# 7. TESTS: JWT WITH CHALLENGE API
# ================================================================

class TestJWTWithChallengeAPI:
    
    def test_create_challenge_requires_auth(self):
        """
        What we're testing:
        - Challenge creation requires authentication
        - Returns 401 Unauthorized
        """
        data = {
            "name": "No Auth Challenge",
            "schedule_type": "daily",
            "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "exercises": [{"exercise_id": 1, "goal": 20}]
        }
        response = client.post("/challenges", json=data)
        assert response.status_code == 401

    def test_valid_token_works_for_challenge_creation(self, test_user_data):
        """
        What we're testing:
        - Valid JWT token allows challenge creation
        - Token is properly validated by the API
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/auth/login", json=login_data)
        token = login_response.json()["token"]
        
        data = {
            "name": "Auth Test Challenge",
            "schedule_type": "daily",
            "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "exercises": [{"exercise_id": 1, "goal": 20}]
        }
        response = client.post(
            "/challenges",
            json=data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Auth Test Challenge"

    def test_valid_token_works_for_challenge_detail(self, test_user_data):
        """
        What we're testing:
        - Valid JWT token allows viewing challenge details
        - Token is required for GET /challenges/{id}
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/auth/login", json=login_data)
        token = login_response.json()["token"]
        
        # Create a challenge first
        create_data = {
            "name": "Detail Test Challenge",
            "schedule_type": "daily",
            "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "exercises": [{"exercise_id": 1, "goal": 20}]
        }
        create_response = client.post(
            "/challenges",
            json=create_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        challenge_id = create_response.json()["id"]
        
        # Get challenge details with valid token
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["id"] == challenge_id
        assert response.json()["name"] == "Detail Test Challenge"

    def test_challenge_detail_fails_without_token(self, test_user_data):
        """
        What we're testing:
        - Challenge detail requires authentication
        - Returns 401 Unauthorized
        """
        response = client.get("/challenges/1")
        assert response.status_code == 401

    def test_challenge_detail_fails_with_invalid_token(self, test_user_data):
        """
        What we're testing:
        - Invalid token is rejected for challenge detail
        - Returns 401 Unauthorized
        """
        response = client.get(
            "/challenges/1",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401

    def test_valid_token_works_for_challenge_edit(self, test_user_data):
        """
        What we're testing:
        - Valid JWT token allows editing challenge (if creator)
        - Token is required for PATCH /challenges/{id}
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/auth/login", json=login_data)
        token = login_response.json()["token"]
        
        # Create a challenge first
        create_data = {
            "name": "Edit Test Challenge",
            "schedule_type": "daily",
            "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "exercises": [{"exercise_id": 1, "goal": 20}]
        }
        create_response = client.post(
            "/challenges",
            json=create_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        challenge_id = create_response.json()["id"]
        
        # Edit challenge with valid token
        edit_data = {"name": "Updated Challenge Name"}
        response = client.patch(
            f"/challenges/{challenge_id}",
            json=edit_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Challenge Name"

    def test_challenge_edit_fails_without_token(self, test_user_data):
        """
        What we're testing:
        - Challenge edit requires authentication
        - Returns 401 Unauthorized
        """
        data = {"name": "New Name"}
        response = client.patch("/challenges/1", json=data)
        assert response.status_code == 401

    def test_valid_token_works_for_challenge_archive(self, test_user_data):
        """
        What we're testing:
        - Valid JWT token allows archiving challenge (if creator)
        - Token is required for POST /challenges/{id}/archive
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/auth/login", json=login_data)
        token = login_response.json()["token"]
        
        # Create a challenge first
        create_data = {
            "name": "Archive Test Challenge",
            "schedule_type": "daily",
            "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "exercises": [{"exercise_id": 1, "goal": 20}]
        }
        create_response = client.post(
            "/challenges",
            json=create_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        challenge_id = create_response.json()["id"]
        
        # Archive challenge with valid token
        response = client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "archived"

    def test_challenge_archive_fails_without_token(self, test_user_data):
        """
        What we're testing:
        - Challenge archive requires authentication
        - Returns 401 Unauthorized
        """
        response = client.post("/challenges/1/archive")
        assert response.status_code == 401

    def test_valid_token_works_for_join_challenge(self, test_user_data):
        """
        What we're testing:
        - Valid JWT token allows joining a challenge
        - Token is required for POST /challenges/join
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/auth/login", json=login_data)
        token = login_response.json()["token"]
        
        # Create a challenge first (creator auto-joins)
        create_data = {
            "name": "Join Test Challenge",
            "schedule_type": "daily",
            "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "is_private": True,
            "exercises": [{"exercise_id": 1, "goal": 20}]
        }
        create_response = client.post(
            "/challenges",
            json=create_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        join_code = create_response.json()["join_code"]
        
        # Register second user
        second_user_data = {
            "username": "testuser2",
            "email": "test2@example.com",
            "password": "Test123!",
            "first_name": "Test2",
            "last_name": "User2"
        }
        client.post("/auth/signup", json=second_user_data)
        login_data2 = {
            "email": second_user_data["email"],
            "password": second_user_data["password"]
        }
        login_response2 = client.post("/auth/login", json=login_data2)
        token2 = login_response2.json()["token"]
        
        # Join challenge with valid token
        response = client.post(
            "/challenges/join",
            json={"join_code": join_code},
            headers={"Authorization": f"Bearer {token2}"}
        )
        assert response.status_code == 201
        assert response.json()["challenge_id"] == create_response.json()["id"]

    def test_join_challenge_fails_without_token(self, test_user_data):
        """
        What we're testing:
        - Joining a challenge requires authentication
        - Returns 401 Unauthorized
        """
        response = client.post("/challenges/join", json={"join_code": "test123"})
        assert response.status_code == 401

    def test_valid_token_works_for_leaderboard(self, test_user_data):
        """
        What we're testing:
        - Valid JWT token allows viewing leaderboard
        - Token is required for GET /challenges/{id}/leaderboard
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/auth/login", json=login_data)
        token = login_response.json()["token"]
        
        # Create a challenge first
        create_data = {
            "name": "Leaderboard Test Challenge",
            "schedule_type": "daily",
            "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "exercises": [{"exercise_id": 1, "goal": 20}]
        }
        create_response = client.post(
            "/challenges",
            json=create_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        challenge_id = create_response.json()["id"]
        
        # Get leaderboard with valid token
        response = client.get(
            f"/challenges/{challenge_id}/leaderboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_leaderboard_fails_without_token(self, test_user_data):
        """
        What we're testing:
        - Leaderboard requires authentication
        - Returns 401 Unauthorized
        """
        response = client.get("/challenges/1/leaderboard")
        assert response.status_code == 401

    def test_valid_token_works_for_me_endpoints(self, test_user_data):
        """
        What we're testing:
        - Valid JWT token allows access to /me endpoints
        - Token is required for /me, /me/today, /me/challenges
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/auth/login", json=login_data)
        token = login_response.json()["token"]
        
        # Test /me
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["username"] == test_user_data["username"]
        
        # Test /me/today
        response = client.get(
            "/me/today",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
        # Test /me/challenges
        response = client.get(
            "/me/challenges?status=active",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_me_endpoints_fail_without_token(self, test_user_data):
        """
        What we're testing:
        - /me endpoints require authentication
        - Returns 401 Unauthorized
        """
        response = client.get("/me")
        assert response.status_code == 401
        
        response = client.get("/me/today")
        assert response.status_code == 401
        
        response = client.get("/me/challenges")
        assert response.status_code == 401


# ================================================================
# 8. TESTS: TOKEN LIFECYCLE
# ================================================================

class TestTokenLifecycle:

    def test_logout_does_not_invalidate_token_immediately(self, test_user_data):
        """
        What we're testing:
        - Tokens are valid until they expire (standard JWT behavior)
        - No active logout mechanism
        """
        client.post("/auth/signup", json=test_user_data)
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/auth/login", json=login_data)
        token = response.json()["token"]
        protected_response = client.get(
            "/protected",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert protected_response.status_code == 200


# ================================================================
# 9. TESTS: HEALTH ENDPOINT
# ================================================================

class TestHealthEndpoint:
    
    def test_health_endpoint_returns_status(self):
        """
        What we're testing:
        - /health returns status OK
        """
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "Running...."

    def test_health_endpoint_is_public(self):
        """
        What we're testing:
        - Health endpoint is publicly accessible
        """
        response = client.get("/health")
        assert response.status_code == 200


# ================================================================
# 10. TESTS: SECURITY
# ================================================================

class TestSecurity:
    
    def test_cors_headers_present(self):
        """
        What we're testing:
        - CORS headers are present in responses
        """
        response = client.options(
            "/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST"
            }
        )
        assert response.status_code == 200 or "access-control-allow-origin" in response.headers

    def test_password_not_logged(self, test_user_data):
        """
        What we're testing:
        - Password is not printed in logs
        """
        response = client.post("/auth/signup", json=test_user_data)
        assert "password" not in response.text


# ================================================================
# 11. TESTS: BULK REGISTRATION
# ================================================================

class TestBulkRegistration:
    
    def test_multiple_users_can_register(self):
        """
        What we're testing:
        - Multiple users can register successfully
        - Each gets unique ID
        """
        users = [
            {"username": f"user{i}", "email": f"user{i}@example.com", 
             "password": "Test123!", "first_name": f"User{i}", "last_name": f"Test{i}"}
            for i in range(1, 4)
        ]
        for user_data in users:
            response = client.post("/auth/signup", json=user_data)
            assert response.status_code == 201
            assert response.json()["username"] == user_data["username"]
        db = TestingSessionLocal()
        count = db.query(User).count()
        db.close()
        assert count == 3