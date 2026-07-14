# Database Structure

*[Читать по-русски](./database-structure.ru.md)*

WowFit uses PostgreSQL 16. The schema is organized into three conceptual layers: **plan** (what a challenge is), **fact log** (what actually happened, recorded once and never edited), and **server-computed** (streaks, day-closing, and volume — all derived from the fact log). Two additional tables support authentication integrations and step tracking.

## Plan layer

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `username` | varchar(50) | unique, required |
| `email` | varchar(70) | unique, required |
| `password_hash` | varchar(250) | bcrypt hash, required |
| `google_sub` | varchar(64) | unique; Google OAuth subject ID, set when the account is created via or linked to Google Sign-In; null for password-only accounts |
| `reset_code_hash` | varchar(250) | bcrypt hash of the current password-reset code |
| `reset_code_expires_at` | timestamp | |
| `reset_code_attempts` | integer, default 0 | tracks failed reset attempts |
| `first_name` | varchar(50) | |
| `last_name` | varchar(100) | |
| `height_cm` | integer | |
| `weight_kg` | integer | |
| `fitness_level` | varchar(20) | free-form (e.g. beginner / intermediate / advanced) |
| `streak_current` | integer, default 0 | global, cross-challenge streak |
| `streak_longest` | integer, default 0 | |
| `last_activity_date` | date | last calendar day the user closed any challenge day |
| `timezone` | varchar(50), default `UTC` | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `exercises`

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `name` | varchar(100) | required |
| `metric` | varchar(20), default `reps` | `reps` or `seconds` |
| `video_url` | varchar(255) | |
| `created_at` | timestamp | |

Seeded on startup with three rows: Squats (Приседания, reps), Push-ups (Отжимания, reps), Plank (Планка, seconds).

### `challenges`

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `name` | varchar(255) | required |
| `description` | text | |
| `created_by` | integer, FK → `users.id` | required |
| `schedule_type` | varchar(20) | `daily` or `weekly` |
| `schedule_days` | JSON | array of ISO weekdays 1–7 for weekly challenges; null for daily |
| `start_date` | date | required |
| `end_date` | date | null = open-ended |
| `join_code` | varchar(50) | unique, required |
| `is_preset` | boolean, default false | |
| `is_public` | boolean, default false | a challenge is created private and can be made public exactly once, irreversibly |
| `status` | varchar(20), default `active` | `active` or `completed` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `challenge_exercises`

Join table between challenges and exercises, carrying a per-challenge goal.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `challenge_id` | integer, FK → `challenges.id`, cascade delete | required |
| `exercise_id` | integer, FK → `exercises.id` | required |
| `goal` | integer | in units of the exercise's metric |

Unique constraint on `(challenge_id, exercise_id)`.

## Fact log layer

### `participations`

A user's membership in a challenge, and the cache of their leaderboard totals.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `user_id` | integer, FK → `users.id` | required |
| `challenge_id` | integer, FK → `challenges.id`, cascade delete | required |
| `status` | varchar(20), default `active` | `active` or `archived` — archiving only affects the caller's own view |
| `archived_at` | timestamp | |
| `joined_at` | timestamp | |
| `days_completed` | integer, default 0 | |
| `challenge_streak` | integer, default 0 | |
| `total_clean_reps` | integer, default 0 | |
| `last_closed_date` | date | |

Unique constraint on `(user_id, challenge_id)`.

### `sessions`

An append-only log of every submitted exercise session. Never edited or deleted — this is the single source of truth all derived progress is computed from.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `participation_id` | integer, FK → `participations.id` | required |
| `challenge_exercise_id` | integer, FK → `challenge_exercises.id` | required |
| `start_time` | timestamp | |
| `end_time` | timestamp | |
| `total_reps` | integer | |
| `clean_reps` | integer | only clean reps count toward a day's goal |
| `duration_seconds` | integer | |
| `created_at` | timestamp | |

## Server-computed layer

### `challenge_exercise_progress`

Per-day, per-exercise progress within a challenge.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `participation_id` | integer, FK → `participations.id`, cascade delete | required |
| `challenge_exercise_id` | integer, FK → `challenge_exercises.id` | required |
| `date` | date | the user's local date |
| `clean_reps` | integer, default 0 | |
| `is_closed` | boolean, default false | true once `clean_reps >= goal` |

Unique constraint on `(participation_id, challenge_exercise_id, date)`.

### `challenge_day_progress`

Whether an entire day (all exercises in the challenge) was completed.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `participation_id` | integer, FK → `participations.id`, cascade delete | required |
| `date` | date | |
| `is_closed` | boolean, default false | true once every exercise for the challenge is closed that day |
| `closed_at` | timestamp | |

Unique constraint on `(participation_id, date)`.

### `user_exercise_stats`

Lifetime volume per user, per exercise, independent of any single challenge.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `user_id` | integer, FK → `users.id` | required |
| `exercise_id` | integer, FK → `exercises.id` | required |
| `total_clean_reps` | bigint, default 0 | all-time volume (reps, or seconds for plank) |

Unique constraint on `(user_id, exercise_id)`.

## Integration tables

### `withings_connections`

One row per user who has linked a Withings account.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `user_id` | integer, FK → `users.id`, cascade delete | unique, required |
| `withings_user_id` | varchar(50) | required |
| `access_token` | varchar(500) | short-lived (hours) |
| `refresh_token` | varchar(500) | long-lived, used to silently renew the access token |
| `token_expires_at` | timestamp | required |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `steps_daily`

One row per user per local calendar day, populated either by the Withings sync or by a companion mobile app.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `user_id` | integer, FK → `users.id`, cascade delete | required |
| `date` | date | required |
| `step_count` | integer, default 0 | required |
| `source` | varchar(30), default `unknown` | `withings`, `health_connect`, or `healthkit` |
| `synced_at` | timestamp | |

Unique constraint on `(user_id, date)`.

## Entity relationships

```
users ──< challenges (created_by)
users ──< participations >── challenges
challenges ──< challenge_exercises >── exercises
participations ──< sessions >── challenge_exercises
participations ──< challenge_exercise_progress >── challenge_exercises
participations ──< challenge_day_progress
users ──< user_exercise_stats >── exercises
users ──< withings_connections
users ──< steps_daily
```

## Schema evolution

The application manages schema changes with a startup routine that applies additive, idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements against PostgreSQL (skipped entirely on SQLite, used for local tests, where the full schema is created fresh each time). The columns introduced this way — layered on top of the original schema — are:

- `challenges.is_public`
- `participations.status`, `participations.archived_at`
- `users.height_cm`, `users.weight_kg`, `users.fitness_level`
- `users.google_sub` (with a unique index)
- `users.reset_code_hash`, `users.reset_code_expires_at`, `users.reset_code_attempts`

A one-time backfill also carries visibility forward from a legacy `is_private` column into the current `is_public` column, for any database that still has it.
