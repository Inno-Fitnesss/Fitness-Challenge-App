# WowFit Challenges

**"Duolingo for sport."** A mobile-first web app where users create or join fitness challenges (push-ups, squats, planks), get their reps counted by an on-device computer-vision model, and compete on a per-challenge leaderboard while building a daily streak.

- **Team:** Green Team · **Track:** Industrial
- **Live app:** [hi-baam.space](https://hi-baam.space/)
- **Admin dashboard:** [hi-baam.space/admin](https://hi-baam.space/admin)
- **Docs:** [`docs/`](./docs) — API contract (`challenges-api.md`) and DB schema (`db-documentation.md`)


## Project Overview

Create a challenge (e.g. "50 squats, Mon/Wed/Fri"), share a join code or invite link, and compete on a shared leaderboard. Reps aren't self-reported: the frontend loads MediaPipe's Pose Landmarker model from a CDN, tracks joint angles in the browser, and counts clean reps with a calibrated state machine (tuned against labeled push-up videos in `data/pushup/` — see `cv-improve/README.md`). The raw session (`total_reps`, `clean_reps`, `duration`) is sent to the backend, which is the sole source of truth for streaks, day-closing, and leaderboard rank.

Users can also sign in with Google, recover a forgotten password by email, and connect Withings to auto-sync daily steps.

## Features

- 🏋️ **Challenges** — create with one or more exercises, per-exercise goals, and a daily/weekly schedule; join via code or invite link; built-in public presets.
- 📷 **Camera-verified sessions** — real-time MediaPipe pose detection counts push-ups, squats, and planks with live feedback.
- 🔥 **Streaks & 🏆 leaderboards** — computed server-side from the raw session log, never self-reported.
- 📅 **Daily/weekly plan** — `/me/today` and `/me/week` surface what's due.
- 🔐 **Auth** — email/password (JWT), Google Sign-In, forgot/reset password via email.
- 👣 **Withings integration** — OAuth2 connect flow, syncs daily steps.
- 📰 **Content feed** and 🧭 **onboarding tour** for new users.
- 📊 **Admin dashboard** — separate password login; total users, challenge breakdown, top streaks, exercise volume, daily registrations.
- 🧪 **Tests** — `pytest` (backend), `vitest` + `Playwright` (frontend).
- 🐳 **One-command setup**, auto-deployed on push to `main`.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite 5, React Router 7, Tailwind CSS |
| **Frontend libs** | `axios`, `react-hook-form` + `zod`, `recharts` (admin charts), `@react-oauth/google` |
| **Computer vision** | MediaPipe Pose Landmarker, loaded from a CDN at runtime (not an npm dependency) |
| **Backend** | Python 3.12, FastAPI, Uvicorn, SQLAlchemy, Alembic |
| **Backend auth** | `pyjwt`, `bcrypt`, `google-auth` |
| **Database** | PostgreSQL 16 |
| **Integrations** | Withings API (OAuth2), SMTP email (password resets) |
| **Infra** | Docker Compose; frontend image is `nginx:alpine` serving the built SPA and proxying `/api/*` to the backend (no separate nginx service) |
| **CI/CD** | GitHub Actions — push to `main` auto-deploys via SSH + `docker compose up -d --build` |

## Project Structure

```
backend/
  main.py              Mounts all routers; runs create_tables()/sync_schema()/seed_exercises()
  app/
    core/              DB session, mailer (SMTP), JWT/Google/bcrypt security helpers
    db/models/         user, challenge, steps, withings
    db/schema/         Pydantic schemas
    routers/           auth, admin, challenges, exercises, me, public, steps, withings
    service/           business logic per domain
  tests/               pytest suite

frontend/
  src/
    api/               axios client + one module per backend domain
    components/        admin/ challenges/ dashboard/ profile/ session/ auth/ articles/ onboarding/ ui/
    cv/poseCvEngine.ts  MediaPipe loading + rep-counting state machine
    pages/             Dashboard, ChallengesPage, ProfilePage, AdminPage, ExerciseSessionPage, FeedPage, ...
  e2e/                 Playwright tests

cv-improve/            Standalone prototype used to calibrate the rep-counting algorithm
data/pushup/           Labeled videos + landmark arrays used for that calibration
docs/                  API contract, DB schema, and reports
docker-compose.yml     db + backend + frontend (the one actually used — backend/docker-compose.yml is a stale leftover)
package.json           Root-level; NOT the frontend's — unused react-native-health deps, no matching app
```

## API Overview

All routers mount in `backend/main.py`; in production everything is also reachable under `/api/*` via the frontend's nginx proxy.

| Prefix | Purpose |
|---|---|
| `/auth` | signup, login, refresh, Google login, forgot/reset password |
| `/challenges` | create, edit, publish/archive/resume/delete, join (by code or id)/leave, presets, `GET /{id}/leaderboard`, `POST /{id}/sessions` |
| `/exercises` | exercise catalog (squat / push-up / plank) |
| `/me` | profile + streak, `/today`, `/week`, `/challenges?status=` |
| `/me/steps` | daily step data |
| `/me/withings` | OAuth connect/callback/status/sync |
| `/public` | unauthenticated invite preview + join |
| `/admin` | admin login + `/stats` (analytics) |

**Data model** (full detail in `docs/db-documentation.md`): a **plan** layer (`users`, `exercises`, `challenges`, `challenge_exercises`), a **fact log** (`participations`, an append-only `sessions` table — the source of truth), and a **server-computed** layer (`challenge_exercise_progress`, `challenge_day_progress`, `user_exercise_stats`) for streaks, day-closing, and volume. A challenge starts private and can be made public exactly once (irreversible).

## Getting Started

### Docker (recommended)

```bash
docker compose up --build
```

| Service | Host binding |
|---|---|
| `db` (Postgres 16) | `5432` |
| `backend` | `127.0.0.1:8001` |
| `frontend` | `127.0.0.1:3000` |

### Without Docker

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt      # or requirements-dev.txt for pytest
cp .env.example .env                 # only DATABASE_URL + JWT_SECRET are required; rest are optional feature toggles
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Optional env vars (all in `.env.example` files, all safe to leave blank — each just disables one feature):
`GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` (Google Sign-In), `SMTP_*` (password-reset emails, else code is logged instead), `ADMIN_PASSWORD_HASH` (admin dashboard), `WITHINGS_CLIENT_ID`/`SECRET`/`REDIRECT_URI` (see `README-WITHINGS.md`).

**Tests:** `pytest --cov` (backend) · `npm test` / `npm run test:e2e` (frontend)

## Track & Contribution

Built by **Green Team**, Industrial track. Covers: the layered backend (`router → service → repository → Postgres`) for auth, challenges, sessions, and server-computed streaks/leaderboards; the full Withings integration; the in-browser CV pipeline (calibrated in `cv-improve/` against `data/pushup/`, shipped in `frontend/src/cv/`); the broader product surface (feed, onboarding tour, admin dashboard); test coverage on both sides; and CI/CD with auto-deploy.
All team contributions and our week-by-week progress are documented in the [`/docs/reports`](./docs/reports) folder — check there for a full breakdown of who worked on what each week.

---

<p align="center">Built with 💪 by Green Team — Industrial Track</p>
