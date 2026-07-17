"""
Archive / resume / delete / ownership edge cases that go beyond the happy
paths already covered in test_challenges.py (basic archive-by-creator,
resume, delete-purges-when-last-participant, archived-stays-on-leaderboard).

Focus here: things that are personal-per-participation vs. things that are
global to the challenge, and what happens to a challenge once its creator is
no longer part of it.
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.db.models.challenge import Exercise, Challenge

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_archive_delete.db"

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
    # drop_all first: без него оборванный прошлый прогон оставляет данные в
    # sqlite-файле, и вставка упражнений с фиксированными id падает по UNIQUE.
    Base.metadata.drop_all(bind=engine)
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
    }
    client.post("/auth/signup", json=data)
    resp = client.post("/auth/login", json={"email": email, "password": "Test123!"})
    return resp.json()["token"]


@pytest.fixture
def auth_token():
    return _register("owner", "owner@example.com")


@pytest.fixture
def auth_token2():
    return _register("member", "member@example.com")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def create_challenge(token, public=False):
    payload = {
        "name": "Edge Case Challenge",
        "schedule_type": "daily",
        "start_date": date.today().isoformat(),
        "exercises": [{"exercise_id": 1, "goal": 10}],
    }
    cid = client.post("/challenges", json=payload, headers=_auth(token)).json()["id"]
    if public:
        client.post(f"/challenges/{cid}/publish", headers=_auth(token))
    return cid


def join_code_of(token, cid):
    return client.get(f"/challenges/{cid}", headers=_auth(token)).json()["join_code"]


def _insert_preset_directly(name="Preset Push-ups"):
    """Presets aren't created via the API (no endpoint for it) — insert one
    straight into the DB the way a seed script would."""
    db = TestingSessionLocal()
    ch = Challenge(
        name=name, description="", created_by=1, schedule_type="daily",
        start_date=date.today(), is_preset=True, is_public=True, status="active",
        join_code=f"PRESET{name[:6].upper()}",
    )
    db.add(ch)
    db.commit()
    db.refresh(ch)
    cid = ch.id
    db.close()
    return cid


# ======================================================================
# Archive is per-participation, not global
# ======================================================================
class TestArchivePersonalScope:

    def test_non_creator_participant_can_archive_own_view(self, auth_token, auth_token2):
        cid = create_challenge(auth_token, public=True)
        client.post("/challenges/join", json={"join_code": join_code_of(auth_token, cid)},
                    headers=_auth(auth_token2))
        r = client.post(f"/challenges/{cid}/archive", headers=_auth(auth_token2))
        assert r.status_code == 200

    def test_one_participant_archiving_does_not_affect_another(self, auth_token, auth_token2):
        cid = create_challenge(auth_token, public=True)
        client.post("/challenges/join", json={"join_code": join_code_of(auth_token, cid)},
                    headers=_auth(auth_token2))
        client.post(f"/challenges/{cid}/archive", headers=_auth(auth_token2))

        owner_active = client.get("/me/challenges?status=active", headers=_auth(auth_token)).json()
        assert any(c["id"] == cid for c in owner_active)
        member_active = client.get("/me/challenges?status=active", headers=_auth(auth_token2)).json()
        assert not any(c["id"] == cid for c in member_active)

    def test_resume_when_already_active_is_idempotent(self, auth_token):
        cid = create_challenge(auth_token)
        r = client.post(f"/challenges/{cid}/resume", headers=_auth(auth_token))
        assert r.status_code == 200
        assert r.json()["status"] == "active"

    def test_resume_by_non_participant_404(self, auth_token, auth_token2):
        cid = create_challenge(auth_token)
        r = client.post(f"/challenges/{cid}/resume", headers=_auth(auth_token2))
        assert r.status_code == 404

    def test_archive_by_non_participant_404(self, auth_token, auth_token2):
        cid = create_challenge(auth_token)
        r = client.post(f"/challenges/{cid}/archive", headers=_auth(auth_token2))
        assert r.status_code == 404


# ======================================================================
# Delete / leave semantics
# ======================================================================
class TestDeleteOwnershipEdgeCases:

    def test_creator_leaving_keeps_challenge_for_remaining_members(self, auth_token, auth_token2):
        cid = create_challenge(auth_token, public=True)
        client.post("/challenges/join", json={"join_code": join_code_of(auth_token, cid)},
                    headers=_auth(auth_token2))

        r = client.post(f"/challenges/{cid}/leave", headers=_auth(auth_token))
        assert r.status_code == 200
        assert r.json()["challenge_removed"] is False

        # Still visible/joinable info-wise to the remaining participant.
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token2)).json()
        assert detail["id"] == cid

    def test_challenge_becomes_uneditable_after_creator_leaves(self, auth_token, auth_token2):
        """Once the creator's own participation is gone, created_by still
        points at them, so is_owner is False for every remaining participant
        (including the ex-creator, who's no longer a participant at all) —
        the challenge is permanently locked out of edits from this point on."""
        cid = create_challenge(auth_token, public=True)
        client.post("/challenges/join", json={"join_code": join_code_of(auth_token, cid)},
                    headers=_auth(auth_token2))
        client.post(f"/challenges/{cid}/leave", headers=_auth(auth_token))

        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token2)).json()
        assert detail["is_owner"] is False
        assert detail["can_edit"] is False

    def test_deleting_and_rejoining_resets_progress(self, auth_token, auth_token2):
        cid = create_challenge(auth_token, public=True)
        client.post("/challenges/join", json={"join_code": join_code_of(auth_token, cid)},
                    headers=_auth(auth_token2))
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token2)).json()
        ce_id = detail["exercises"][0]["challenge_exercise_id"]
        client.post(f"/challenges/{cid}/sessions",
                    json={"challenge_exercise_id": ce_id, "total_reps": 10, "clean_reps": 10},
                    headers=_auth(auth_token2))

        client.post(f"/challenges/{cid}/leave", headers=_auth(auth_token2))
        client.post("/challenges/join", json={"join_code": join_code_of(auth_token, cid)},
                    headers=_auth(auth_token2))

        board = client.get(f"/challenges/{cid}/leaderboard", headers=_auth(auth_token2)).json()
        rejoined = next(row for row in board if row["username"] == "member")
        assert rejoined["days_completed"] == 0
        assert rejoined["challenge_streak"] == 0

    def test_delete_nonexistent_challenge_404(self, auth_token):
        r = client.delete("/challenges/999999", headers=_auth(auth_token))
        assert r.status_code in (403, 404)

    def test_preset_challenge_survives_last_participant_leaving(self, auth_token):
        cid = _insert_preset_directly()
        r = client.post(f"/challenges/{cid}/join", headers=_auth(auth_token))
        assert r.status_code == 201

        r = client.delete(f"/challenges/{cid}", headers=_auth(auth_token))
        assert r.status_code == 200
        assert r.json()["challenge_removed"] is False, (
            "presets must never be purged from the DB even with zero participants"
        )

        # Still fetchable/joinable afterwards.
        detail = client.get(f"/challenges/{cid}", headers=_auth(auth_token)).json()
        assert detail["id"] == cid


# ======================================================================
# Public/preset visibility interactions
# ======================================================================
class TestPresetAndPublicJoinById:

    def test_join_by_id_works_for_preset(self, auth_token):
        cid = _insert_preset_directly()
        r = client.post(f"/challenges/{cid}/join", headers=_auth(auth_token))
        assert r.status_code == 201

    def test_join_by_id_forbidden_for_private_challenge(self, auth_token, auth_token2):
        cid = create_challenge(auth_token, public=False)
        r = client.post(f"/challenges/{cid}/join", headers=_auth(auth_token2))
        assert r.status_code == 403

    def test_join_by_id_allowed_once_made_public(self, auth_token, auth_token2):
        cid = create_challenge(auth_token, public=True)
        r = client.post(f"/challenges/{cid}/join", headers=_auth(auth_token2))
        assert r.status_code == 201

    def test_cannot_join_own_challenge_twice_via_different_routes(self, auth_token):
        cid = create_challenge(auth_token, public=True)
        # Creator already auto-joined at creation time.
        r = client.post(f"/challenges/{cid}/join", headers=_auth(auth_token))
        assert r.status_code == 409

        code = join_code_of(auth_token, cid)
        r2 = client.post("/challenges/join", json={"join_code": code}, headers=_auth(auth_token))
        assert r2.status_code == 409


# ======================================================================
# make_public interactions with archive
# ======================================================================
class TestPublicAndArchiveInteraction:

    def test_owner_can_still_archive_own_participation_after_publish(self, auth_token):
        cid = create_challenge(auth_token, public=True)
        r = client.post(f"/challenges/{cid}/archive", headers=_auth(auth_token))
        assert r.status_code == 200

    def test_archived_owner_participation_does_not_block_others_joining(
        self, auth_token, auth_token2
    ):
        cid = create_challenge(auth_token, public=True)
        client.post(f"/challenges/{cid}/archive", headers=_auth(auth_token))
        r = client.post(f"/challenges/{cid}/join", headers=_auth(auth_token2))
        assert r.status_code == 201