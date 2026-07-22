"""
Deeper /admin/stats accuracy: top_streaks, exercise_totals (including the
seconds->minutes conversion for plank-type exercises), registrations_daily.
The previous admin test file only checked total_users and by_schedule.
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.core.security.hashHelper import HashHelper
from app.db.models.challenge import Exercise

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_admin_stats_deep.db"

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

ADMIN_PASSWORD = "test-admin-password"
ADMIN_PASSWORD_HASH = HashHelper.get_password_hash(ADMIN_PASSWORD)


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


def _register(username, email):
    data = {
        "username": username, "email": email, "password": "Test123!",
        "first_name": "F", "last_name": "L",
        "terms_accepted": True, "privacy_accepted": True,
    }
    client.post("/auth/signup", json=data)
    resp = client.post("/auth/login", json={"email": email, "password": "Test123!"})
    return resp.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_token(monkeypatch):
    monkeypatch.setattr("app.service.adminService.ADMIN_PASSWORD_HASH", ADMIN_PASSWORD_HASH)
    return client.post("/admin/login", json={"password": ADMIN_PASSWORD}).json()["token"]


def create_challenge(token, exercise_id=1, goal=10, start=None):
    payload = {
        "name": "Stats Challenge", "schedule_type": "daily",
        "start_date": (start or date.today()).isoformat(),
        "exercises": [{"exercise_id": exercise_id, "goal": goal}],
    }
    return client.post("/challenges", json=payload, headers=_auth(token)).json()["id"]


def submit(token, cid, ce_id, clean_reps):
    return client.post(
        f"/challenges/{cid}/sessions",
        json={"challenge_exercise_id": ce_id, "total_reps": clean_reps, "clean_reps": clean_reps},
        headers=_auth(token),
    )


class TestAdminStatsExerciseTotals:

    def test_reps_exercise_reports_raw_total(self, admin_token):
        token = _register("statsreps", "statsreps@example.com")
        cid = create_challenge(token, exercise_id=1, goal=10)
        detail = client.get(f"/challenges/{cid}", headers=_auth(token)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        submit(token, cid, ce_id, 10)

        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        squats = next(e for e in stats["exercise_totals"] if e["exercise"] == "Приседания")
        assert squats["total"] == 10
        assert squats["unit"] == "повторений"

    def test_seconds_exercise_reported_in_minutes(self, admin_token):
        token = _register("statsplank", "statsplank@example.com")
        cid = create_challenge(token, exercise_id=3, goal=60)
        detail = client.get(f"/challenges/{cid}", headers=_auth(token)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        submit(token, cid, ce_id, 180)  # 180 seconds = 3 minutes

        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        plank = next(e for e in stats["exercise_totals"] if e["exercise"] == "Планка")
        assert plank["total"] == 3
        assert plank["unit"] == "минут"

    def test_seconds_under_a_minute_rounds_down_to_zero(self, admin_token):
        """int(total_seconds) // 60 truncates — 59 seconds of plank shows as
        0 minutes in the admin dashboard. Documenting current behavior."""
        token = _register("statsplank2", "statsplank2@example.com")
        cid = create_challenge(token, exercise_id=3, goal=1000)
        detail = client.get(f"/challenges/{cid}", headers=_auth(token)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        submit(token, cid, ce_id, 59)

        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        plank = next(e for e in stats["exercise_totals"] if e["exercise"] == "Планка")
        assert plank["total"] == 0

    def test_exercise_with_no_sessions_reports_zero(self, admin_token):
        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        pushups = next(e for e in stats["exercise_totals"] if e["exercise"] == "Отжимания")
        assert pushups["total"] == 0


class TestAdminStatsTopStreaks:

    def test_top_streaks_ordered_descending(self, admin_token):
        tok_a = _register("streaka", "streaka@example.com")
        tok_b = _register("streakb", "streakb@example.com")
        cid_a = create_challenge(tok_a)
        cid_b = create_challenge(tok_b)
        detail_a = client.get(f"/challenges/{cid_a}", headers=_auth(tok_a)).json()
        detail_b = client.get(f"/challenges/{cid_b}", headers=_auth(tok_b)).json()
        submit(tok_a, cid_a, detail_a["exercises"][0]["challenge_exercise_id"], 10)
        submit(tok_b, cid_b, detail_b["exercises"][0]["challenge_exercise_id"], 10)

        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        streaks = [u["streak_longest"] for u in stats["top_streaks"]]
        assert streaks == sorted(streaks, reverse=True)

    def test_top_streaks_limited_to_three(self, admin_token):
        for i in range(5):
            tok = _register(f"manystreak{i}", f"manystreak{i}@example.com")
            cid = create_challenge(tok)
            detail = client.get(f"/challenges/{cid}", headers=_auth(tok)).json()
            submit(tok, cid, detail["exercises"][0]["challenge_exercise_id"], 10)

        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        assert len(stats["top_streaks"]) <= 3


class TestAdminStatsRegistrations:

    def test_registrations_daily_includes_today(self, admin_token):
        _register("regtoday", "regtoday@example.com")
        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        dates = [r["date"] for r in stats["registrations_daily"]]
        assert date.today().isoformat() in dates

    def test_registrations_daily_counts_multiple_signups_same_day(self, admin_token):
        _register("regmulti1", "regmulti1@example.com")
        _register("regmulti2", "regmulti2@example.com")
        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        today_point = next(r for r in stats["registrations_daily"] if r["date"] == date.today().isoformat())
        assert today_point["count"] >= 2


class TestAdminStatsVisibilityAndDuration:

    def test_public_vs_private_breakdown(self, admin_token):
        token = _register("visuser", "visuser@example.com")
        cid_private = create_challenge(token)
        cid_public = create_challenge(token, exercise_id=2)
        client.post(f"/challenges/{cid_public}/publish", headers=_auth(token))

        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        by_vis = {s["label"]: s["value"] for s in stats["challenges"]["by_visibility"]}
        assert by_vis["Групповые"] >= 1
        assert by_vis["Индивидуальные"] >= 1

    def test_open_ended_vs_with_end_date_breakdown(self, admin_token):
        token = _register("enduser", "enduser@example.com")
        payload_open = {
            "name": "Open ended", "schedule_type": "daily",
            "start_date": date.today().isoformat(),
            "exercises": [{"exercise_id": 1, "goal": 10}],
        }
        payload_bounded = {
            "name": "Bounded", "schedule_type": "daily",
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=30)).isoformat(),
            "exercises": [{"exercise_id": 2, "goal": 10}],
        }
        client.post("/challenges", json=payload_open, headers=_auth(token))
        client.post("/challenges", json=payload_bounded, headers=_auth(token))

        stats = client.get("/admin/stats", headers=_auth(admin_token)).json()
        by_dur = {s["label"]: s["value"] for s in stats["challenges"]["by_duration"]}
        assert by_dur["Бессрочные"] >= 1
        assert by_dur["С датой окончания"] >= 1