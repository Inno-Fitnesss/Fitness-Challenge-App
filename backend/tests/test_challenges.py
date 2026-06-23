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

# --- Test database setup ---
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"

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


# --- Fixtures ---
@pytest.fixture(autouse=True)
def setup_database():
    """Create tables and seed exercises before each test"""
    Base.metadata.create_all(bind=engine)
    
    # Seed exercises (same as in init_db.py)
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
    
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def auth_token():
    """Register and login a user, return the token"""
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
    """Second user for multi-user tests"""
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
    """Get existing exercise IDs"""
    return {"squats": 1, "pushups": 2, "plank": 3}


@pytest.fixture
def challenge_id(auth_token, exercise_ids):
    """Create a challenge and return its ID"""
    start_date = (date.today() + timedelta(days=1)).isoformat()
    
    challenge_data = {
        "name": "Test Challenge",
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
    
    if response.status_code != 201:
        print(f"Create challenge error: {response.status_code} - {response.json()}")
    
    return response.json()["id"]


# ============================================================
# 1. CHALLENGE CREATION TESTS
# ============================================================

class TestChallengeCreation:
    
    def test_create_challenge_success(self, auth_token, exercise_ids):
        """Should create a challenge with exercises"""
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
        """Should create challenge with weekly schedule"""
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
        """Should create challenge without end_date"""
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
        """Should fail if no exercises provided"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Invalid Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": []
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 422

    def test_create_challenge_fails_with_duplicate_exercises(self, auth_token, exercise_ids):
        """Should fail if duplicate exercises in the same challenge"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Duplicate Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [
                {"exercise_id": exercise_ids["squats"], "goal": 20},
                {"exercise_id": exercise_ids["squats"], "goal": 30}
            ]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 422

    def test_create_challenge_fails_with_invalid_exercise(self, auth_token):
        """Should fail if exercise_id doesn't exist"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Invalid Exercise Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": 9999, "goal": 20}]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 400

    def test_create_challenge_fails_with_invalid_schedule_days(self, auth_token, exercise_ids):
        """Should fail if weekly schedule has invalid days"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Invalid Days Challenge",
            "schedule_type": "weekly",
            "schedule_days": [0, 8],
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}]
        }
        response = client.post("/challenges", json=data, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 422

    def test_create_challenge_fails_with_end_date_before_start(self, auth_token, exercise_ids):
        """Should fail if end_date < start_date"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        end_date = (date.today() - timedelta(days=1)).isoformat()
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
        """Should fail if not authenticated"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "No Auth Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}]
        }
        response = client.post("/challenges", json=data)
        assert response.status_code == 401


# ============================================================
# 2. CHALLENGE DETAIL TESTS
# ============================================================

class TestChallengeDetail:
    
    def test_get_challenge_detail(self, auth_token, challenge_id):
        """Should return challenge details"""
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == challenge_id
        assert data["name"] == "Test Challenge"
        assert data["joined"] is True
        assert len(data["exercises"]) == 2
        assert data["participants"] == 1

    def test_get_challenge_detail_not_found(self, auth_token):
        """Should return 404 for non-existent challenge"""
        response = client.get(
            "/challenges/9999",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404

    def test_get_challenge_detail_join_code_only_for_creator(self, auth_token, challenge_id, auth_token2):
        """Should show join_code only to the creator"""
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["join_code"] is not None
        
        response = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["join_code"] is None


# ============================================================
# 3. CHALLENGE EDIT TESTS
# ============================================================

class TestChallengeEdit:
    
    def test_edit_challenge_name(self, auth_token, challenge_id):
        """Should edit challenge name and description"""
        data = {
            "name": "Updated Name",
            "description": "Updated description"
        }
        response = client.patch(
            f"/challenges/{challenge_id}",
            json=data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated description"

    def test_edit_challenge_schedule(self, auth_token, challenge_id):
        """Should edit schedule type and days"""
        data = {
            "schedule_type": "weekly",
            "schedule_days": [1, 3, 5],
        }
        response = client.patch(
            f"/challenges/{challenge_id}",
            json=data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["schedule_type"] == "weekly"
        assert result["schedule_days"] == [1, 3, 5]

    def test_edit_challenge_schedule_to_daily(self, auth_token, exercise_ids):
        """Should clear schedule_days when switching to daily"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        create = client.post(
            "/challenges",
            json={
                "name": "Weekly",
                "schedule_type": "weekly",
                "schedule_days": [2, 4],
                "start_date": start_date,
                "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}],
            },
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        challenge_id = create.json()["id"]

        response = client.patch(
            f"/challenges/{challenge_id}",
            json={"schedule_type": "daily"},
            headers={"Authorization": f"Bearer {auth_token}"},
        )

        assert response.status_code == 200
        result = response.json()
        assert result["schedule_type"] == "daily"
        assert result["schedule_days"] is None

    def test_edit_challenge_by_non_creator(self, auth_token2, challenge_id):
        """Should fail if non-creator tries to edit"""
        data = {"name": "Hacked Name"}
        response = client.patch(
            f"/challenges/{challenge_id}",
            json=data,
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 403

    def test_edit_challenge_not_found(self, auth_token):
        """Should return 404 for non-existent challenge"""
        data = {"name": "New Name"}
        response = client.patch(
            "/challenges/9999",
            json=data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404


# ============================================================
# 4. JOIN / LEAVE TESTS
# ============================================================

class TestJoinLeave:
    
    def test_join_by_code_success(self, auth_token2, challenge_id, auth_token):
        """Should join challenge by code"""
        detail = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        join_code = detail["join_code"]
        
        response = client.post(
            "/challenges/join",
            json={"join_code": join_code},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        assert response.status_code == 201
        assert response.json()["challenge_id"] == challenge_id

    def test_join_by_code_invalid(self, auth_token2):
        """Should fail with invalid join_code"""
        response = client.post(
            "/challenges/join",
            json={"join_code": "INVALID123"},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 404

    def test_join_already_joined(self, auth_token):
        """Should fail if already joined"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Public Challenge",
            "schedule_type": "daily",
            "start_date": start_date,
            "is_private": False,
            "exercises": [{"exercise_id": 1, "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        public_challenge_id = response.json()["id"]
        
        response = client.post(
            f"/challenges/{public_challenge_id}/join",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 409

    def test_join_inactive_challenge(self, auth_token):
        """Should fail if challenge is not active"""
        start_date = (date.today() + timedelta(days=1)).isoformat()
        data = {
            "name": "Test Inactive",
            "schedule_type": "daily",
            "start_date": start_date,
            "is_private": False,
            "exercises": [{"exercise_id": 1, "goal": 10}]
        }
        response = client.post(
            "/challenges",
            json=data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        public_challenge_id = response.json()["id"]
        
        client.post(
            f"/challenges/{public_challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = client.post(
            f"/challenges/{public_challenge_id}/join",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 409

    def test_leave_challenge(self, auth_token2, challenge_id, auth_token):
        """Should leave challenge and clean up progress"""
        join_code = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()["join_code"]
        client.post(
            "/challenges/join",
            json={"join_code": join_code},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        response = client.post(
            f"/challenges/{challenge_id}/leave",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        assert response.status_code == 200
        assert response.json()["left"] is True

    def test_leave_not_participant(self, auth_token2, challenge_id):
        """Should fail if not a participant"""
        response = client.post(
            f"/challenges/{challenge_id}/leave",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 404


# ============================================================
# 5. SESSION TESTS
# ============================================================

class TestSessionSubmission:
    
    def test_submit_session_closes_exercise(self, auth_token, challenge_id):
        """Should close exercise when clean_reps >= goal"""
        detail = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        exercise_id = detail["exercises"][0]["challenge_exercise_id"]
        
        response = client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": exercise_id,
                "total_reps": 25,
                "clean_reps": 20
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["exercise"]["closed"] is True
        assert data["exercise"]["clean"] >= 20

    def test_submit_session_closes_day(self, auth_token, challenge_id):
        """Should close day when all exercises closed"""
        detail = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        exercises = detail["exercises"]
        
        client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": exercises[0]["challenge_exercise_id"],
                "total_reps": 25,
                "clean_reps": 20
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": exercises[1]["challenge_exercise_id"],
                "total_reps": 15,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["day_closed"] is True
        assert data["challenge_streak"] == 1
        assert data["user_streak"] == 1

    def test_submit_session_fails_if_not_active(self, auth_token, challenge_id):
        """Should fail if challenge is not active"""
        client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": 1,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 409

    def test_submit_session_fails_if_not_participant(self, auth_token2, challenge_id):
        """Should fail if user hasn't joined"""
        response = client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": 1,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 403

    def test_submit_session_fails_with_invalid_exercise(self, auth_token, challenge_id):
        """Should fail if exercise not in challenge"""
        response = client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": 9999,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404

    def test_submit_session_accumulates_today(self, auth_token, challenge_id):
        """Should accumulate multiple sessions per day"""
        detail = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        exercise_id = detail["exercises"][0]["challenge_exercise_id"]
        
        response1 = client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": exercise_id,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response1.json()["exercise"]["closed"] is False
        
        response2 = client.post(
            f"/challenges/{challenge_id}/sessions",
            json={
                "challenge_exercise_id": exercise_id,
                "total_reps": 10,
                "clean_reps": 10
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response2.json()["exercise"]["closed"] is True


# ============================================================
# 6. LEADERBOARD TESTS
# ============================================================

class TestLeaderboard:
    
    def test_leaderboard_returns_sorted(self, auth_token, auth_token2, challenge_id):
        """Should return sorted leaderboard"""
        join_code = client.get(
            f"/challenges/{challenge_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()["join_code"]
        client.post(
            "/challenges/join",
            json={"join_code": join_code},
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        
        response = client.get(
            f"/challenges/{challenge_id}/leaderboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["place"] == 1

    def test_leaderboard_requires_auth(self, challenge_id):
        """Should require authentication"""
        response = client.get(f"/challenges/{challenge_id}/leaderboard")
        assert response.status_code == 401


# ============================================================
# 7. PRESETS TESTS
# ============================================================

class TestPresets:
    
    def test_get_presets(self, auth_token):
        """Should return list of presets"""
        response = client.get(
            "/challenges/presets",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ============================================================
# 8. ME ROUTES TESTS
# ============================================================

class TestMeRoutes:
    
    def test_me_profile(self, auth_token):
        """Should return user profile"""
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
    
    def test_my_challenges_active(self, auth_token, challenge_id):
        """Should return active challenges"""
        response = client.get(
            "/me/challenges?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["id"] == challenge_id

    def test_my_challenges_archived(self, auth_token, challenge_id):
        """Should return archived challenges"""
        client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = client.get(
            "/me/challenges?status=archived",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "archived"


# ============================================================
# 9. ARCHIVE TESTS
# ============================================================

class TestArchive:
    
    def test_archive_challenge_by_creator(self, auth_token, challenge_id):
        """Should archive challenge by creator"""
        response = client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == challenge_id
        assert data["status"] == "archived"

    def test_archive_challenge_by_non_creator(self, auth_token2, challenge_id):
        """Should fail if non-creator tries to archive"""
        response = client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token2}"}
        )
        assert response.status_code == 403

    def test_archive_already_archived(self, auth_token, challenge_id):
        """Should be able to archive already archived"""
        client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = client.post(
            f"/challenges/{challenge_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "archived"


# ============================================================
# 10. EXERCISES LIST TESTS
# ============================================================

class TestExercisesList:

    def test_list_exercises(self, auth_token):
        """Should return list of all exercises"""
        response = client.get(
            "/exercises",
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3


# ============================================================
# 11. TODAY (/me/today) TESTS
# ============================================================

class TestToday:

    def _create_today_challenge(self, token, exercise_ids, schedule_type="daily", schedule_days=None):
        """Helper: create an active challenge that has already started.

        Uses a start_date a few days in the past so the challenge is guaranteed
        to have started regardless of the server timezone, while a daily schedule
        keeps it active for the current day.
        """
        data = {
            "name": "Today Challenge",
            "schedule_type": schedule_type,
            "start_date": (date.today() - timedelta(days=3)).isoformat(),
            "exercises": [{"exercise_id": exercise_ids["squats"], "goal": 20}],
        }
        if schedule_days is not None:
            data["schedule_days"] = schedule_days
        return client.post(
            "/challenges",
            json=data,
            headers={"Authorization": f"Bearer {token}"}
        )

    def test_today_returns_scheduled_challenge(self, auth_token, exercise_ids):
        """Should return today's active challenges with exercise progress"""
        self._create_today_challenge(auth_token, exercise_ids)

        response = client.get(
            "/me/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Today Challenge"
        assert len(data[0]["exercises"]) == 1
        assert data[0]["exercises"][0]["clean_today"] == 0
        assert data[0]["exercises"][0]["closed"] is False

    def test_today_excludes_future_challenge(self, auth_token, challenge_id):
        """Should not include challenges that start in the future"""
        # the challenge_id fixture starts tomorrow
        response = client.get(
            "/me/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_today_excludes_unscheduled_weekday(self, auth_token, exercise_ids):
        """Should not include a weekly challenge not scheduled for today"""
        today_weekday = date.today().isoweekday()
        # exclude today and the adjacent weekday so the test is robust even if the
        # server's local date differs from the test machine's by a timezone offset
        prev_weekday = today_weekday - 1 or 7
        excluded = {today_weekday, prev_weekday}
        other_days = [d for d in range(1, 8) if d not in excluded][:2]
        self._create_today_challenge(
            auth_token, exercise_ids, schedule_type="weekly", schedule_days=other_days
        )

        response = client.get(
            "/me/today",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_today_reflects_submitted_progress(self, auth_token, exercise_ids):
        """Should reflect submitted reps in clean_today"""
        create = self._create_today_challenge(auth_token, exercise_ids)
        challenge_id = create.json()["id"]
        challenge_exercise_id = create.json()["exercises"][0]["challenge_exercise_id"]

        client.post(
            f"/challenges/{challenge_id}/sessions",
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
        exercise = response.json()[0]["exercises"][0]
        assert exercise["clean_today"] == 10
        assert exercise["closed"] is False

    def test_today_requires_auth(self):
        """Should require authentication"""
        response = client.get("/me/today")
        assert response.status_code == 401


# ============================================================
# 12. AUTH TESTS
# ============================================================

class TestAuthSignup:

    def test_signup_success(self):
        """Should register a new user"""
        response = client.post("/auth/signup", json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "Test123!",
            "first_name": "New",
            "last_name": "User"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "new@example.com"

    def test_signup_fails_with_duplicate_email(self):
        """Should fail if email is already registered"""
        client.post("/auth/signup", json={
            "username": "userA", "email": "dup@example.com", "password": "Test123!"
        })
        response = client.post("/auth/signup", json={
            "username": "userB", "email": "dup@example.com", "password": "Test123!"
        })
        assert response.status_code == 400

    def test_signup_fails_with_duplicate_username(self):
        """Should fail if username is already taken"""
        client.post("/auth/signup", json={
            "username": "taken", "email": "first@example.com", "password": "Test123!"
        })
        response = client.post("/auth/signup", json={
            "username": "taken", "email": "second@example.com", "password": "Test123!"
        })
        assert response.status_code == 400

    def test_signup_fails_with_invalid_email(self):
        """Should fail validation for a malformed email"""
        response = client.post("/auth/signup", json={
            "username": "bademail", "email": "not-an-email", "password": "Test123!"
        })
        assert response.status_code == 422

    def test_signup_fails_with_missing_fields(self):
        """Should fail validation when required fields are missing"""
        response = client.post("/auth/signup", json={"username": "incomplete"})
        assert response.status_code == 422


class TestAuthLogin:

    def test_login_success(self, auth_token):
        """Should return a token on valid credentials"""
        assert auth_token is not None
        assert isinstance(auth_token, str)

    def test_login_fails_with_wrong_password(self, auth_token):
        """Should fail with an incorrect password"""
        response = client.post("/auth/login", json={
            "email": "test@example.com", "password": "WrongPassword!"
        })
        assert response.status_code == 400

    def test_login_fails_for_nonexistent_user(self):
        """Should fail for an email that is not registered"""
        response = client.post("/auth/login", json={
            "email": "ghost@example.com", "password": "Test123!"
        })
        assert response.status_code == 400

    def test_login_fails_with_invalid_email(self):
        """Should fail validation for a malformed email"""
        response = client.post("/auth/login", json={
            "email": "not-an-email", "password": "Test123!"
        })
        assert response.status_code == 422


class TestAuthProtectedRoutes:

    def test_protected_route_without_token(self):
        """Should reject requests with no Authorization header"""
        response = client.get("/me")
        assert response.status_code == 401

    def test_protected_route_with_malformed_header(self):
        """Should reject an Authorization header without the Bearer prefix"""
        response = client.get("/me", headers={"Authorization": "token-without-bearer"})
        assert response.status_code == 401

    def test_protected_route_with_invalid_token(self):
        """Should reject a token that cannot be decoded"""
        response = client.get(
            "/me",
            headers={"Authorization": "Bearer not.a.valid.token"}
        )
        assert response.status_code == 401

    def test_protected_route_with_expired_token(self, auth_token):
        """Should reject a structurally valid but expired token"""
        import time
        import jwt
        from app.core.security.authHandler import JWT_SECRET, JWT_ALGORITHM

        expired_token = jwt.encode(
            {"user_id": 1, "expires": time.time() - 10},
            JWT_SECRET,
            algorithm=JWT_ALGORITHM,
        )
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401