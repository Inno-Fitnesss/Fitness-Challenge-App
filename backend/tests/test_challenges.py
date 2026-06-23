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
    # Re-bind the DB override to THIS module's engine. Other test modules also
    # override get_db at import time on the shared app; re-binding per test keeps
    # the suite correct when run together (otherwise: "no such table").
    app.dependency_overrides[get_db] = override_get_db

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
    Creates an active daily challenge (started YESTERDAY).
    Used in tests for:
    - Sessions (need an active challenge to submit workouts)
    - /me/today (challenge must be in today's plan)
    - Leaderboard (need participants in an active challenge)

    Note: start_date is yesterday (not today) so the challenge is reliably
    "already started" regardless of the server timezone. The backend compares
    against the user's local_today (UTC by default), which can be a day behind
    the test machine's local date — a start_date of "today" would then be
    treated as not-yet-started and drop out of /me/today.
    """
    start_date = (date.today() - timedelta(days=1)).isoformat()
    
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
    Creates a PUBLIC active daily challenge (started YESTERDAY).
    Used in JOIN tests where joining by ID is required.
    (Private challenges can only be joined by code)

    Uses a yesterday start_date for the same timezone-safety reason as
    challenge_id_active.
    """
    start_date = (date.today() - timedelta(days=1)).isoformat()
    
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
# 14. TESTS: /me/today — EDGE CASES
# ================================================================
# test_today_plan (above) covers the happy path. These cover the
# scheduling/visibility edge cases:
# - future challenges are hidden
# - weekly challenges not scheduled for today are hidden
# - submitted progress is reflected in today's plan
# - the endpoint requires authentication
# ================================================================

class TestTodayEdgeCases:

    def test_today_excludes_future_challenge(self, auth_token, challenge_id_future):
        """
        What we're testing:
        - A challenge that starts tomorrow must NOT appear in today's plan
        """
        response = client.get(
            "/me/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        ids = [c["id"] for c in response.json()]
        assert challenge_id_future not in ids

    def test_today_excludes_unscheduled_weekday(self, auth_token, exercise_ids):
        """
        What we're testing:
        - A weekly challenge not scheduled for today is NOT in today's plan
        - schedule_days exclude today and the adjacent weekday so the test is
          robust even if the server's local date differs by a timezone offset
        """
        today_weekday = date.today().isoweekday()
        prev_weekday = today_weekday - 1 or 7
        excluded = {today_weekday, prev_weekday}
        other_days = [d for d in range(1, 8) if d not in excluded][:2]

        challenge_data = {
            "name": "Weekly Off-day Challenge",
            "schedule_type": "weekly",
            "schedule_days": other_days,
            "start_date": (date.today() - timedelta(days=3)).isoformat(),
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}],
        }
        response = client.post(
            "/challenges",
            json=challenge_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        challenge_id = response.json()["id"]

        today = client.get(
            "/me/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert today.status_code == 200
        ids = [c["id"] for c in today.json()]
        assert challenge_id not in ids

    def test_today_reflects_submitted_progress(self, auth_token, challenge_id_active):
        """
        What we're testing:
        - After submitting a session, clean_today reflects the clean reps
        - The exercise is not yet closed when clean_today < goal
        """
        detail = client.get(
            f"/challenges/{challenge_id_active}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        challenge_exercise_id = detail["exercises"][0]["challenge_exercise_id"]

        client.post(
            f"/challenges/{challenge_id_active}/sessions",
            json={
                "challenge_exercise_id": challenge_exercise_id,
                "total_reps": 12,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        response = client.get(
            "/me/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        challenge = next(c for c in response.json() if c["id"] == challenge_id_active)
        exercise = next(
            e for e in challenge["exercises"]
            if e["challenge_exercise_id"] == challenge_exercise_id
        )
        assert exercise["clean_today"] == 10
        assert exercise["closed"] is False

    def test_today_requires_auth(self):
        """
        What we're testing:
        - /me/today without a token returns 401
        """
        response = client.get("/me/today")
        assert response.status_code == 401