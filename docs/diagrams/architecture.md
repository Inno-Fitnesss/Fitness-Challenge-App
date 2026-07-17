# Architecture

*[Читать по-русски](./architecture.ru.md)*

## System overview

WowFit runs as three containers, orchestrated with Docker Compose:

```
                        ┌───────────────────────────────┐
    Browser  ─────────▶ │  frontend (nginx)               │
                        │  - serves the built React app   │
                        │  - proxies /api, /docs, /redoc,  │
                        │    /openapi.json to the backend  │
                        └───────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  backend (FastAPI / Uvicorn)    │
                        │  router → service → data model  │
                        └───────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  db (PostgreSQL 16)             │
                        └───────────────────────────────┘
```

The frontend container is built in two stages: the React app is compiled with Vite, and the resulting static files are served by nginx, which also reverse-proxies API traffic to the backend container over the internal Docker network — so the browser only ever talks to a single origin, with no CORS handling required on the client side.

Deployment is continuous: every push to the `main` branch triggers a GitHub Actions workflow that connects to the deployment server over SSH and rebuilds the Docker Compose stack, so `main` is always what's running in production at [hi-baam.space](https://hi-baam.space/).

## Backend layering

The backend follows a strict `router → service → data model` layering. Routers are thin — they parse the request, call a single service method, and return its result. All business logic, validation, and orchestration live in the service layer.

```
backend/app/
  core/
    database.py       SQLAlchemy engine and session management
    mailer.py          SMTP email delivery, with a logging fallback when SMTP isn't configured
    scheduling.py       Date and streak calculation helpers
    security/
      authHandler.py     JWT issuing and verification (access, refresh, and admin tokens)
      googleVerifier.py   Google ID token verification
      hashHelper.py        Password hashing with bcrypt
  db/
    models/            SQLAlchemy ORM models
    schema/             Pydantic request and response models
  routers/             One thin router per domain
  service/             Business logic, one class per domain
  util/
    init_db.py           Table creation, schema migrations, and seed data, run at startup
    protectRoute.py        FastAPI dependencies enforcing user and admin authentication
```

## Authentication and authorization

Users can authenticate with email and password or with Google Sign-In. Passwords are hashed with bcrypt; Google authentication verifies the ID token's signature, expiry, issuer, and audience against the app's configured Google client ID, and only trusts an email address Google itself has marked as verified.

Three distinct JWT token types are issued, each carrying a `type` claim so that one kind cannot be substituted for another:

- **Access tokens** (30 minutes) authenticate all protected user routes.
- **Refresh tokens** (14 days) are only accepted at the token-refresh endpoint.
- **Admin tokens** (2 hours) authenticate the admin dashboard, gated by a single shared password rather than a user account.

A forgotten password is recovered through a 6-digit code emailed to the user, valid for 15 minutes. If outgoing email isn't configured, the code is written to the server's logs instead, so the flow remains fully testable without an SMTP provider.

## The core gameplay loop: sessions, streaks, and leaderboards

Submitting an exercise session is the central write operation in the system. When a session is submitted:

1. The system validates that the user's participation and the challenge are both active, that the exercise belongs to the challenge, and that today is actually a scheduled day for that challenge.
2. An immutable row is appended to the `sessions` table — this raw log is never edited and is the ultimate source of truth for everything derived from it.
3. The submitted clean reps are added to that exercise's progress for the day. Once an exercise's cumulative clean reps for the day meet its goal, that exercise is marked closed for the day.
4. Once every exercise in the challenge is closed for the day, the day itself closes:
   - The participant's completed-days count increases by one.
   - Their **per-challenge streak** extends by one if the previous scheduled day (per that challenge's own daily or weekly schedule) was also closed; otherwise it resets to one.
   - The user's **global streak** — a single, calendar-day-based streak shared across all of a user's challenges — advances once for that calendar day, regardless of how many challenges or exercises were completed.

Because streak values are only updated at the moment a day is actually closed, a missed day doesn't proactively reset anything in the database — instead, the current, correct streak is recomputed at read time whenever a user's profile or weekly view is requested, so a missed day always displays accurately without needing a background job.

Concurrent submissions to the same participation are protected with row-level locking, ensuring that simultaneous session submissions can't silently lose progress through a race condition.

**Leaderboard ranking**, for a given challenge, orders participants by:
1. Per-challenge streak, descending
2. Days completed, descending
3. Total clean reps, descending
4. Join date, ascending (earlier joiners rank higher on a full tie)

Each leaderboard row also displays the participant's global streak alongside their per-challenge streak, since the two track different things — one challenge's cadence versus the user's overall consistency across everything they participate in.

When a session submission advances the global streak, the frontend queues a celebration: the dashboard's streak flame plays a short fire animation the next time it renders, then settles back to its resting frame.

## Preset challenges

To ensure the app never launches with an empty challenge list, ten preset challenges spanning different exercises, goals, and schedules are seeded automatically on every backend startup. They are owned by a single, automatically created system account and are created directly in the public state, skipping the private-then-publish flow that real users go through. Re-running the seed on a later startup updates any changed preset content in place rather than creating duplicates, so redeploying is always safe.

## Challenge lifecycle: archive, resume, and expiry

Leaving a challenge active isn't required to stay on its leaderboard — a participant can personally archive a challenge, which only changes their own view and has no effect on other participants or the leaderboard. Archiving can be reversed at any time by resuming.

An expired challenge (its end date has passed) can still technically be resumed at the API level — the backend applies no expiry check when flipping a participation back to active. The frontend enforces this restriction on its own by hiding or disabling the resume action once a challenge's end date has passed, so the practical restriction currently lives in the client rather than the API itself.

## Client-side computer vision pipeline

Exercise verification happens entirely on the client. The frontend loads a MediaPipe Pose Landmarker model at runtime and processes the webcam feed locally in the browser — no video is ever uploaded to the backend. Body joint angles are computed from the detected pose landmarks each frame and fed into a per-exercise state machine that counts push-ups, squats, and plank holds, providing live visual feedback and audio cues as reps are confirmed. On mobile, the camera view locks to a 3:4 aspect ratio and accounts for device orientation so the pose model always receives a consistently framed feed.

The rep-counting thresholds were calibrated in a standalone prototype against a set of labeled push-up videos before being ported into the production app. Once a session ends, only its aggregate result — total reps, clean reps, and duration — is sent to the backend, which treats that reported result as authoritative; the backend has no visibility into the underlying video or frame-by-frame pose data.

## Step tracking

Daily step counts are stored in a single table, populated from two independent sources:

- **Withings**, via a standard OAuth2 connection flow. Once connected, the backend periodically refreshes the access token as needed and pulls recent daily step totals from Withings' activity API.
- **A companion mobile app**, which reads step data from Android Health Connect or Apple HealthKit and pushes it to the backend directly. This keeps working for users without a Withings device.

Both sources write into the same underlying step data, disambiguated by their origin, so the rest of the app — the profile's steps widget, in particular — doesn't need to know or care which source a given day's step count came from.

## Mobile UI layer

On top of the shared backend and API, the frontend includes a dedicated mobile experience: a separate onboarding flow, mobile-specific layouts for the dashboard, content feed, and challenge browsing (carousel navigation, tabs, and a floating action button), and a mobile exercise-session screen with a locked camera aspect ratio and device-orientation handling, tailored to the constraints of an in-hand phone workout. The streak celebration animation and refreshed component styling (badges, streak widget) apply across both desktop and mobile.
