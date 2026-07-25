"""
Streak *display* consistency tests — the read side of the two reported bugs.

Bug 1 ("streak didn't reset after a full idle day"): the global (cross-challenge)
streak and the per-challenge streak must both read as 0 once a full scheduled
day has been missed, on every endpoint that surfaces them (/me, /me/week,
/me/challenges, leaderboard).

Bug 2 ("flame flashes 1 then 0 on a partially-completed day"): a day where NOT
all exercises were closed must never be reported as a live +1. Crucially, the
two endpoints the dashboard reads — GET /me (seeds the flame from the cached
user) and GET /me/week (overwrites it) — must return the SAME number, so any
"1 then 0" the user sees is a stale client cache, not the server disagreeing
with itself.

These use the same fake-clock harness as test_streaks_scheduling.py.
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.user import User
from app.db.models.challenge import Exercise, Participation

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_streak_display.db"

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

# Monday anchor so weekly-schedule (isoweekday) tests are deterministic.
DAY = [date(2026, 6, 1) + timedelta(days=i) for i in range(14)]  # DAY[0]=Mon ... DAY[13]=Sun


def freeze(monkeypatch, fake_date):
    monkeypatch.setattr("app.service.sessionService.local_today", lambda tz=None: fake_date)
    monkeypatch.setattr("app.service.challengeService.local_today", lambda tz=None: fake_date)
    monkeypatch.setattr("app.routers.me.local_today", lambda tz=None: fake_date)


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


@pytest.fixture
def auth_token():
    data = {
        "username": "disp", "email": "disp@example.com", "password": "Test123!",
        "first_name": "D", "last_name": "U",
        "terms_accepted": True, "privacy_accepted": True,
    }
    client.post("/auth/signup", json=data)
    resp = client.post("/auth/login", json={"email": "disp@example.com", "password": "Test123!"})
    return resp.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def create_daily_challenge(token, n_exercises=3, goal=10, start=None):
    ex_ids = [1, 2, 3][:n_exercises]
    payload = {
        "name": "Daily", "schedule_type": "daily",
        "start_date": (start or DAY[0]).isoformat(),
        "exercises": [{"exercise_id": eid, "goal": goal} for eid in ex_ids],
    }
    resp = client.post("/challenges", json=payload, headers=_auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def exercise_ids_of(token, challenge_id):
    detail = client.get(f"/challenges/{challenge_id}", headers=_auth(token)).json()
    return [e["challenge_exercise_id"] for e in detail["exercises"]]


def submit(token, challenge_id, ce_id, clean_reps):
    return client.post(
        f"/challenges/{challenge_id}/sessions",
        json={"challenge_exercise_id": ce_id, "total_reps": clean_reps, "clean_reps": clean_reps},
        headers=_auth(token),
    )


def complete_day(token, challenge_id, ce_ids, goal=10):
    resp = None
    for ce_id in ce_ids:
        resp = submit(token, challenge_id, ce_id, goal)
        assert resp.status_code == 200, resp.text
    return resp


def me_streak(token):
    return client.get("/me", headers=_auth(token)).json()["streak_current"]


def week_streak(token, week_start):
    return client.get(
        f"/me/week?week_start={week_start.isoformat()}", headers=_auth(token)
    ).json()["streak_current"]


# ======================================================================
# Bug 1 — global (cross-challenge) streak must reset after a full idle day
# ======================================================================
class TestGlobalStreakReset:

    def test_me_shows_streak_alive_on_the_grace_day(self, monkeypatch, auth_token):
        """Completed yesterday, nothing yet today: the streak is NOT broken —
        the user still has all of today to keep it (Duolingo-style grace)."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)  # streak 1 on DAY[0]

        freeze(monkeypatch, DAY[1])  # next day, nothing done yet
        assert me_streak(auth_token) == 1

    def test_me_resets_streak_after_one_full_missed_day(self, monkeypatch, auth_token):
        """The exact "did nothing for a day" report: complete DAY0, skip DAY1
        entirely, check on DAY2 -> the global streak must read 0."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)

        freeze(monkeypatch, DAY[2])  # DAY[1] missed entirely
        assert me_streak(auth_token) == 0, "a full missed day must reset the global streak"

    def test_me_resets_after_multi_day_gap(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)

        freeze(monkeypatch, DAY[5])
        assert me_streak(auth_token) == 0

    def test_longest_is_preserved_when_current_resets_on_read(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)
        freeze(monkeypatch, DAY[1])
        complete_day(auth_token, cid, ces)  # streak 2

        freeze(monkeypatch, DAY[3])  # DAY[2] missed -> current resets on read
        me = client.get("/me", headers=_auth(auth_token)).json()
        assert me["streak_current"] == 0
        assert me["streak_longest"] == 2


# ======================================================================
# Bug 1 (challenge side) — per-challenge streak resets on every read surface
# ======================================================================
class TestChallengeStreakResetEverywhere:

    def test_all_read_surfaces_agree_streak_is_broken(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)

        freeze(monkeypatch, DAY[2])  # DAY[1] missed
        mine = client.get("/me/challenges?status=active", headers=_auth(auth_token)).json()
        entry = next(c for c in mine if c["id"] == cid)
        board = client.get(f"/challenges/{cid}/leaderboard", headers=_auth(auth_token)).json()
        assert entry["challenge_streak"] == 0
        assert board[0]["challenge_streak"] == 0

    def test_challenge_streak_alive_on_grace_day_everywhere(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)

        freeze(monkeypatch, DAY[1])  # own slot not closed yet
        mine = client.get("/me/challenges?status=active", headers=_auth(auth_token)).json()
        entry = next(c for c in mine if c["id"] == cid)
        assert entry["challenge_streak"] == 1


# ======================================================================
# Bug 2 — /me and /me/week must never disagree (any "1 then 0" is client-side)
# ======================================================================
class TestMeVsWeekConsistency:

    def test_partial_day_new_user_both_report_zero(self, monkeypatch, auth_token):
        """Brand-new user, closes ONE of three exercises today (day not closed).
        Neither /me nor /me/week may ever report a live streak of 1."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        submit(auth_token, cid, ces[0], 10)  # 1 of 3 -> day NOT closed

        assert me_streak(auth_token) == 0
        assert week_streak(auth_token, DAY[0]) == 0

    def test_me_and_week_identical_on_grace_day_partial(self, monkeypatch, auth_token):
        """Had a streak from yesterday, does a PARTIAL today. Whatever the
        number is, /me and /me/week MUST match — the dashboard seeds the flame
        from one and overwrites with the other, so a mismatch is the flash."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)  # streak 1

        freeze(monkeypatch, DAY[1])
        submit(auth_token, cid, ces[0], 10)  # only 1 of 3 today
        assert me_streak(auth_token) == week_streak(auth_token, DAY[0])

    def test_me_and_week_identical_across_the_whole_lifecycle(self, monkeypatch, auth_token):
        """Sweep several days (build, partial, miss, resume) and assert the two
        endpoints never diverge on any of them."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)

        def both_agree():
            week_start = DAY[0] - timedelta(days=DAY[0].weekday())
            assert me_streak(auth_token) == week_streak(auth_token, week_start)

        complete_day(auth_token, cid, ces); both_agree()          # DAY0 full
        freeze(monkeypatch, DAY[1]); submit(auth_token, cid, ces[0], 10); both_agree()  # DAY1 partial
        freeze(monkeypatch, DAY[2]); complete_day(auth_token, cid, ces); both_agree()   # DAY2 full
        freeze(monkeypatch, DAY[4]); both_agree()                 # DAY3 missed, read-only
        complete_day(auth_token, cid, ces); both_agree()          # DAY4 full again

    def test_full_completion_reports_one_on_both(self, monkeypatch, auth_token):
        """The 'no bug when you complete everything' case: a fully-closed day
        reads as 1 on both endpoints (this is why the full case never flashes)."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)
        assert me_streak(auth_token) == 1
        assert week_streak(auth_token, DAY[0]) == 1


# ======================================================================
# Bug 2 (submit response) — the number the client optimistically trusts
# ======================================================================
class TestSubmitResponseStreak:

    def test_partial_submit_response_never_bumps_user_streak(self, monkeypatch, auth_token):
        """The submit response carries user_streak; the client compares it to
        the previous value to decide whether to celebrate / light the flame.
        A partial day must return the UNCHANGED streak, never a premature +1."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        r = submit(auth_token, cid, ces[0], 10)  # 1 of 3
        assert r.json()["day_closed"] is False
        assert r.json()["user_streak"] == 0
        assert r.json()["challenge_streak"] == 0

    def test_closing_submit_response_bumps_exactly_once(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        r1 = submit(auth_token, cid, ces[0], 10)
        r2 = submit(auth_token, cid, ces[1], 10)
        r3 = submit(auth_token, cid, ces[2], 10)  # closes the day
        assert r1.json()["user_streak"] == 0
        assert r2.json()["user_streak"] == 0
        assert r3.json()["user_streak"] == 1
        assert r3.json()["day_closed"] is True
