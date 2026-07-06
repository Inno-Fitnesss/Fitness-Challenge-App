"""
Multi-day streak, day-boundary and scheduling tests.

Why this file exists
---------------------
The existing suite (test_challenges.py) only ever exercises a SINGLE calendar
day: a challenge is created "active" (started yesterday) and a session is
submitted "today". Nothing simulates the passage of multiple days, so the
whole family of bugs that live at day boundaries — partial-day completion,
streak breaking, weekly schedules, stale streak display — was completely
untested. That's the gap this file closes.

How "today" is controlled
--------------------------
`local_today()` (app/core/scheduling.py) is called fresh on every request via
`datetime.now(ZoneInfo(...))`, and there's no way to pass a date from the
client. To simulate "day 1", "day 2", ... we monkeypatch the three places
that import `local_today` directly (challengeService, sessionService,
routers/me) so it returns a fixed fake date instead of the real clock. This
lets us drive the exact reported scenario deterministically:

    Day 1 evening: 2 of 3 exercises done, 3rd left unfinished
    Day 2 00:xx:   the 3rd exercise finally submitted

...and assert precisely what got closed, what didn't, and what the streak
counters look like at each step.
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
from app.db.models.challenge import (
    Exercise, Challenge, ChallengeDayProgress, ChallengeExerciseProgress, Participation,
)

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_streaks.db"

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

# Monday anchor so weekly-schedule (isoweekday-based) tests are deterministic.
DAY = [date(2026, 6, 1) + timedelta(days=i) for i in range(14)]  # DAY[0]=Mon ... DAY[13]=Sun


def freeze(monkeypatch, fake_date):
    """Make local_today() return `fake_date` everywhere it's imported."""
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
def auth_token(monkeypatch):
    # Registration/login aren't day-sensitive, but freeze anyway so the
    # fixture is safe to use inside a `with freeze(...)` block too.
    data = {
        "username": "streakuser", "email": "streak@example.com", "password": "Test123!",
        "first_name": "Streak", "last_name": "User",
    }
    client.post("/auth/signup", json=data)
    resp = client.post("/auth/login", json={"email": "streak@example.com", "password": "Test123!"})
    return resp.json()["token"]


@pytest.fixture
def auth_token2():
    data = {
        "username": "streakuser2", "email": "streak2@example.com", "password": "Test123!",
        "first_name": "Streak2", "last_name": "User2",
    }
    client.post("/auth/signup", json=data)
    resp = client.post("/auth/login", json={"email": "streak2@example.com", "password": "Test123!"})
    return resp.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def create_daily_challenge(token, n_exercises=3, goal=10, start=None):
    """3-exercise daily challenge (mirrors the reported-bug scenario) unless overridden."""
    ex_ids = [1, 2, 3][:n_exercises]
    payload = {
        "name": "Daily Streak Challenge",
        "schedule_type": "daily",
        "start_date": (start or DAY[0]).isoformat(),
        "exercises": [{"exercise_id": eid, "goal": goal} for eid in ex_ids],
    }
    resp = client.post("/challenges", json=payload, headers=_auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def create_weekly_challenge(token, schedule_days, goal=10, start=None):
    payload = {
        "name": "Weekly Streak Challenge",
        "schedule_type": "weekly",
        "schedule_days": schedule_days,
        "start_date": (start or DAY[0]).isoformat(),
        "exercises": [{"exercise_id": 1, "goal": goal}],
    }
    resp = client.post("/challenges", json=payload, headers=_auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def submit(token, challenge_id, ce_id, clean_reps):
    return client.post(
        f"/challenges/{challenge_id}/sessions",
        json={"challenge_exercise_id": ce_id, "total_reps": clean_reps, "clean_reps": clean_reps},
        headers=_auth(token),
    )


def exercise_ids_of(token, challenge_id):
    detail = client.get(f"/challenges/{challenge_id}", headers=_auth(token)).json()
    return [e["challenge_exercise_id"] for e in detail["exercises"]]


def complete_day(token, challenge_id, ce_ids, goal=10):
    """Submit enough clean reps to close every exercise for whatever day is
    currently frozen. Returns the response of the LAST (closing) submission."""
    resp = None
    for ce_id in ce_ids:
        resp = submit(token, challenge_id, ce_id, goal)
        assert resp.status_code == 200, resp.text
    return resp


# ======================================================================
# 1. Building a streak across consecutive days
# ======================================================================
class TestStreakBuilding:

    def test_streak_increments_on_consecutive_days(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)

        r1 = complete_day(auth_token, cid, ces)
        assert r1.json()["challenge_streak"] == 1

        freeze(monkeypatch, DAY[1])
        r2 = complete_day(auth_token, cid, ces)
        assert r2.json()["challenge_streak"] == 2

        freeze(monkeypatch, DAY[2])
        r3 = complete_day(auth_token, cid, ces)
        assert r3.json()["challenge_streak"] == 3

    def test_days_completed_counts_every_closed_day(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)
        freeze(monkeypatch, DAY[1])
        complete_day(auth_token, cid, ces)

        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        db = TestingSessionLocal()
        part = db.query(Participation).filter_by(challenge_id=cid).first()
        assert part.days_completed == 2
        db.close()

    def test_day_can_only_close_once_even_if_resubmitted(self, monkeypatch, auth_token):
        """Idempotency: extra reps on an already-closed day must not bump the
        streak or days_completed a second time."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)
        # Submit more reps to an already-closed exercise, same day.
        r = submit(auth_token, cid, ces[0], 5)
        assert r.json()["day_closed"] is False
        assert r.json()["challenge_streak"] == 1


# ======================================================================
# 2. Streak breaking after a missed day
# ======================================================================
class TestStreakBreaking:

    def test_streak_resets_after_missed_day(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)  # day0: streak 1

        freeze(monkeypatch, DAY[1])
        complete_day(auth_token, cid, ces)  # day1: streak 2

        # DAY[2] skipped entirely.

        freeze(monkeypatch, DAY[3])
        r = complete_day(auth_token, cid, ces)  # day3: should NOT continue from 2
        assert r.json()["challenge_streak"] == 1, (
            "Missing a scheduled day must reset the streak to 1 on the next "
            "completion, not continue counting from before the gap."
        )

    def test_days_completed_keeps_growing_even_after_streak_reset(self, monkeypatch, auth_token):
        """days_completed is a lifetime counter and must NOT be reset by a
        broken streak — only challenge_streak resets."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)
        freeze(monkeypatch, DAY[1])
        complete_day(auth_token, cid, ces)
        freeze(monkeypatch, DAY[3])  # gap at DAY[2]
        complete_day(auth_token, cid, ces)

        db = TestingSessionLocal()
        part = db.query(Participation).filter_by(challenge_id=cid).first()
        assert part.days_completed == 3
        assert part.challenge_streak == 1
        db.close()

    @pytest.mark.xfail(
        reason=(
            "KNOWN GAP: there is no background job that invalidates a streak "
            "at the day boundary. challenge_streak / user streak_current only "
            "update lazily on the NEXT submission, so if a user misses a day "
            "and simply opens the app without training, the API still reports "
            "the stale pre-break streak. This matches the teamlead's report: "
            "'5-го в 00:05 стрик не сбился, хотя должен был'. Needs either a "
            "scheduled job or an on-read recomputation before this can pass."
        ),
        strict=True,
    )
    def test_streak_reads_as_broken_before_any_new_submission(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)  # day0: streak = 1

        # DAY[1] is skipped (scheduled daily, so it counts as a miss).
        freeze(monkeypatch, DAY[2])
        # No submission — just read the challenge / leaderboard the morning
        # after the missed day, before doing anything.
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        board = client.get(f"/challenges/{cid}/leaderboard", headers=_auth(auth_token)).json()
        assert board[0]["challenge_streak"] == 0, (
            "Streak should read as broken once a scheduled day has passed "
            "without completion, even with no new submission yet."
        )


# ======================================================================
# 3. Regression: exact reported scenario — partial day, finished the next
#    calendar day, must not retroactively close either day.
# ======================================================================
class TestPartialDayCrossDayIsolation:

    def test_two_of_three_exercises_then_finishing_next_day_closes_neither_day(
        self, monkeypatch, auth_token
    ):
        """
        Reproduces: "4-го вечером выполнил 2 из 3 упражнений... после того как
        выполнил 3-е в 00:05 5-го, 4-е и 5-е ОБА отметились как выполненные".

        Expected (correct) behavior: exercise progress is scoped per calendar
        day. Finishing exercise #3 on day 2 must only count toward day 2's
        own progress — it must NOT retroactively close day 1 (which is
        missing exercise #3), and day 2 must stay open too (missing
        exercises #1 and #2, which were only ever submitted for day 1).
        """
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token, goal=10)
        ces = exercise_ids_of(auth_token, cid)

        submit(auth_token, cid, ces[0], 10)  # exercise 1 done, day 1
        submit(auth_token, cid, ces[1], 10)  # exercise 2 done, day 1
        # exercise 3 intentionally left undone on day 1.

        freeze(monkeypatch, DAY[1])
        r = submit(auth_token, cid, ces[2], 10)  # exercise 3, now on day 2
        assert r.json()["day_closed"] is False, "day 2 is missing exercises 1 & 2"

        db = TestingSessionLocal()
        part = db.query(Participation).filter_by(challenge_id=cid).first()
        day1_progress = db.query(ChallengeDayProgress).filter_by(
            participation_id=part.id, date=DAY[0]).first()
        day2_progress = db.query(ChallengeDayProgress).filter_by(
            participation_id=part.id, date=DAY[1]).first()
        assert day1_progress is None or day1_progress.is_closed is False, (
            "Day 1 must not be retroactively closed by a day-2 submission"
        )
        assert day2_progress is None or day2_progress.is_closed is False
        assert part.days_completed == 0
        assert part.challenge_streak == 0
        db.close()

    def test_exercise_progress_is_stored_under_the_day_it_was_actually_done(
        self, monkeypatch, auth_token
    ):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token, goal=10)
        ces = exercise_ids_of(auth_token, cid)
        submit(auth_token, cid, ces[0], 10)

        freeze(monkeypatch, DAY[1])
        submit(auth_token, cid, ces[2], 10)

        db = TestingSessionLocal()
        part = db.query(Participation).filter_by(challenge_id=cid).first()
        row_day0 = db.query(ChallengeExerciseProgress).filter_by(
            participation_id=part.id, challenge_exercise_id=ces[0], date=DAY[0]).first()
        row_day1 = db.query(ChallengeExerciseProgress).filter_by(
            participation_id=part.id, challenge_exercise_id=ces[2], date=DAY[1]).first()
        assert row_day0 is not None and row_day0.is_closed is True
        assert row_day1 is not None and row_day1.is_closed is True
        # No cross-contamination: exercise 1 has no row under day 1.
        stray = db.query(ChallengeExerciseProgress).filter_by(
            participation_id=part.id, challenge_exercise_id=ces[0], date=DAY[1]).first()
        assert stray is None
        db.close()

    def test_completing_the_missing_exercise_next_day_does_not_finish_yesterday(
        self, monkeypatch, auth_token
    ):
        """Even if the user then ALSO redoes exercises 1 & 2 on day 2 (fully
        completing day 2), day 1 must remain forever unfinished — it's not
        possible to complete a day retroactively."""
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token, goal=10)
        ces = exercise_ids_of(auth_token, cid)
        submit(auth_token, cid, ces[0], 10)
        submit(auth_token, cid, ces[1], 10)

        freeze(monkeypatch, DAY[1])
        r = complete_day(auth_token, cid, ces)  # does all 3 again, now dated day 2
        assert r.json()["day_closed"] is True
        assert r.json()["challenge_streak"] == 1  # first-ever CLOSED day, not day 2 of a streak

        db = TestingSessionLocal()
        part = db.query(Participation).filter_by(challenge_id=cid).first()
        assert part.days_completed == 1
        day1_progress = db.query(ChallengeDayProgress).filter_by(
            participation_id=part.id, date=DAY[0]).first()
        assert day1_progress is None or day1_progress.is_closed is False
        db.close()


# ======================================================================
# 4. Weekly schedules: streak must skip unscheduled days, not calendar days
# ======================================================================
class TestWeeklyScheduleStreak:

    def test_streak_continues_across_unscheduled_gap_days(self, monkeypatch, auth_token):
        # Mon/Wed/Fri challenge.
        freeze(monkeypatch, DAY[0])  # Monday
        cid = create_weekly_challenge(auth_token, schedule_days=[1, 3, 5])
        ces = exercise_ids_of(auth_token, cid)
        r_mon = complete_day(auth_token, cid, ces)
        assert r_mon.json()["challenge_streak"] == 1

        freeze(monkeypatch, DAY[2])  # Wednesday — Tuesday wasn't scheduled, shouldn't break streak
        r_wed = complete_day(auth_token, cid, ces)
        assert r_wed.json()["challenge_streak"] == 2

        freeze(monkeypatch, DAY[4])  # Friday
        r_fri = complete_day(auth_token, cid, ces)
        assert r_fri.json()["challenge_streak"] == 3

    def test_missing_a_scheduled_day_breaks_weekly_streak(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])  # Monday
        cid = create_weekly_challenge(auth_token, schedule_days=[1, 3, 5])
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)  # Mon: streak 1

        # Wednesday (DAY[2]) skipped — it WAS scheduled, so this is a real miss.

        freeze(monkeypatch, DAY[4])  # Friday
        r = complete_day(auth_token, cid, ces)
        assert r.json()["challenge_streak"] == 1, "missing a scheduled Wed must break the streak"

    def test_submit_rejected_on_unscheduled_day(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])  # Monday
        cid = create_weekly_challenge(auth_token, schedule_days=[1, 3, 5])
        ces = exercise_ids_of(auth_token, cid)

        freeze(monkeypatch, DAY[1])  # Tuesday — not scheduled
        r = submit(auth_token, cid, ces[0], 10)
        assert r.status_code == 409


# ======================================================================
# 5. Per-challenge streak vs. the user's global (Duolingo-style) streak
# ======================================================================
class TestGlobalVsChallengeStreak:

    def test_global_streak_not_double_counted_for_two_challenges_same_day(
        self, monkeypatch, auth_token
    ):
        freeze(monkeypatch, DAY[0])
        cid1 = create_daily_challenge(auth_token, n_exercises=1, goal=10)
        # second challenge needs its own exercise slot; reuse exercise 2
        payload = {
            "name": "Second challenge", "schedule_type": "daily",
            "start_date": DAY[0].isoformat(),
            "exercises": [{"exercise_id": 2, "goal": 10}],
        }
        cid2 = client.post("/challenges", json=payload, headers=_auth(auth_token)).json()["id"]

        ces1 = exercise_ids_of(auth_token, cid1)
        r1 = complete_day(auth_token, cid1, ces1)
        assert r1.json()["user_streak"] == 1

        ces2 = exercise_ids_of(auth_token, cid2)
        r2 = complete_day(auth_token, cid2, ces2)
        assert r2.json()["user_streak"] == 1, "completing a 2nd challenge same day must not double-bump the global streak"

    def test_global_streak_survives_via_a_different_challenge(self, monkeypatch, auth_token):
        """User streak (across ALL challenges) should keep incrementing as
        long as *something* is done each day, even if it's a different
        challenge each time; but the per-challenge streak for the neglected
        challenge should reset next time it's touched."""
        freeze(monkeypatch, DAY[0])
        cid1 = create_daily_challenge(auth_token, n_exercises=1, goal=10)
        payload = {
            "name": "Backup challenge", "schedule_type": "daily",
            "start_date": DAY[0].isoformat(),
            "exercises": [{"exercise_id": 2, "goal": 10}],
        }
        cid2 = client.post("/challenges", json=payload, headers=_auth(auth_token)).json()["id"]
        ces1 = exercise_ids_of(auth_token, cid1)
        ces2 = exercise_ids_of(auth_token, cid2)
        complete_day(auth_token, cid1, ces1)  # day0 via challenge 1

        freeze(monkeypatch, DAY[1])
        r = complete_day(auth_token, cid2, ces2)  # day1 via challenge 2 instead
        assert r.json()["user_streak"] == 2
        # challenge 1's own streak is untouched by day1's activity elsewhere.
        db = TestingSessionLocal()
        part1 = db.query(Participation).filter_by(challenge_id=cid1).first()
        assert part1.challenge_streak == 1
        db.close()


# ======================================================================
# 6. streak_longest bookkeeping
# ======================================================================
class TestStreakLongest:

    def test_streak_longest_survives_a_reset(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        cid = create_daily_challenge(auth_token)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)
        freeze(monkeypatch, DAY[1])
        complete_day(auth_token, cid, ces)
        freeze(monkeypatch, DAY[2])
        complete_day(auth_token, cid, ces)  # user_streak now 3

        freeze(monkeypatch, DAY[4])  # gap at DAY[3]
        complete_day(auth_token, cid, ces)  # user_streak resets to 1

        me = client.get("/me", headers=_auth(auth_token)).json()
        assert me["streak_current"] == 1
        assert me["streak_longest"] == 3


# ======================================================================
# 7. /me/week accuracy
# ======================================================================
class TestMeWeekAccuracy:

    def test_week_only_lists_fully_closed_days(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])  # Monday of the anchor week
        cid = create_daily_challenge(auth_token, goal=10)
        ces = exercise_ids_of(auth_token, cid)
        complete_day(auth_token, cid, ces)  # Monday fully closed

        freeze(monkeypatch, DAY[1])  # Tuesday: only 1 of 3 exercises
        submit(auth_token, cid, ces[0], 10)

        freeze(monkeypatch, DAY[1])
        week = client.get(
            f"/me/week?week_start={DAY[0].isoformat()}", headers=_auth(auth_token)
        ).json()
        assert DAY[0].isoformat() in week["completed_dates"]
        assert DAY[1].isoformat() not in week["completed_dates"], (
            "a partially-completed day must never appear in completed_dates"
        )


# ======================================================================
# 8. Challenge expiry (end_date) — currently unimplemented
# ======================================================================
class TestChallengeExpiry:

    @pytest.mark.xfail(
        reason=(
            "KNOWN GAP: nothing in the codebase checks end_date once it has "
            "passed. There is no scheduler/cron, and neither today()/submit() "
            "compare `day` against challenge.end_date, so an expired challenge "
            "stays fully active forever and keeps accepting sessions."
        ),
        strict=True,
    )
    def test_submit_rejected_after_end_date(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        payload = {
            "name": "Short challenge", "schedule_type": "daily",
            "start_date": DAY[0].isoformat(), "end_date": DAY[0].isoformat(),
            "exercises": [{"exercise_id": 1, "goal": 10}],
        }
        cid = client.post("/challenges", json=payload, headers=_auth(auth_token)).json()["id"]
        ces = exercise_ids_of(auth_token, cid)

        freeze(monkeypatch, DAY[1])  # one day past end_date
        r = submit(auth_token, cid, ces[0], 10)
        assert r.status_code == 409, "should not be possible to submit to an expired challenge"

    @pytest.mark.xfail(
        reason="KNOWN GAP: expired challenges are never auto-archived; my_challenges(status='active') keeps returning them indefinitely.",
        strict=True,
    )
    def test_expired_challenge_moves_out_of_active_list(self, monkeypatch, auth_token):
        freeze(monkeypatch, DAY[0])
        payload = {
            "name": "Short challenge 2", "schedule_type": "daily",
            "start_date": DAY[0].isoformat(), "end_date": DAY[0].isoformat(),
            "exercises": [{"exercise_id": 1, "goal": 10}],
        }
        client.post("/challenges", json=payload, headers=_auth(auth_token))

        freeze(monkeypatch, DAY[5])  # well past end_date
        active = client.get("/me/challenges?status=active", headers=_auth(auth_token)).json()
        names = [c["name"] for c in active]
        assert "Short challenge 2" not in names