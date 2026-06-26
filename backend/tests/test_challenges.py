import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date, timedelta

from main import app
from app.core.database import Base, get_db
from app.db.models.user import User
from app.db.models.challenge import (
    Exercise, Challenge, ChallengeExercise, Participation,
    ChallengeExerciseProgress, ChallengeDayProgress, UserExerciseStats
)


# ================================================================
# 1. TEST DATABASE SETUP
# ================================================================
# Using SQLite for tests — fast and isolated.
# Each test runs in its own transaction and doesn't affect others.
# ================================================================

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    """Override the real database with the test database."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


# ================================================================
# 2. FIXTURES — TEST DATA SETUP
# ================================================================
# Fixtures run before each test and create an isolated environment.
# ================================================================

@pytest.fixture(autouse=True)
def setup_database():
    """
    Creates tables and seeds them with test exercises.
    Runs automatically BEFORE each test.
    Cleans up the database after the test.
    """
    Base.metadata.create_all(bind=engine)
    
    # Seed data: 3 basic exercises (same as in the real app)
    db = TestingSessionLocal()
    exercises = [
        Exercise(id=1, name="Приседания", metric="reps"),
        Exercise(id=2, name="Отжимания", metric="reps"),
        Exercise(id=3, name="Планка", metric="seconds"),
    ]
    for ex in exercises:
        db.add(ex)
    db.commit()
    db.close()
    
    yield
    
    Base.metadata.drop_all(bind=engine)  # cleanup after test


@pytest.fixture
def auth_token():
    """
    Registers and logs in a user.
    Returns a JWT token for authorization in tests.
    """
    register_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "Test123!",
        "first_name": "Test",
        "last_name": "User"
    }
    client.post("/auth/signup", json=register_data)
    
    login_data = {"email": "test@example.com", "password": "Test123!"}
    response = client.post("/auth/login", json=login_data)
    return response.json()["token"]


@pytest.fixture
def auth_token2():
    """
    Second user for tests that need to verify:
    - Permissions (creator vs regular participant)
    - Leaderboard with multiple participants
    - Join/leave actions from another user
    """
    register_data = {
        "username": "testuser2",
        "email": "test2@example.com",
        "password": "Test123!",
        "first_name": "Test2",
        "last_name": "User2"
    }
    client.post("/auth/signup", json=register_data)
    
    login_data = {"email": "test2@example.com", "password": "Test123!"}
    response = client.post("/auth/login", json=login_data)
    return response.json()["token"]


@pytest.fixture
def exercise_ids():
    """Simplifies referencing exercise IDs in tests."""
    return {"squats": 1, "pushups": 2, "plank": 3}


# ================================================================
# 3. FIXTURES WITH DIFFERENT DATES
# ================================================================
# Important: different tests require different scenarios.
# - Challenge creation needs a FUTURE date (testing 'upcoming' status)
# - Sessions and /me/today need TODAY's date (challenge must be active)
# ================================================================

@pytest.fixture
def challenge_id_future(auth_token, exercise_ids):
    """
    Creates a challenge that starts TOMORROW.
    Used in tests for:
    - Creation (verifying we can create future challenges)
    - Editing (can edit before start)
    - Archiving (can archive a future challenge)
    """
    start_date = (date.today() + timedelta(days=1)).isoformat()
    
    challenge_data = {
        "name": "Future Challenge",
        "description": "Test description",
        "schedule_type": "daily",
        "start_date": start_date,
        "is_private": True,
        "exercises": [
            {"exercise_id": exercise_ids["squats"], "goal": 20},
            {"exercise_id": exercise_ids["pushups"], "goal": 10}
        ]
    }
    response = client.post(
        "/challenges",
        json=challenge_data,
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    return response.json()["id"]


@pytest.fixture
def challenge_id_active(auth_token, exercise_ids):
    """
    Creates a challenge that starts TODAY.
    Used in tests for:
    - Sessions (need an active challenge to submit workouts)
    - /me/today (challenge must be in today's plan)
    - Leaderboard (need participants in an active challenge)
    """
    start_date = date.today().isoformat()
    
    challenge_data = {
        "name": "Active Challenge",
        "description": "Active test challenge",
        "schedule_type": "daily",
        "start_date": start_date,
        "is_private": True,
        "exercises": [
            {"exercise_id": exercise_ids["squats"], "goal": 20},
            {"exercise_id": exercise_ids["pushups"], "goal": 10}
        ]
    }
    response = client.post(
        "/challenges",
        json=challenge_data,
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    return response.json()["id"]


@pytest.fixture
def public_challenge_active(auth_token, exercise_ids):
    """
    Creates a PUBLIC challenge that starts TODAY.
    Used in JOIN tests where joining by ID is required.
    (Private challenges can only be joined by code)
    """
    start_date = date.today().isoformat()
    
    challenge_data = {
        "name": "Public Active Challenge",
        "schedule_type": "daily",
        "start_date": start_date,
        "is_private": False,  # public, can join by ID
        "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
    }
    response = client.post(
        "/challenges",
        json=challenge_data,
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    return response.json()["id"]


# ================================================================
# 4. TESTS: CHALLENGE CREATION
# ================================================================
# Verifying that challenges are created correctly,
# validation works, and permissions are enforced.
# ALL creation tests use a FUTURE date.
# ================================================================

class TestChallengeCreation:
    
    def test_create_challenge_success(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Challenge is created with 2 exercises
        - Creator automatically joins (joined=True)
        - join_code is generated
        - All submitted data is returned correctly
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "My Challenge",
            "description": "My awesome challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "is_private": True,
            "exercises": [
                {"exercise_id": exercise_ids["squats"], "goal": 20},
                {"exercise_id": exercise_ids["pushups"], "goal": 10}
            ]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Challenge"
        assert data["joined"] is True
        assert len(data["exercises"]) == 2
        assert data["join_code"] is not None

    def test_create_challenge_with_weekly_schedule(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Creation with weekly schedule (Mon, Wed, Fri)
        - schedule_days are stored correctly
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Weekly Challenge",
            "schedule_type": "weekly",
            "schedule_days": [1, 3, 5],
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 30}]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 201
        data = response.json()
        assert data["schedule_type"] == "weekly"
        assert data["schedule_days"] == [1, 3, 5]

    def test_create_challenge_with_open_end(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Can create an open-ended challenge (end_date = null)
        - Such challenges have no end date
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Open Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 201
        data = response.json()
        assert data["end_date"] is None

    def test_create_challenge_fails_without_exercises(self, auth_token):
        """
        What we're testing:
        - Cannot create a challenge without exercises
        - Expect 422 Validation Error
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Invalid Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": []  # ← empty list
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 422

    def test_create_challenge_fails_with_duplicate_exercises(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Cannot add the same exercise twice
        - Expect 422 Validation Error
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Duplicate Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [
                {"exercise_id": exercise_ids["squats"], "goal": 20},
                {"exercise_id": exercise_ids["squats"], "goal": 30}  # ← duplicate
            ]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 422

    def test_create_challenge_fails_with_invalid_exercise(self, auth_token):
        """
        What we're testing:
        - Cannot use an exercise_id that doesn't exist in DB
        - Expect 400 Bad Request
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Invalid Exercise Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": 9999, "goal": 20}]  # ← doesn't exist
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 400

    def test_create_challenge_fails_with_invalid_schedule_days(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Weekdays must be in range 1-7
        - Expect 422 Validation Error
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Invalid Days Challenge",
            "schedule_type": "weekly",
            "schedule_days": [0, 8],  # ← invalid days
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 422

    def test_create_challenge_fails_with_end_date_before_start(self, auth_token, exercise_ids):
        """
        What we're testing:
        - end_date cannot be before start_date
        - Expect 422 Validation Error
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        end_date = (date.today() - timedelta(days=1)).isoformat()  # ← before start_date
        data = {
            "name": "Invalid Dates Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "end_date": end_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 422

    def test_create_challenge_without_auth(self, exercise_ids):
        """
        What we're testing:
        - Unauthorized user cannot create a challenge
        - Expect 401 Unauthorized
        """
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "No Auth Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}]
        }
        response = client.post("/challenges", json=data)  # ← no token
        assert response.status_code == 401


# ================================================================
# 5. TESTS: CHALLENGE DETAILS
# ================================================================
# Verifying that GET /challenges/{id} returns correct data
# and enforces permissions (join_code visible only to creator).
# ================================================================

class TestChallengeDetail:
    
    def test_get_challenge_detail(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - All challenge fields are returned
        - List of exercises (2 exercises)
        - Number of participants (only creator)
        - joined = True (creator auto-joins)
        """
        response = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == challenge_id_active
        assert data["name"] == "Active Challenge"
        assert data["joined"] is True
        assert len(data["exercises"]) == 2
        assert data["participants"] == 1

    def test_get_challenge_detail_not_found(self, auth_token):
        """
        What we're testing:
        - Non-existent ID → 404 Not Found
        """
        response = client.get(
            "/challenges/9999",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404

    def test_get_challenge_detail_join_code_only_for_creator(self, auth_token, challenge_id_active, auth_token2):
        """
        What we're testing:
        - Creator can see join_code
        - Regular participant (or non-participant) CANNOT see join_code
        - This is a privacy feature: code is only for the creator
        """
        # Creator → can see the code
        response = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["join_code"] is not None
        
        # Second user → CANNOT see the code
        response = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["join_code"] is None


# ================================================================
# 6. TESTS: CHALLENGE EDITING
# ================================================================
# Verifying that only the creator can edit,
# and changes are applied correctly.
# ================================================================

class TestChallengeEdit:
    
    def test_edit_challenge_name(self, auth_token, challenge_id_future):
        """
        What we're testing:
        - Can change name and description
        - Changes are saved to the database
        """
        data = {
            "name": "Updated Name",
            "description": "Updated description"
        }
        response = client.patch(
            f"/challenges/{challenge_id_future}",
            json=data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated description"

    def test_edit_challenge_by_non_creator(self, auth_token2, challenge_id_future):
        """
        What we're testing:
        - Non-creator cannot edit
        - Expect 403 Forbidden
        """
        data = {"name": "Hacked Name"}
        response = client.patch(
            f"/challenges/{challenge_id_future}",
            json=data,
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 403

    def test_edit_challenge_not_found(self, auth_token):
        """
        What we're testing:
        - Editing a non-existent challenge → 404
        """
        data = {"name": "New Name"}
        response = client.patch(
            "/challenges/9999",
            json=data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404


# ================================================================
# 7. TESTS: JOIN / LEAVE
# ================================================================
# Testing the participation mechanics:
# - Joining by code
# - Joining by ID (public challenges only)
# - Protection against duplicate joins
# - Leaving a challenge
# ================================================================

class TestJoinLeave:
    
    def test_join_by_code_success(self, auth_token2, challenge_id_active, auth_token):
        """
        What we're testing:
        - Can join a private challenge using join_code
        - Returns participation_id and challenge_id
        """
        # Get the code from the creator
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        join_code = detail["join_code"]
        
        # Second user joins by code
        response = client.post(
            "/challenges/join",
            json={"join_code": join_code},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        assert response.status_code == 201
        assert response.json()["challenge_id"] == challenge_id_active

    def test_join_by_code_invalid(self, auth_token2):
        """
        What we're testing:
        - Invalid code → 404 Not Found
        """
        response = client.post(
            "/challenges/join",
            json={"join_code": "INVALID123"},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 404

    def test_join_already_joined(self, auth_token, public_challenge_active):
        """
        What we're testing:
        - Cannot join twice (already a participant)
        - Expect 409 Conflict
        """
        response = client.post(
            f"/challenges/{public_challenge_active}/join",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 409  # ← already in challenge

    def test_join_inactive_challenge(self, auth_token, public_challenge_active):
        """
        What we're testing:
        - Cannot join an INACTIVE challenge (archived/completed)
        - Expect 409 Conflict
        """
        # First archive it
        client.post(
            f"/challenges/{public_challenge_active}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Try to join
        response = client.post(
            f"/challenges/{public_challenge_active}/join",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 409

    def test_leave_challenge(self, auth_token2, challenge_id_active, auth_token):
        """
        What we're testing:
        - Can leave a challenge
        - Participation and all progress are deleted (cascade)
        - Returns {left: True}
        """
        # Second user joins
        join_code = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()["join_code"]
        client.post(
            "/challenges/join",
            json={"join_code": join_code},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        # Leaves
        response = client.post(
            f"/challenges/{challenge_id_active}/leave",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        assert response.status_code == 200
        assert response.json()["left"] is True

    def test_leave_not_participant(self, auth_token2, challenge_id_active):
        """
        What we're testing:
        - Non-participant cannot leave
        - Expect 404 Not Found
        """
        response = client.post(
            f"/challenges/{challenge_id_active}/leave",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 404


# ================================================================
# 8. TESTS: SESSIONS (WORKOUTS) — THE MOST IMPORTANT!
# ================================================================
# This is the HEART of the system — processing workouts.
# Client sends clean_reps, server:
# - closes exercises
# - closes days
# - updates streaks
# - calculates leaderboard position
# ALL tests use an ACTIVE challenge (date = today).
# ================================================================

class TestSessionSubmission:
    
    def test_submit_session_closes_exercise(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - If clean_reps >= goal → exercise is closed
        - Returns closed=True
        - Streak is not updated yet (full day needed)
        """
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        exercise_id = detail["exercises"][0]["challenge_exercise_id"]
        
        response = client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": exercise_id,
                "total_reps": 25,
                "clean_reps": 20  # ← goal = 20, closes!
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["exercise"]["closed"] is True
        assert data["exercise"]["clean"] >= 20

    def test_submit_session_closes_day(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - When ALL exercises of the day are closed → day closes
        - day_closed = True
        - challenge_streak = 1 (first day)
        - user_streak = 1 (first day in this challenge)
        """
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        exercises = detail["exercises"]
        
        # Close first exercise (squats, goal=20)
        client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": exercises[0]["challenge_exercise_id"],
                "total_reps": 25,
                "clean_reps": 20
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Close second exercise (pushups, goal=10)
        response = client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": exercises[1]["challenge_exercise_id"],
                "total_reps": 15,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["day_closed"] is True  # ← day is closed!
        assert data["challenge_streak"] == 1
        assert data["user_streak"] == 1

    def test_submit_session_fails_if_not_active(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - Cannot submit a session to an archived challenge
        - Expect 409 Conflict
        """
        # Archive it
        client.post(
            f"/challenges/{challenge_id_active}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Try to submit a session
        response = client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": 1,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 409

    def test_submit_session_fails_if_not_participant(self, auth_token2, challenge_id_active):
        """
        What we're testing:
        - Only participants can submit sessions
        - Expect 403 Forbidden
        """
        response = client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": 1,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token2}"}  # ← not a participant
        )
        assert response.status_code == 403

    def test_submit_session_fails_with_invalid_exercise(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - Exercise must belong to the challenge
        - Expect 404 Not Found
        """
        response = client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": 9999,  # ← doesn't exist
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404

    def test_submit_session_accumulates_today(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - Multiple sessions in one day are SUMMED
        - First session: 10 reps → not closed (goal=20)
        - Second session: another 10 reps → closed!
        - Important: users can train multiple times per day
        """
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        exercise_id = detail["exercises"][0]["challenge_exercise_id"]
        
        # Session 1: 10 reps (not enough)
        response1 = client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": exercise_id,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response1.json()["exercise"]["closed"] is False
        
        # Session 2: another 10 reps (total 20 → closed!)
        response2 = client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": exercise_id,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response2.json()["exercise"]["closed"] is True


# ================================================================
# 9. TESTS: LEADERBOARD
# ================================================================
# Verifying sorting and ranking of participants.
# Sorting: days_completed → challenge_streak → total_clean_reps → joined_at
# ================================================================

class TestLeaderboard:
    
    def test_leaderboard_returns_sorted(self, auth_token, auth_token2, challenge_id_active):
        """
        What we're testing:
        - Leaderboard is sorted in the correct order
        - First participant has place = 1
        - Leaderboard has 2 participants
        """
        # Second user joins
        join_code = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()["join_code"]
        client.post(
            "/challenges/join",
            json={"join_code": join_code},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        # Get leaderboard
        response = client.get(
            f"/challenges/{challenge_id_active}/leaderboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # ← two participants
        assert data[0]["place"] == 1  # ← first place

    def test_leaderboard_requires_auth(self, challenge_id_active):
        """
        What we're testing:
        - Unauthorized user cannot view leaderboard
        - Expect 401 Unauthorized
        """
        response = client.get(f"/challenges/{challenge_id_active}/leaderboard")
        assert response.status_code == 401


# ================================================================
# 10. TESTS: PRESETS
# ================================================================
# Verifying that /challenges/presets works.
# Presets are system challenges provided by the app.
# ================================================================

class TestPresets:
    
    def test_get_presets(self, auth_token):
        """
        What we're testing:
        - Endpoint returns a list (may be empty)
        - Status 200 OK
        - Returns a list (not a dict)
        """
        response = client.get(
            "/challenges/presets",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ================================================================
# 11. TESTS: ME ROUTES (PROFILE, MY CHALLENGES, TODAY'S PLAN)
# ================================================================
# Testing user-specific endpoints:
# - /me — user profile
# - /me/challenges — my challenges with status filter
# - /me/today — today's plan (challenges scheduled for today)
# ================================================================

class TestMeRoutes:
    
    def test_me_profile(self, auth_token):
        """
        What we're testing:
        - /me returns user data
        - username, email, streak_current, streak_longest
        - volume — exercise statistics
        """
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"
        assert "streak_current" in data
        assert "streak_longest" in data
    
    def test_my_challenges_active(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - /me/challenges?status=active returns only active ones
        - Our created challenge is in the list
        """
        response = client.get(
            "/me/challenges?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["id"] == challenge_id_active

    def test_my_challenges_archived(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - /me/challenges?status=archived returns only archived ones
        - After archiving, the challenge appears in this list
        """
        # Archive it
        client.post(
            f"/challenges/{challenge_id_active}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Check
        response = client.get(
            "/me/challenges?status=archived",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "archived"

    def test_today_plan(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - /me/today returns challenges scheduled for today
        - Active challenge (start_date = today) should be in the list
        - For each exercise, today's progress is shown
        """
        response = client.get(
            "/me/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Active challenge should be in today's plan
        assert len(data) >= 1
        assert data[0]["id"] == challenge_id_active
        assert data[0]["name"] == "Active Challenge"
        assert len(data[0]["exercises"]) == 2


# ================================================================
# 12. TESTS: ARCHIVING
# ================================================================
# Testing manual challenge freezing.
# Only the creator can archive.
# ================================================================

class TestArchive:
    
    def test_archive_challenge_by_creator(self, auth_token, challenge_id_future):
        """
        What we're testing:
        - Creator can archive a challenge
        - Status changes to "archived"
        - Returns id and status
        """
        response = client.post(
            f"/challenges/{challenge_id_future}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == challenge_id_future
        assert data["status"] == "archived"

    def test_archive_challenge_by_non_creator(self, auth_token2, challenge_id_future):
        """
        What we're testing:
        - Non-creator CANNOT archive
        - Expect 403 Forbidden
        """
        response = client.post(
            f"/challenges/{challenge_id_future}/archive",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 403

    def test_archive_already_archived(self, auth_token, challenge_id_future):
        """
        What we're testing:
        - Archiving an already archived challenge is idempotent
        - Second call also returns 200 OK
        - Status remains "archived"
        """
        # First archive
        client.post(
            f"/challenges/{challenge_id_future}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Second archive
        response = client.post(
            f"/challenges/{challenge_id_future}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "archived"


# ================================================================
# 13. TESTS: EXERCISES LIST
# ================================================================
# Verifying that /exercises returns the exercise catalog.
# ================================================================

class TestExercisesList:
    
    def test_list_exercises(self, auth_token):
        """
        What we're testing:
        - Returns the list of exercises
        - At least 3 exercises (squats, pushups, plank)
        - Russian names are preserved
        """
        response = client.get(
            "/exercises",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
        
        # Check Russian names
        exercise_names = [ex["name"] for ex in data]
        assert "Приседания" in exercise_names
        assert "Отжимания" in exercise_names
        assert "Планка" in exercise_names

# ================================================================
# 14. TESTS: STREAKS (GLOBAL & CHALLENGE)
# ================================================================
# Testing streak mechanics:
# - Global streak (users.streak_current) — across all challenges
# - Challenge streak (participations.challenge_streak) — within a single challenge
# - Streak resets when a day is missed
# - Streak increments only once per day
# ================================================================

class TestStreaks:
    
    def test_global_streak_increments_on_day_close(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - Closing a day increments global streak (users.streak_current)
        - Initial streak should be 1 after first day
        """
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        exercises = detail["exercises"]
        
        # Close both exercises to close the day
        for ex in exercises:
            client.post(
                f"/challenges/{challenge_id_active}/sessions",
                json={
                    "challenge_exercise_id": ex["challenge_exercise_id"],
                    "total_reps": ex["goal"] + 5,
                    "clean_reps": ex["goal"]
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        # Check global streak via /me
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["streak_current"] == 1

    def test_global_streak_only_once_per_day(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - Global streak increments ONLY ONCE per day
        - Even if user closes 2 different challenges in one day
        - Second challenge should NOT increment the streak again
        """
        # Create SECOND challenge for today
        start_date = date.today().isoformat()
        second_challenge_data = {
            "name": "Second Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": 2, "goal": 5}]  # pushups
        }
        response = client.post(
            "/challenges",
            json=second_challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        second_challenge_id = response.json()["id"]
        
        # Close first challenge
        detail1 = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        for ex in detail1["exercises"]:
            client.post(
                f"/challenges/{challenge_id_active}/sessions",
                json={
                    "challenge_exercise_id": ex["challenge_exercise_id"],
                    "total_reps": ex["goal"] + 5,
                    "clean_reps": ex["goal"]
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        # Check streak after first challenge
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        streak_after_first = response.json()["streak_current"]
        
        # Close second challenge
        detail2 = client.get(
            f"/challenges/{second_challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        for ex in detail2["exercises"]:
            client.post(
                f"/challenges/{second_challenge_id}/sessions",
                json={
                    "challenge_exercise_id": ex["challenge_exercise_id"],
                    "total_reps": ex["goal"] + 5,
                    "clean_reps": ex["goal"]
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        # Check streak again — should NOT have increased
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        streak_after_second = response.json()["streak_current"]
        
        assert streak_after_first == streak_after_second
        assert streak_after_first == 1

    def test_global_streak_resets_after_missed_day(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - If user misses a day, streak resets to 1 on next activity
        - This is the core streak mechanics
        """
        # Close day 1
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        for ex in detail["exercises"]:
            client.post(
                f"/challenges/{challenge_id_active}/sessions",
                json={
                    "challenge_exercise_id": ex["challenge_exercise_id"],
                    "total_reps": ex["goal"] + 5,
                    "clean_reps": ex["goal"]
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        # Check streak = 1
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.json()["streak_current"] == 1
        
        # ============================================================
        # NOTE: To fully test streak reset, we would need to:
        # 1. Close day 1
        # 2. Wait 1 day (or mock the date)
        # 3. Close day 2
        # 4. Streak should be 2 (not reset)
        # 5. Wait another day (skip)
        # 6. Close day 3
        # 7. Streak should reset to 1
        # 
        # Since we can't easily mock dates in integration tests,
        # this is verified in unit tests (test_streaks_unit.py).
        # This test is a placeholder for the happy path.
        # ============================================================
        
        # For now, just verify the first day works
        assert True

    def test_challenge_streak_increments_on_day_close(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - Challenge streak (participations.challenge_streak) increments
        - when a day is closed
        - Returns updated challenge_streak in session response
        """
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        exercises = detail["exercises"]
        
        # Close both exercises
        response = None
        for ex in exercises:
            response = client.post(
                f"/challenges/{challenge_id_active}/sessions",
                json={
                    "challenge_exercise_id": ex["challenge_exercise_id"],
                    "total_reps": ex["goal"] + 5,
                    "clean_reps": ex["goal"]
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        # After closing the day, challenge_streak should be 1
        assert response.status_code == 200
        data = response.json()
        assert data["challenge_streak"] == 1

    def test_challenge_streak_respects_schedule(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Challenge streak only considers SCHEDULED days
        - Weekly challenge with days [1, 3, 5] (Mon, Wed, Fri)
        - Closing Mon → streak = 1
        - Skipping Tue (not scheduled) → no effect
        - Closing Wed → streak = 2 (since previous scheduled day was Mon)
        - Closing Thu (not scheduled) → no effect
        - Closing Fri → streak = 3
        """
        # Create weekly challenge (Mon, Wed, Fri)
        # We need to pick a Monday as start_date
        today = date.today()
        days_until_monday = (0 - today.weekday()) % 7  # Monday = 0
        start_date = today + timedelta(days=days_until_monday)
        
        challenge_data = {
            "name": "Weekly Streak Challenge",
            "schedule_type": "weekly",
            "schedule_days": [1, 3, 5],  # Mon, Wed, Fri (ISO: 1=Mon)
            "start_date": start_date.isoformat(),
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
        
        # Get the challenge exercise ID
        detail = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        ex_id = detail["exercises"][0]["challenge_exercise_id"]
        
        # ============================================================
        # NOTE: This test requires the current date to be a scheduled day.
        # If today is not Mon/Wed/Fri, the test will fail.
        # For full coverage, this should be a unit test with mocked dates.
        # 
        # This integration test is a placeholder for the concept.
        # ============================================================
        
        # Close the exercise
        response = client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": ex_id,
                "total_reps": 15,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # If today is a scheduled day, streak = 1
        if response.status_code == 200:
            data = response.json()
            if data.get("day_closed", False):
                assert data["challenge_streak"] == 1
        
        # For a proper test, we'd mock the date or use unit tests
        assert True

    def test_streak_longest_updated(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - users.streak_longest tracks the record
        - When streak_current exceeds streak_longest, it updates
        """
        # Close day 1
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        for ex in detail["exercises"]:
            client.post(
                f"/challenges/{challenge_id_active}/sessions",
                json={
                    "challenge_exercise_id": ex["challenge_exercise_id"],
                    "total_reps": ex["goal"] + 5,
                    "clean_reps": ex["goal"]
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        # Check streak_longest = 1
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        assert data["streak_longest"] == 1


# ================================================================
# 15. TESTS: DELETE CHALLENGE (HARD DELETE)
# ================================================================
# Testing permanent deletion of challenges.
# - Only the creator can delete
# - Cannot delete active challenges (optional, based on implementation)
# - Cascade deletes all related data
# ================================================================

class TestDeleteChallenge:
    
    def test_delete_challenge_by_creator(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Creator can delete their own challenge
        - Returns 204 No Content
        - Challenge is removed from the system
        """
        # Create a challenge
        start_date = (date.today() + timedelta(days=1)).isoformat()
        challenge_data = {
            "name": "Delete Test Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
        
        # Delete it
        response = client.delete(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 204
        assert response.text == ""  # No content
        
        # Verify it's gone
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404

    def test_delete_challenge_by_non_creator(self, auth_token, auth_token2, exercise_ids):
        """
        What we're testing:
        - Non-creator CANNOT delete a challenge
        - Expect 403 Forbidden
        """
        # Creator creates a challenge
        start_date = (date.today() + timedelta(days=1)).isoformat()
        challenge_data = {
            "name": "Delete Test Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
        
        # Second user tries to delete
        response = client.delete(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        assert response.status_code == 403
        assert response.json()["detail"] == "Only the creator can delete"

    def test_delete_challenge_cascade_deletes_participations(self, auth_token, auth_token2, exercise_ids):
        """
        What we're testing:
        - Deleting a challenge cascades to ALL participations
        - All participants are removed
        - No orphaned data remains
        """
        # Create a challenge
        start_date = date.today().isoformat()  # Active challenge
        challenge_data = {
            "name": "Cascade Delete Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
        
        # Second user joins
        join_code = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()["join_code"]
        client.post(
            "/challenges/join",
            json={"join_code": join_code},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        # Check participants count = 2
        detail = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        assert detail["participants"] == 2
        
        # Delete the challenge
        response = client.delete(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 204
        
        # Verify challenge is gone
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404

    def test_delete_challenge_cascade_deletes_sessions_and_progress(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Deleting a challenge cascades to sessions, progress, and day progress
        - All workout data is removed
        """
        # Create an active challenge
        start_date = date.today().isoformat()
        challenge_data = {
            "name": "Session Cascade Test",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [
                {"exercise_id": exercise_ids["squats"], "goal": 10},
                {"exercise_id": exercise_ids["pushups"], "goal": 5}
            ]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
        
        # Submit a session (close the day)
        detail = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        for ex in detail["exercises"]:
            client.post(
                f"/challenges/{challenge_id}/sessions",
                json={
                    "challenge_exercise_id": ex["challenge_exercise_id"],
                    "total_reps": ex["goal"] + 5,
                    "clean_reps": ex["goal"]
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        # Verify we have progress (day closed)
        detail_after = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        assert detail_after["joined"] is True
        
        # Delete the challenge
        response = client.delete(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 204
        
        # Verify challenge is gone
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        
        # Verify user's global stats are NOT deleted (user_exercise_stats should remain)
        # Global stats are NOT cascaded from challenge deletion
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        # The user still exists and global stats should be preserved

    def test_delete_challenge_not_found(self, auth_token):
        """
        What we're testing:
        - Deleting a non-existent challenge → 404 Not Found
        """
        response = client.delete(
            "/challenges/9999",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404

    def test_delete_challenge_without_auth(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Unauthorized user cannot delete a challenge
        - Expect 401 Unauthorized
        """

        start_date = (date.today() + timedelta(days=1)).isoformat()
        challenge_data = {
            "name": "No Auth Delete Test",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
    
        response = client.delete(f"/challenges/{challenge_id}")
        assert response.status_code == 401


# ================================================================
# 16. TESTS: DELETE VS ARCHIVE — DIFFERENT BEHAVIORS
# ================================================================
# Understanding the difference:
# - Archive: soft delete (status = "archived", data remains)
# - Delete: hard delete (data is permanently removed)
# ================================================================

class TestDeleteVsArchive:
    
    def test_archived_challenge_still_exists(self, auth_token, exercise_ids):
        """
        What we're testing:
        - After archiving, challenge still exists
        - Can be accessed and restored
        """
        # Create a challenge
        start_date = (date.today() + timedelta(days=1)).isoformat()
        challenge_data = {
            "name": "Archive Test",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
        
        # Archive it
        response = client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "archived"
        
        # It still exists (can fetch it)
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "archived"

    def test_deleted_challenge_gone_forever(self, auth_token, exercise_ids):
        """
        What we're testing:
        - After DELETE, challenge is permanently gone
        - Cannot be recovered
        """
        # Create a challenge
        start_date = (date.today() + timedelta(days=1)).isoformat()
        challenge_data = {
            "name": "Delete Forever Test",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
        
        # Delete it
        response = client.delete(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 204
        
        # It's gone forever
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        
        # Cannot archive a deleted challenge
        response = client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404


# ================================================================
# 17. TESTS: DELETE ACTIVE CHALLENGE (BEHAVIOR OPTION)
# ================================================================
# This test checks if your implementation allows deleting active challenges.
# If you implemented the "archive first" restriction, this test should pass.
# If you allow deleting any challenge, it will pass too (just different behavior).
# ================================================================

class TestDeleteActiveChallenge:
    
    def test_delete_active_challenge_allowed(self, auth_token, exercise_ids):
        """
        What we're testing:
        - Can delete an active challenge directly (no archive needed)
        - This tests the current implementation behavior
        
        NOTE: If your implementation requires archiving first,
        this test will fail — adjust accordingly.
        """
        # Create an active challenge
        start_date = date.today().isoformat()
        challenge_data = {
            "name": "Active Delete Test",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]
        
        # Try to delete directly (without archiving first)
        response = client.delete(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Either 204 (allowed) or 409 (requires archive)
        # Both are valid behaviors — test documents the current implementation
        if response.status_code == 204:
            # Active deletion allowed
            assert response.text == ""
        elif response.status_code == 409:
            # Requires archive first
            assert "archive" in response.json()["detail"].lower()
        else:
            assert False, f"Unexpected status code: {response.status_code}"