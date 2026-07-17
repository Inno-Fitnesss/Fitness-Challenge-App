# Структура базы данных

*[Read in English](./database-structure.md)*

WowFit использует PostgreSQL 16. Схема организована в три концептуальных слоя: **план** (что представляет собой челлендж), **журнал фактов** (что фактически произошло, записывается один раз и никогда не редактируется) и **вычисляемые данные** (стрики, закрытие дней и объём — всё выводится из журнала фактов). Ещё две таблицы поддерживают интеграции аутентификации и учёт шагов.

## Слой плана

### `users` (пользователи)

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `username` | varchar(50) | уникальное, обязательное |
| `email` | varchar(70) | уникальное, обязательное |
| `password_hash` | varchar(250) | bcrypt-хеш, обязательное |
| `google_sub` | varchar(64) | уникальное; идентификатор субъекта Google OAuth, устанавливается при создании или привязке аккаунта через Google-вход; null для аккаунтов только с паролем |
| `reset_code_hash` | varchar(250) | bcrypt-хеш текущего кода восстановления пароля |
| `reset_code_expires_at` | timestamp | |
| `reset_code_attempts` | integer, по умолчанию 0 | отслеживает неудачные попытки восстановления |
| `first_name` | varchar(50) | |
| `last_name` | varchar(100) | |
| `height_cm` | integer | |
| `weight_kg` | integer | |
| `fitness_level` | varchar(20) | произвольная строка (например, beginner / intermediate / advanced) |
| `streak_current` | integer, по умолчанию 0 | общий стрик, сквозной по всем челленджам |
| `streak_longest` | integer, по умолчанию 0 | |
| `last_activity_date` | date | последний календарный день, когда пользователь закрыл хотя бы один день по любому челленджу |
| `timezone` | varchar(50), по умолчанию `UTC` | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `exercises` (упражнения)

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `name` | varchar(100) | обязательное |
| `metric` | varchar(20), по умолчанию `reps` | `reps` (повторения) или `seconds` (секунды) |
| `video_url` | varchar(255) | |
| `created_at` | timestamp | |

При запуске заполняется тремя строками: Приседания (reps), Отжимания (reps), Планка (seconds).

### `challenges` (челленджи)

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `name` | varchar(255) | обязательное |
| `description` | text | |
| `created_by` | integer, FK → `users.id` | обязательное |
| `schedule_type` | varchar(20) | `daily` (ежедневно) или `weekly` (еженедельно) |
| `schedule_days` | JSON | массив дней недели по ISO (1–7) для еженедельных челленджей; null для ежедневных |
| `start_date` | date | обязательное |
| `end_date` | date | null означает без ограничения по времени |
| `join_code` | varchar(50) | уникальное, обязательное |
| `is_preset` | boolean, по умолчанию false | |
| `is_public` | boolean, по умолчанию false | челлендж создаётся приватным и может быть опубликован ровно один раз, необратимо |
| `status` | varchar(20), по умолчанию `active` | `active` (активен) или `completed` (завершён) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `challenge_exercises` (упражнения челленджа)

Таблица связи между челленджами и упражнениями, хранящая цель для каждого челленджа.

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `challenge_id` | integer, FK → `challenges.id`, каскадное удаление | обязательное |
| `exercise_id` | integer, FK → `exercises.id` | обязательное |
| `goal` | integer | в единицах метрики упражнения |

Уникальное ограничение на `(challenge_id, exercise_id)`.

## Слой журнала фактов

### `participations` (участия)

Членство пользователя в челлендже и кэш его показателей для таблицы лидеров.

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `user_id` | integer, FK → `users.id` | обязательное |
| `challenge_id` | integer, FK → `challenges.id`, каскадное удаление | обязательное |
| `status` | varchar(20), по умолчанию `active` | `active` или `archived` — архивирование затрагивает только собственное представление пользователя |
| `archived_at` | timestamp | |
| `joined_at` | timestamp | |
| `days_completed` | integer, по умолчанию 0 | |
| `challenge_streak` | integer, по умолчанию 0 | |
| `total_clean_reps` | integer, по умолчанию 0 | |
| `last_closed_date` | date | |

Уникальное ограничение на `(user_id, challenge_id)`.

### `sessions` (тренировки)

Журнал всех отправленных тренировок только на добавление. Никогда не редактируется и не удаляется — это единственный источник истины, из которого выводится весь остальной прогресс.

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `participation_id` | integer, FK → `participations.id` | обязательное |
| `challenge_exercise_id` | integer, FK → `challenge_exercises.id` | обязательное |
| `start_time` | timestamp | |
| `end_time` | timestamp | |
| `total_reps` | integer | |
| `clean_reps` | integer | только чистые повторения засчитываются в дневную цель |
| `duration_seconds` | integer | |
| `created_at` | timestamp | |

## Слой вычисляемых данных

### `challenge_exercise_progress` (прогресс по упражнению)

Прогресс по конкретному упражнению за конкретный день в рамках челленджа.

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `participation_id` | integer, FK → `participations.id`, каскадное удаление | обязательное |
| `challenge_exercise_id` | integer, FK → `challenge_exercises.id` | обязательное |
| `date` | date | локальная дата пользователя |
| `clean_reps` | integer, по умолчанию 0 | |
| `is_closed` | boolean, по умолчанию false | становится true, когда `clean_reps >= goal` |

Уникальное ограничение на `(participation_id, challenge_exercise_id, date)`.

### `challenge_day_progress` (прогресс за день)

Был ли выполнен целиком весь день (все упражнения челленджа).

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `participation_id` | integer, FK → `participations.id`, каскадное удаление | обязательное |
| `date` | date | |
| `is_closed` | boolean, по умолчанию false | становится true, когда все упражнения челленджа закрыты за этот день |
| `closed_at` | timestamp | |

Уникальное ограничение на `(participation_id, date)`.

### `user_exercise_stats` (статистика по упражнениям)

Суммарный объём по каждому пользователю и упражнению, независимо от конкретного челленджа.

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `user_id` | integer, FK → `users.id` | обязательное |
| `exercise_id` | integer, FK → `exercises.id` | обязательное |
| `total_clean_reps` | bigint, по умолчанию 0 | суммарный объём за всё время (повторения или секунды для планки) |

Уникальное ограничение на `(user_id, exercise_id)`.

## Таблицы интеграций

### `withings_connections` (подключения Withings)

По одной записи на пользователя, подключившего аккаунт Withings.

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `user_id` | integer, FK → `users.id`, каскадное удаление | уникальное, обязательное |
| `withings_user_id` | varchar(50) | обязательное |
| `access_token` | varchar(500) | недолговечный (часы) |
| `refresh_token` | varchar(500) | долгоживущий, используется для незаметного обновления токена доступа |
| `token_expires_at` | timestamp | обязательное |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `steps_daily` (шаги по дням)

По одной записи на пользователя за локальный календарный день, заполняется либо синхронизацией с Withings, либо компаньон-приложением.

| Столбец | Тип | Примечания |
|---|---|---|
| `id` | integer, PK | |
| `user_id` | integer, FK → `users.id`, каскадное удаление | обязательное |
| `date` | date | обязательное |
| `step_count` | integer, по умолчанию 0 | обязательное |
| `source` | varchar(30), по умолчанию `unknown` | `withings`, `health_connect` или `healthkit` |
| `synced_at` | timestamp | |

Уникальное ограничение на `(user_id, date)`.

## Связи между сущностями

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

## Эволюция схемы

Приложение управляет изменениями схемы с помощью процедуры, запускаемой при старте, которая применяет аддитивные, идемпотентные инструкции `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` к PostgreSQL (полностью пропускается для SQLite, используемой в локальных тестах, где вся схема создаётся заново каждый раз). Столбцы, добавленные таким образом поверх исходной схемы:

- `challenges.is_public`
- `participations.status`, `participations.archived_at`
- `users.height_cm`, `users.weight_kg`, `users.fitness_level`
- `users.google_sub` (с уникальным индексом)
- `users.reset_code_hash`, `users.reset_code_expires_at`, `users.reset_code_attempts`

Также выполняется одноразовый перенос значений видимости из устаревшего столбца `is_private` в текущий столбец `is_public` — для любой базы данных, где этот столбец ещё сохранился.
