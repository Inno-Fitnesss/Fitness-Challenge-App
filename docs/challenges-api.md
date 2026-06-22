# Challenges API — архитектура бэкенда

Компактный контракт API по челленджам. Одна БД (схема v2 из `db-documentation.md`), общая таблица `users`, поверх — JWT.

## Контекст

- Слои: `router -> service -> repository -> PostgreSQL`. Роутеры тонкие, логика в сервисах.
- Префикс всех путей: `/api`. Формат: JSON.
- Авторизация: JWT в заголовке `Authorization: Bearer <token>`. Обязателен везде, кроме `auth/*` и `health`.
- Кто делает запрос — берём из токена (`get_current_user` -> `user_id`), НЕ из тела. `created_by`, `participations.user_id` ставит сервер.
- Весь подсчёт (закрытие дня, стрик, место) — на сервере; клиент шлёт сырую сессию.

## Карта эндпоинтов

### Auth (есть, общая таблица users)
| Метод | Путь | Назначение |
|---|---|---|
| POST | /api/auth/signup | регистрация (username, email, password) |
| POST | /api/auth/login | вход -> JWT |
| GET | /api/me | текущий юзер: огонёк + счётчики объёма |
| GET | /api/health | проверка живости |

### Challenges
| Метод | Путь | Назначение | Кто |
|---|---|---|---|
| POST | /api/challenges | создать челлендж (упражнения + расписание + срок) | auth |
| GET | /api/challenges/{id} | детали + моё участие + краткий лидерборд | auth |
| PATCH | /api/challenges/{id} | редактировать | создатель |
| POST | /api/challenges/{id}/archive | заморозить (в архив) | создатель |
| GET | /api/challenges/presets | готовые пресеты приложения | auth |
| GET | /api/exercises | каталог упражнений (присед/отжим/планка) | auth |

### Участие
| Метод | Путь | Назначение |
|---|---|---|
| POST | /api/challenges/join | вступить по {join_code} |
| POST | /api/challenges/{id}/join | вступить в пресет / по id |
| POST | /api/challenges/{id}/leave | выйти (удалить своё участие) |

### Сессии и «я»
| Метод | Путь | Назначение |
|---|---|---|
| POST | /api/challenges/{id}/sessions | отправить сырую сессию -> серверный пайплайн |
| GET | /api/challenges/{id}/leaderboard | участники по score + тай-брейкам |
| GET | /api/me/today | план на сегодня (челленджи по расписанию, локальный tz) |
| GET | /api/me/challenges?status=active\|archived | мои челленджи (вкл. архив) |

## Тела/ответы ключевых трёх

### POST /api/challenges
```
{
  "name": "Утро",
  "description": "разминка",
  "schedule_type": "weekly",        // 'daily' | 'weekly'
  "schedule_days": [1, 3, 5],       // для weekly; для daily — null
  "start_date": "2026-06-20",
  "end_date": null,                 // null = бессрочный
  "is_private": true,
  "exercises": [
    { "exercise_id": 1, "goal": 30 },
    { "exercise_id": 3, "goal": 60 }
  ]
}
-> 201 { "id": 12, "join_code": "AB12CD", "status": "active" }
```
Сервер: пишет `challenges` (created_by из токена) + строки `challenge_exercises`, генерит `join_code`.

### POST /api/challenges/join
```
{ "join_code": "AB12CD" }
-> 201 { "participation_id": 88, "challenge_id": 12 }
```
Сервер: создаёт `participations` (uniqueness не даёт вступить дважды).

### POST /api/challenges/{id}/sessions
```
{ "challenge_exercise_id": 5, "total_reps": 34, "clean_reps": 30, "duration_seconds": 95 }
-> 200 {
  "exercise":   { "clean": 30, "goal": 30, "closed": true },
  "day_closed": true,
  "challenge_streak": 4,
  "user_streak": 7,
  "place": 2
}
```
Сервер (пайплайн): лог в `sessions` -> копит `challenge_exercise_progress` -> если все упражнения дня закрыты -> `challenge_day_progress.is_closed=TRUE`, `days_completed++`, пересчёт стрика, огонёк. Идемпотентно (день засчитывается один раз).

## Какой сервис что трогает
- AuthService — `users`.
- ChallengeService — `challenges`, `challenge_exercises`; archive/edit — статус.
- ParticipationService — `participations`.
- SessionService — `sessions`, `challenge_exercise_progress`, `challenge_day_progress`, `participations`, `user_exercise_stats`, стрик `users`.
- LeaderboardService — `participations` (сортировка по score + тай-брейкам).

## Что нужно для мерджа с JWT
Текущая auth-модель `User` (id, first_name, last_name, email, password, таблица "Users") -> привести к v2: добавить `username`, `password_hash` вместо `password`, `streak_*`, `last_activity_date`, `timezone`, `created_at/updated_at`; таблицу назвать `users`; email в нижнем регистре. После этого auth и челленджи сидят на одной таблице `users`.
