# API Documentation

*[Читать по-русски](./api-documentation.ru.md)*

## Overview

The WowFit backend is a FastAPI application. Every route is mounted from `backend/main.py` and organized into routers by domain. In the deployed app, the frontend serves all API traffic under the `/api` prefix (proxied to the backend), so a route documented here as `POST /auth/login` is reached at `POST /api/auth/login` from the browser. When running the backend directly (e.g. local development on port 8000), the same paths are used without the `/api` prefix.

Interactive Swagger documentation is available at `/docs`, and ReDoc at `/redoc`.

**Authentication:** protected endpoints require `Authorization: Bearer <access_token>`. Admin endpoints require a separate `Authorization: Bearer <admin_token>`, unrelated to any user account.

## Authentication tokens

The API issues three distinct JWT token types:

| Type | Lifetime | Used for |
|---|---|---|
| Access | 30 minutes | Bearer credential on all protected user routes |
| Refresh | 14 days | Exchanged for a new access token at `/auth/refresh` |
| Admin | 2 hours | Bearer credential on admin routes; gated by a shared password, not tied to a user account |

Each token carries a `type` claim so one kind cannot be used in place of another — a refresh token, for example, cannot be used to call a protected route directly.

---

## Auth — `/auth`

### `POST /auth/signup`
Creates a new account.

**Request body**
```json
{
  "username": "string",
  "email": "user@example.com",
  "password": "string",
  "first_name": "string (optional)",
  "last_name": "string (optional)"
}
```

**Response** — `201 Created`
```json
{
  "id": 1,
  "username": "string",
  "email": "user@example.com",
  "first_name": "string",
  "last_name": "string"
}
```

### `POST /auth/login`
Authenticates with email and password.

**Request body**
```json
{ "email": "user@example.com", "password": "string" }
```

**Response**
```json
{ "token": "<access_token>", "refresh_token": "<refresh_token>" }
```

### `POST /auth/refresh`
Exchanges a valid refresh token for a new access token.

**Request body**
```json
{ "refresh_token": "<refresh_token>" }
```

**Response** — same shape as login.

### `POST /auth/google`
Authenticates using a Google ID token obtained on the frontend via Google Identity Services. The token is verified server-side (signature, expiry, issuer, and audience against the configured Google client ID), and the account's email must be marked verified by Google.

**Request body**
```json
{ "id_token": "<google_id_token>" }
```

**Response** — same shape as login.

### `POST /auth/forgot-password`
Sends a 6-digit password reset code by email, valid for 15 minutes.

**Request body**
```json
{ "email": "user@example.com" }
```

### `POST /auth/reset-password`
Completes a password reset using the emailed code.

**Request body**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "new_password": "string",
  "confirm_password": "string"
}
```

---

## Me — `/me` (authenticated)

### `GET /me`
Returns the current user's profile, effective streak, and lifetime exercise volume.

**Response**
```json
{
  "id": 1,
  "username": "string",
  "email": "user@example.com",
  "first_name": "string",
  "last_name": "string",
  "height_cm": 180,
  "weight_kg": 75,
  "fitness_level": "intermediate",
  "timezone": "Europe/Helsinki",
  "streak_current": 5,
  "streak_longest": 12,
  "volume": [
    { "exercise": "Приседания", "metric": "reps", "total": 1200 }
  ]
}
```

### `PATCH /me`
Partially updates the current user's profile. All fields optional.

**Request body**
```json
{
  "username": "string",
  "email": "user@example.com",
  "first_name": "string",
  "last_name": "string",
  "height_cm": 180,
  "weight_kg": 75,
  "fitness_level": "intermediate",
  "timezone": "Europe/Helsinki",
  "new_password": "string",
  "confirm_password": "string"
}
```

**Response** — the updated profile, same shape as `GET /me`.

### `GET /me/today`
Returns what's scheduled today across all of the user's active challenges.

**Response**
```json
[
  {
    "id": 1,
    "name": "string",
    "exercises": [
      {
        "challenge_exercise_id": 5,
        "exercise_id": 1,
        "name": "Приседания",
        "metric": "reps",
        "goal": 30,
        "clean_today": 12,
        "closed": false
      }
    ]
  }
]
```

### `GET /me/challenges?status=active|archived`
Lists the user's challenges filtered by their personal participation status.

**Response**
```json
[
  {
    "id": 1,
    "name": "string",
    "status": "active",
    "is_public": true,
    "is_owner": false,
    "days_completed": 12,
    "challenge_streak": 5
  }
]
```

### `GET /me/week?week_start=YYYY-MM-DD`
Returns the user's weekly progress. Defaults to the current local week starting Monday.

**Response**
```json
{
  "week_start": "2026-07-06",
  "week_end": "2026-07-12",
  "completed_dates": ["2026-07-06", "2026-07-08"],
  "streak_current": 5
}
```

---

## Steps — `/me/steps` (authenticated)

### `POST /me/steps/sync`
Called by the companion mobile app after reading step data from Health Connect or HealthKit. Upserts one row per day — safe to call repeatedly.

**Request body**
```json
{
  "days": [
    { "date": "2026-07-12", "step_count": 8500, "source": "health_connect" }
  ]
}
```

`source` must be `"health_connect"` or `"healthkit"`.

**Response**
```json
{ "synced": 1 }
```

### `GET /me/steps?days=7`
Returns step data for the last N calendar days.

**Response**
```json
{
  "days": [
    { "date": "2026-07-12", "step_count": 8500, "source": "health_connect" }
  ],
  "total_steps": 8500,
  "connected": true,
  "last_synced_at": "2026-07-12T10:00:00"
}
```

---

## Withings — `/me/withings` (authenticated)

### `GET /me/withings/authorize-url`
Returns a Withings OAuth consent URL. The frontend performs a full-page redirect to this URL rather than a background request, since Withings needs to display its own login screen.

**Response**
```json
{ "authorize_url": "https://account.withings.com/oauth2_user/authorize2?..." }
```

### `GET /me/withings/callback?code=&state=`
Withings redirects the browser here after the user accepts or declines the consent screen. The backend exchanges the authorization code for an access/refresh token pair, stores the connection, then redirects back to the frontend's settings page with a success or error indicator.

### `GET /me/withings/status`
**Response**
```json
{ "connected": true }
```

### `POST /me/withings/sync?days=7`
Refreshes the Withings access token if it's close to expiring, pulls the last N days of step data from Withings, and stores it alongside any steps synced from the companion app (tagged `source: "withings"`).

**Response**
```json
{ "synced_days": 7 }
```

---

## Challenges — `/challenges` (authenticated)

### `GET /challenges/presets`
Returns the built-in preset challenges available to join.

**Response**
```json
[
  { "id": 1, "name": "Лёгкий старт", "description": "string", "schedule_type": "daily" }
]
```

### `POST /challenges`
Creates a new challenge, always private, with the creator automatically joined as a participant.

**Request body**
```json
{
  "name": "Утро",
  "description": "string (optional)",
  "schedule_type": "daily",
  "schedule_days": [1, 3, 5],
  "start_date": "2026-07-13",
  "end_date": null,
  "exercises": [
    { "exercise_id": 1, "goal": 30 }
  ]
}
```

`schedule_days` (1–7, Monday–Sunday) is required when `schedule_type` is `"weekly"` and ignored for `"daily"`. `start_date` cannot be in the past. Each exercise's `goal` must be between 1 and 100,000, and exercises may not repeat within a challenge.

**Response** — `201 Created`, the full challenge detail (see below).

### `POST /challenges/join`
Joins a challenge by its join code.

**Request body**
```json
{ "join_code": "AB12CD34" }
```

### `GET /challenges/{challenge_id}`
Returns full challenge detail for the caller.

**Response**
```json
{
  "id": 1,
  "name": "string",
  "description": "string",
  "schedule_type": "daily",
  "schedule_days": null,
  "start_date": "2026-07-13",
  "end_date": null,
  "is_public": false,
  "is_private": true,
  "is_preset": false,
  "status": "active",
  "my_status": "active",
  "is_owner": true,
  "can_edit": true,
  "can_make_public": true,
  "join_code": "AB12CD34",
  "exercises": [
    { "challenge_exercise_id": 5, "exercise_id": 1, "name": "Приседания", "metric": "reps", "goal": 30 }
  ],
  "participants": 1,
  "joined": true
}
```

`status` reflects the caller's own participation status (falling back to the challenge's own lifecycle status if the caller isn't a participant). `join_code` is only included for the challenge's creator. `can_edit` and `can_make_public` are both `false` once the challenge is public.

### `PATCH /challenges/{challenge_id}`
Edits a challenge — name, description, schedule, dates, and/or exercise list. Only the creator may edit, and only while the challenge is still private.

**Response** — the updated challenge detail, same shape as `GET /challenges/{challenge_id}`.

### `POST /challenges/{challenge_id}/publish`
Makes a private challenge public. Irreversible — further edits are locked, and the challenge becomes open to new joins. Only the creator may call this, and only once.

### `POST /challenges/{challenge_id}/archive`
Archives the caller's own participation. The challenge and leaderboard are unaffected for other participants.

**Response**
```json
{ "id": 1, "status": "archived" }
```

### `POST /challenges/{challenge_id}/resume`
Reactivates a previously archived participation, flipping the caller's own view back to active.

**Response**
```json
{ "id": 1, "status": "active" }
```

### `DELETE /challenges/{challenge_id}`
Removes the caller's participation entirely. When a challenge's last participation is removed, the challenge itself is deleted (presets are exempt).

### `POST /challenges/{challenge_id}/join`
Joins a challenge by its numeric ID, as an alternative to joining by code.

### `POST /challenges/{challenge_id}/leave`
Leaves a challenge (equivalent to deleting the caller's participation).

### `GET /challenges/{challenge_id}/leaderboard`
Returns the ranked leaderboard for a challenge.

**Response**
```json
[
  {
    "place": 1,
    "username": "string",
    "days_completed": 12,
    "challenge_streak": 5,
    "user_streak": 8,
    "total_clean_reps": 900
  }
]
```

Participants are ranked by challenge streak first, then total days completed, then total clean reps, then join date (earlier joiners rank higher on a full tie). `user_streak` reflects the participant's global, cross-challenge streak, shown alongside their streak within this specific challenge.

### `POST /challenges/{challenge_id}/sessions`
Submits a completed, camera-verified exercise session.

**Request body**
```json
{
  "challenge_exercise_id": 5,
  "total_reps": 34,
  "clean_reps": 30,
  "duration_seconds": 95
}
```

**Response**
```json
{
  "exercise": { "clean": 30, "goal": 30, "closed": true },
  "day_closed": true,
  "challenge_streak": 4,
  "user_streak": 7,
  "place": 2
}
```

Submitting a session updates the exercise's progress for the current day; once every exercise in the challenge is closed for the day, the day itself closes, the participant's streak and completed-day count update, and the global user streak advances once for that calendar day.

---

## Exercises — `/exercises` (authenticated)

### `GET /exercises`
Returns the exercise catalog: squats, push-ups, and plank.

**Response**
```json
[
  { "id": 1, "name": "Приседания", "metric": "reps" },
  { "id": 2, "name": "Отжимания", "metric": "reps" },
  { "id": 3, "name": "Планка", "metric": "seconds" }
]
```

---

## Public — `/public`

### `GET /public/challenge/{join_code}`
Returns an unauthenticated preview of a challenge — its detail and leaderboard — for invite-link landing pages. No authentication required.

### `POST /public/challenge/{join_code}/join` (authenticated)
Joins a challenge via its invite code.

---

## Admin — `/admin`

### `POST /admin/login`
Authenticates against the admin dashboard's shared password.

**Request body**
```json
{ "password": "string" }
```

**Response**
```json
{ "token": "<admin_token>" }
```

### `GET /admin/stats` (admin-authenticated)
Returns platform-wide analytics for the admin dashboard.

**Response**
```json
{
  "total_users": 250,
  "challenges": {
    "total": 40,
    "by_duration": [{ "label": "string", "value": 0 }],
    "by_visibility": [{ "label": "string", "value": 0 }],
    "by_schedule": [{ "label": "string", "value": 0 }],
    "by_exercise_count": [{ "label": "string", "value": 0 }]
  },
  "top_streaks": [{ "username": "string", "streak_longest": 30 }],
  "exercise_totals": [{ "exercise": "string", "total": 5000, "unit": "повторений" }],
  "registrations_daily": [{ "date": "2026-07-12", "count": 5 }]
}
```

---

## System

### `GET /health`
Health check.

**Response**
```json
{ "status": "Running...." }
```

### `GET /protected` (authenticated)
Example endpoint returning the current authenticated user, used for testing the auth flow.
