# Документация API

*[Read in English](./api-documentation.md)*

## Обзор

Бэкенд WowFit — это приложение на FastAPI. Все маршруты подключаются в `backend/main.py` и организованы по роутерам согласно предметной области. В развёрнутом приложении фронтенд обслуживает весь трафик API под префиксом `/api` (проксируя его на бэкенд), поэтому маршрут, задокументированный здесь как `POST /auth/login`, доступен из браузера как `POST /api/auth/login`. При локальном запуске бэкенда напрямую (например, при разработке на порту 8000) используются те же пути без префикса `/api`.

Интерактивная документация Swagger доступна по адресу `/docs`, ReDoc — по адресу `/redoc`.

**Аутентификация:** защищённые эндпоинты требуют заголовок `Authorization: Bearer <access_token>`. Эндпоинты админ-панели требуют отдельный заголовок `Authorization: Bearer <admin_token>`, не связанный ни с одним пользовательским аккаунтом.

## Токены аутентификации

API выпускает три типа JWT-токенов:

| Тип | Время жизни | Назначение |
|---|---|---|
| Access (доступ) | 30 минут | Bearer-токен для всех защищённых пользовательских маршрутов |
| Refresh (обновление) | 14 дней | Обменивается на новый access-токен через `/auth/refresh` |
| Admin (администратор) | 2 часа | Bearer-токен для маршрутов админ-панели; защищён общим паролем, не привязан к аккаунту пользователя |

Каждый токен содержит поле `type`, поэтому один тип токена нельзя использовать вместо другого — например, refresh-токен нельзя напрямую использовать для вызова защищённого маршрута.

---

## Аутентификация — `/auth`

### `POST /auth/signup`
Создаёт новый аккаунт.

**Тело запроса**
```json
{
  "username": "string",
  "email": "user@example.com",
  "password": "string",
  "first_name": "string (опционально)",
  "last_name": "string (опционально)"
}
```

**Ответ** — `201 Created`
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
Аутентификация по email и паролю.

**Тело запроса**
```json
{ "email": "user@example.com", "password": "string" }
```

**Ответ**
```json
{ "token": "<access_token>", "refresh_token": "<refresh_token>" }
```

### `POST /auth/refresh`
Обменивает действующий refresh-токен на новый access-токен.

**Тело запроса**
```json
{ "refresh_token": "<refresh_token>" }
```

**Ответ** — та же структура, что и при входе.

### `POST /auth/google`
Аутентификация с помощью Google ID-токена, полученного на фронтенде через Google Identity Services. Токен проверяется на сервере (подпись, срок действия, издатель и получатель сверяются с настроенным client ID Google), и email аккаунта должен быть отмечен Google как подтверждённый.

**Тело запроса**
```json
{ "id_token": "<google_id_token>" }
```

**Ответ** — та же структура, что и при входе.

### `POST /auth/forgot-password`
Отправляет на почту 6-значный код для сброса пароля, действительный 15 минут.

**Тело запроса**
```json
{ "email": "user@example.com" }
```

### `POST /auth/reset-password`
Завершает сброс пароля с использованием кода из письма.

**Тело запроса**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "new_password": "string",
  "confirm_password": "string"
}
```

---

## Профиль — `/me` (требуется аутентификация)

### `GET /me`
Возвращает профиль текущего пользователя, актуальный стрик и суммарный объём выполненных упражнений.

**Ответ**
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
Частично обновляет профиль текущего пользователя. Все поля необязательны.

**Тело запроса**
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

**Ответ** — обновлённый профиль, та же структура, что и у `GET /me`.

### `GET /me/today`
Возвращает список того, что запланировано на сегодня по всем активным челленджам пользователя.

**Ответ**
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
Список челленджей пользователя с фильтром по личному статусу участия.

**Ответ**
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
Возвращает прогресс пользователя за неделю. По умолчанию — текущая локальная неделя, начинающаяся с понедельника.

**Ответ**
```json
{
  "week_start": "2026-07-06",
  "week_end": "2026-07-12",
  "completed_dates": ["2026-07-06", "2026-07-08"],
  "streak_current": 5
}
```

---

## Шаги — `/me/steps` (требуется аутентификация)

### `POST /me/steps/sync`
Вызывается компаньон-приложением для смартфона после чтения данных о шагах из Health Connect или HealthKit. Выполняет upsert по одной записи на день — безопасно вызывать повторно.

**Тело запроса**
```json
{
  "days": [
    { "date": "2026-07-12", "step_count": 8500, "source": "health_connect" }
  ]
}
```

`source` должен быть `"health_connect"` или `"healthkit"`.

**Ответ**
```json
{ "synced": 1 }
```

### `GET /me/steps?days=7`
Возвращает данные о шагах за последние N календарных дней.

**Ответ**
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

## Withings — `/me/withings` (требуется аутентификация)

### `GET /me/withings/authorize-url`
Возвращает URL для получения согласия OAuth от Withings. Фронтенд выполняет полный переход по этому URL, а не фоновый запрос, поскольку Withings должен показать собственный экран входа.

**Ответ**
```json
{ "authorize_url": "https://account.withings.com/oauth2_user/authorize2?..." }
```

### `GET /me/withings/callback?code=&state=`
Withings перенаправляет браузер сюда после того, как пользователь принял или отклонил экран согласия. Бэкенд обменивает код авторизации на пару токенов доступа/обновления, сохраняет подключение и перенаправляет обратно на страницу настроек фронтенда с индикатором успеха или ошибки.

### `GET /me/withings/status`
**Ответ**
```json
{ "connected": true }
```

### `POST /me/withings/sync?days=7`
Обновляет токен доступа Withings, если срок его действия скоро истекает, забирает данные о шагах за последние N дней из Withings и сохраняет их вместе с шагами, синхронизированными из компаньон-приложения (с пометкой `source: "withings"`).

**Ответ**
```json
{ "synced_days": 7 }
```

---

## Челленджи — `/challenges` (требуется аутентификация)

### `GET /challenges/presets`
Возвращает встроенные готовые челленджи, доступные для присоединения.

**Ответ**
```json
[
  { "id": 1, "name": "Лёгкий старт", "description": "string", "schedule_type": "daily" }
]
```

### `POST /challenges`
Создаёт новый челлендж, всегда приватным, с автоматическим добавлением создателя в участники.

**Тело запроса**
```json
{
  "name": "Утро",
  "description": "string (опционально)",
  "schedule_type": "daily",
  "schedule_days": [1, 3, 5],
  "start_date": "2026-07-13",
  "end_date": null,
  "exercises": [
    { "exercise_id": 1, "goal": 30 }
  ]
}
```

`schedule_days` (1–7, понедельник–воскресенье) обязателен, если `schedule_type` равен `"weekly"`, и игнорируется для `"daily"`. `start_date` не может быть в прошлом. Значение `goal` каждого упражнения должно быть от 1 до 100 000, а упражнения в рамках одного челленджа не могут повторяться.

**Ответ** — `201 Created`, полная информация о челлендже (см. ниже).

### `POST /challenges/join`
Присоединение к челленджу по коду.

**Тело запроса**
```json
{ "join_code": "AB12CD34" }
```

### `GET /challenges/{challenge_id}`
Возвращает полную информацию о челлендже для текущего пользователя.

**Ответ**
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

`status` отражает статус участия самого пользователя (или статус жизненного цикла челленджа, если пользователь не является участником). `join_code` включается в ответ только для создателя челленджа. `can_edit` и `can_make_public` оба становятся `false`, как только челлендж опубликован.

### `PATCH /challenges/{challenge_id}`
Редактирует челлендж — название, описание, расписание, даты и/или список упражнений. Редактировать может только создатель, и только пока челлендж остаётся приватным.

**Ответ** — обновлённая информация о челлендже, та же структура, что у `GET /challenges/{challenge_id}`.

### `POST /challenges/{challenge_id}/publish`
Делает приватный челлендж публичным. Необратимо — дальнейшее редактирование блокируется, а челлендж открывается для новых участников. Вызвать может только создатель, и только один раз.

### `POST /challenges/{challenge_id}/archive`
Архивирует участие текущего пользователя. Челлендж и таблица лидеров не затрагиваются для остальных участников.

**Ответ**
```json
{ "id": 1, "status": "archived" }
```

### `POST /challenges/{challenge_id}/resume`
Возвращает ранее заархивированное участие в активное состояние — меняется только собственный статус пользователя.

**Ответ**
```json
{ "id": 1, "status": "active" }
```

### `DELETE /challenges/{challenge_id}`
Полностью удаляет участие текущего пользователя. Когда удаляется последнее участие в челлендже, сам челлендж удаляется (пресеты являются исключением).

### `POST /challenges/{challenge_id}/join`
Присоединение к челленджу по его числовому ID — альтернатива присоединению по коду.

### `POST /challenges/{challenge_id}/leave`
Выход из челленджа (эквивалентно удалению участия текущего пользователя).

### `GET /challenges/{challenge_id}/leaderboard`
Возвращает ранжированную таблицу лидеров для челленджа.

**Ответ**
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

Участники ранжируются сначала по стрику в рамках челленджа, затем по числу выполненных дней, затем по общему числу чистых повторений, и затем по дате присоединения (участники, присоединившиеся раньше, занимают более высокое место при полном равенстве). `user_streak` отражает общий, сквозной по всем челленджам стрик участника, показанный рядом со стриком в рамках именно этого челленджа.

### `POST /challenges/{challenge_id}/sessions`
Отправляет завершённую, проверенную по камере тренировку.

**Тело запроса**
```json
{
  "challenge_exercise_id": 5,
  "total_reps": 34,
  "clean_reps": 30,
  "duration_seconds": 95
}
```

**Ответ**
```json
{
  "exercise": { "clean": 30, "goal": 30, "closed": true },
  "day_closed": true,
  "challenge_streak": 4,
  "user_streak": 7,
  "place": 2
}
```

Отправка тренировки обновляет прогресс по упражнению за текущий день; как только все упражнения в челлендже закрыты на этот день, закрывается и сам день, обновляются стрик участника и число выполненных дней, а общий стрик пользователя продвигается на один календарный день.

---

## Упражнения — `/exercises` (требуется аутентификация)

### `GET /exercises`
Возвращает каталог упражнений: приседания, отжимания и планка.

**Ответ**
```json
[
  { "id": 1, "name": "Приседания", "metric": "reps" },
  { "id": 2, "name": "Отжимания", "metric": "reps" },
  { "id": 3, "name": "Планка", "metric": "seconds" }
]
```

---

## Публичные эндпоинты — `/public`

### `GET /public/challenge/{join_code}`
Возвращает неаутентифицированный предпросмотр челленджа — его описание и таблицу лидеров — для страниц-приглашений. Аутентификация не требуется.

### `POST /public/challenge/{join_code}/join` (требуется аутентификация)
Присоединение к челленджу по коду приглашения.

---

## Админ-панель — `/admin`

### `POST /admin/login`
Аутентификация по общему паролю админ-панели.

**Тело запроса**
```json
{ "password": "string" }
```

**Ответ**
```json
{ "token": "<admin_token>" }
```

### `GET /admin/stats` (требуется аутентификация администратора)
Возвращает аналитику по всей платформе для админ-панели.

**Ответ**
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

## Системные эндпоинты

### `GET /health`
Проверка работоспособности.

**Ответ**
```json
{ "status": "Running...." }
```

### `GET /protected` (требуется аутентификация)
Пример эндпоинта, возвращающего текущего аутентифицированного пользователя; используется для проверки работы аутентификации.
