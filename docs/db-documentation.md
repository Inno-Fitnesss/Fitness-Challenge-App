# Database Structure — WowFit Challenges

Документация схемы БД (бэк челленджей). Формат: на каждую таблицу — назначение, колонки, `CREATE TABLE`.

---

## Обзор: три слоя

**Слой 1 — ПЛАН (что нужно делать).** `users`, `exercises`, `challenges`, `challenge_exercises`.
Описывает «что за челлендж, по каким дням, какие упражнения и сколько надо сделать». Участников здесь нет — только шаблон.

**Слой 2 — ЖУРНАЛ ФАКТОВ (что человек реально сделал).** `participations`, `sessions`.
`participations` — кто в какой челлендж вступил (одна строка = один человек в одном челлендже). Это узел, к которому привязан весь личный прогресс; здесь же лежат готовые итоги для лидерборда (число закрытых дней, серия, объём) — денормализованные, чтобы не пересчитывать их при каждом открытии экрана.
`sessions` — сырой лог тренировок (append-only), источник правды: из него можно пересчитать весь остальной прогресс. Поэтому добавить новую аналитику позже не страшно — данные уже есть.

**Слой 3 — ПОСЧИТАННОЕ СЕРВЕРОМ (производное, пересобираемо из лога).** `challenge_exercise_progress`, `challenge_day_progress`, `user_exercise_stats`.
Закрытие дня, стрик, место, объём. **Считает только сервер** — клиент шлёт лишь сырую сессию (`total`/`clean`/`duration`).

| Таблица | Слой | Зачем |
|---|---|---|
| `users` | 1 | люди + огонёк |
| `exercises` | 1 | справочник упражнений |
| `challenges` | 1 | челлендж как замысел (расписание, срок, доступ) |
| `challenge_exercises` | 1 | какие упражнения в челлендже + цель (мульти) |
| `participations` | 2 | участие юзера + итоги для лидерборда |
| `sessions` | 2 | сырой лог тренировок |
| `challenge_exercise_progress` | 3 | прогресс за день по каждому упражнению |
| `challenge_day_progress` | 3 | день челленджа закрыт целиком? |
| `user_exercise_stats` | 3 | глобальный объём по упражнению (флекс) |

---

## Table: users

Люди. Логин + поля огонька (стрика) и таймзона.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID пользователя. |
| username | VARCHAR(50) | UNIQUE NOT NULL | Ник. Виден в лидерборде/огоньках. |
| email | VARCHAR(70) | UNIQUE NOT NULL | Логин. Хранится в нижнем регистре. |
| password_hash | VARCHAR(250) | NOT NULL | Bcrypt-хеш пароля. |
| first_name | VARCHAR(50) | NULLABLE | Имя (опционально). |
| last_name | VARCHAR(100) | NULLABLE | Фамилия (опционально). |
| streak_current | INT | DEFAULT 0 | Огонёк: текущая серия дней. |
| streak_longest | INT | DEFAULT 0 | Рекорд серии (флекс). |
| last_activity_date | DATE | NULLABLE | Дата последней закрытой активности — чтобы понять, не порвалась ли серия. |
| timezone | VARCHAR(50) | DEFAULT 'UTC' | Когда у юзера наступает локальная полночь / новый день. |
| created_at | TIMESTAMP | DEFAULT NOW() | Дата регистрации. |
| updated_at | TIMESTAMP | DEFAULT NOW() | Последнее обновление. |

```sql
CREATE TABLE users (
    id                 SERIAL PRIMARY KEY,
    username           VARCHAR(50)  UNIQUE NOT NULL,
    email              VARCHAR(70)  UNIQUE NOT NULL,
    password_hash      VARCHAR(250) NOT NULL,
    first_name         VARCHAR(50),
    last_name          VARCHAR(100),
    streak_current     INT DEFAULT 0,
    streak_longest     INT DEFAULT 0,
    last_activity_date DATE,
    timezone           VARCHAR(50) DEFAULT 'UTC',
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW()
);
```

---

## Table: exercises

Справочник упражнений (присед, отжимания, планка). Один на всё приложение.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID упражнения. |
| name | VARCHAR(100) | NOT NULL | Название. |
| metric | VARCHAR(20) | NOT NULL DEFAULT 'reps' | Единица цели: `reps` (повторы) или `seconds` (планка). Убирает двусмысленность `goal`. |
| video_url | VARCHAR(255) | NULLABLE | Ссылка на видео техники. |
| created_at | TIMESTAMP | DEFAULT NOW() | Время добавления. |

```sql
CREATE TABLE exercises (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    metric     VARCHAR(20)  NOT NULL DEFAULT 'reps',  -- 'reps' | 'seconds'
    video_url  VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO exercises (name, metric) VALUES
    ('Приседания', 'reps'), ('Отжимания', 'reps'), ('Планка', 'seconds');
```

---

## Table: challenges

Челлендж как замысел: расписание, срок, доступ, статус. Участников и прогресса здесь нет.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID челленджа. |
| name | VARCHAR(255) | NOT NULL | Название. |
| description | TEXT | NULLABLE | Описание (опционально). |
| created_by | INT | NOT NULL REFERENCES users(id) | Создатель. |
| schedule_type | VARCHAR(20) | NOT NULL | `daily` или `weekly`. |
| schedule_days | JSONB | NULLABLE | Массив дней `[1..7]` (ISO, 1=Пн) для `weekly`; для `daily` — NULL. |
| start_date | DATE | NOT NULL | Дата начала. |
| end_date | DATE | NULLABLE | Дата окончания. NULL = бессрочный. |
| join_code | VARCHAR(50) | UNIQUE NOT NULL | Код для входа по ссылке. |
| is_preset | BOOLEAN | DEFAULT FALSE | Готовый челлендж-пресет от приложения. |
| is_private | BOOLEAN | DEFAULT TRUE | TRUE = только по коду/ссылке, FALSE = публичный. |
| status | VARCHAR(20) | NOT NULL DEFAULT 'active' | `active` / `completed` (истёк срок) / `archived` (закрыт вручную). |
| archived_at | TIMESTAMP | NULLABLE | Когда заархивирован вручную. |
| created_at | TIMESTAMP | DEFAULT NOW() | Время создания. |
| updated_at | TIMESTAMP | DEFAULT NOW() | Последнее обновление. |

```sql
CREATE TABLE challenges (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    created_by    INT NOT NULL REFERENCES users(id),
    schedule_type VARCHAR(20) NOT NULL,                  -- 'daily' | 'weekly'
    schedule_days JSONB,                                 -- [1..7] для weekly, NULL для daily
    start_date    DATE NOT NULL,
    end_date      DATE,                                  -- NULL = бессрочный
    join_code     VARCHAR(50) UNIQUE NOT NULL,
    is_preset     BOOLEAN DEFAULT FALSE,
    is_private    BOOLEAN DEFAULT TRUE,
    status        VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'archived'
    archived_at   TIMESTAMP,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);
```

---

## Table: challenge_exercises

Какие упражнения входят в челлендж и с какой целью. Одна строка = одно упражнение + его `goal`. Несколько строк на один челлендж = **мульти-упражнение**. Порядок не задаётся — на экране выполнения юзер сам выбирает любое упражнение из списка.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID записи. |
| challenge_id | INT | NOT NULL REFERENCES challenges(id) | Челлендж. |
| exercise_id | INT | NOT NULL REFERENCES exercises(id) | Упражнение. |
| goal | INT | NOT NULL | Дневная цель в единицах `exercises.metric` (повторы или секунды). |
| — | — | UNIQUE (challenge_id, exercise_id) | Упражнение в челлендже не дублируется. |

```sql
CREATE TABLE challenge_exercises (
    id           SERIAL PRIMARY KEY,
    challenge_id INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    exercise_id  INT NOT NULL REFERENCES exercises(id),
    goal         INT NOT NULL,
    UNIQUE (challenge_id, exercise_id)
);
```

---

## Table: participations

Участие юзера в челлендже (один человек — один челлендж). Узел, к которому привязан весь личный прогресс. Хранит денормализованные итоги для лидерборда, чтобы не пересчитывать каждый раз.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID участия. |
| user_id | INT | NOT NULL REFERENCES users(id) | Кто участвует. |
| challenge_id | INT | NOT NULL REFERENCES challenges(id) | В каком челлендже. |
| joined_at | TIMESTAMP | DEFAULT NOW() | Когда вступил. |
| days_completed | INT | DEFAULT 0 | Score: число полностью закрытых дней. Основной критерий лидерборда. |
| challenge_streak | INT | DEFAULT 0 | Серия закрытых дней внутри этого челленджа (тай-брейк). |
| total_clean_reps | INT | DEFAULT 0 | Сумма чистых повторов за **всё время в этом челлендже** (тай-брейк/объём). |
| last_closed_date | DATE | NULLABLE | Дата последнего закрытого дня — для сброса `challenge_streak` при пропуске. |
| — | — | UNIQUE (user_id, challenge_id) | Нельзя вступить дважды. |

```sql
CREATE TABLE participations (
    id               SERIAL PRIMARY KEY,
    user_id          INT NOT NULL REFERENCES users(id),
    challenge_id     INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    joined_at        TIMESTAMP DEFAULT NOW(),
    days_completed   INT DEFAULT 0,
    challenge_streak INT DEFAULT 0,
    total_clean_reps INT DEFAULT 0,
    last_closed_date DATE,
    UNIQUE (user_id, challenge_id)
);
```

---

## Table: sessions

Сырой лог тренировок, append-only (только добавляем, не правим). Каждая отправленная с камеры сессия. **Источник правды** для пересчёта прогресса и аналитики.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID сессии. |
| participation_id | INT | NOT NULL REFERENCES participations(id) | Кто + в каком челлендже. |
| challenge_exercise_id | INT | NOT NULL REFERENCES challenge_exercises(id) | Какое упражнение выполняли. |
| start_time | TIMESTAMP | DEFAULT NOW() | Начало (по клиенту). |
| end_time | TIMESTAMP | NULLABLE | Окончание. |
| total_reps | INT | NULLABLE | Всего повторов по CV (включая грязные). |
| clean_reps | INT | NULLABLE | Чистые повторы (только они идут в зачёт `goal`). |
| duration_seconds | INT | NULLABLE | Длительность. |
| created_at | TIMESTAMP | DEFAULT NOW() | Время записи в БД. |

```sql
CREATE TABLE sessions (
    id                    SERIAL PRIMARY KEY,
    participation_id      INT NOT NULL REFERENCES participations(id),
    challenge_exercise_id INT NOT NULL REFERENCES challenge_exercises(id),
    start_time            TIMESTAMP DEFAULT NOW(),
    end_time              TIMESTAMP,
    total_reps            INT,
    clean_reps            INT,
    duration_seconds      INT,
    created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## Table: challenge_exercise_progress

Копилка за день по **каждому упражнению**. Одна строка = (участие, упражнение, дата). Сервер складывает сюда чистые повторы из сессий (несколько тренировок за день суммируются) и закрывает упражнение, когда добито до цели.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID записи. |
| participation_id | INT | NOT NULL REFERENCES participations(id) | Чьё участие. |
| challenge_exercise_id | INT | NOT NULL REFERENCES challenge_exercises(id) | Какое упражнение челленджа. |
| date | DATE | NOT NULL | Локальная дата юзера. |
| clean_reps | INT | DEFAULT 0 | Накоплено чистых за день. |
| is_closed | BOOLEAN | DEFAULT FALSE | TRUE когда `clean_reps >= goal`. |
| — | — | UNIQUE (participation_id, challenge_exercise_id, date) | Одна запись на участие/упражнение/день. |

```sql
CREATE TABLE challenge_exercise_progress (
    id                    SERIAL PRIMARY KEY,
    participation_id      INT NOT NULL REFERENCES participations(id) ON DELETE CASCADE,
    challenge_exercise_id INT NOT NULL REFERENCES challenge_exercises(id),
    date                  DATE NOT NULL,
    clean_reps            INT DEFAULT 0,
    is_closed             BOOLEAN DEFAULT FALSE,
    UNIQUE (participation_id, challenge_exercise_id, date)
);
```

---

## Table: challenge_day_progress

День челленджа закрыт целиком? Одна строка = (участие, дата). `is_closed = TRUE` ровно когда **все** упражнения этого челленджа закрыты за эту дату. На переходе в TRUE сервер делает `participations.days_completed++` и ставит `last_closed_date`. Строка создаётся лениво при первой сессии за день; если юзер не заходил — строки нет (= день не закрыт).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID записи. |
| participation_id | INT | NOT NULL REFERENCES participations(id) | Чьё участие. |
| date | DATE | NOT NULL | Локальная дата юзера. |
| is_closed | BOOLEAN | DEFAULT FALSE | TRUE когда закрыты все упражнения дня. |
| closed_at | TIMESTAMP | NULLABLE | Момент закрытия дня. |
| — | — | UNIQUE (participation_id, date) | Одна запись на участие/день. |

```sql
CREATE TABLE challenge_day_progress (
    id               SERIAL PRIMARY KEY,
    participation_id INT NOT NULL REFERENCES participations(id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    is_closed        BOOLEAN DEFAULT FALSE,
    closed_at        TIMESTAMP,
    UNIQUE (participation_id, date)
);
```

---

## Table: user_exercise_stats

Глобальный объём (флекс): сколько всего чистых повторов юзер сделал за всё время по каждому упражнению, во всех челленджах. Для профиля и тай-брейков.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID записи. |
| user_id | INT | NOT NULL REFERENCES users(id) | Пользователь. |
| exercise_id | INT | NOT NULL REFERENCES exercises(id) | Упражнение. |
| total_clean_reps | BIGINT | DEFAULT 0 | Всего чистых за всё время (для планки — секунды). |
| — | — | UNIQUE (user_id, exercise_id) | Одна строка статистики на упражнение. |

```sql
CREATE TABLE user_exercise_stats (
    id               SERIAL PRIMARY KEY,
    user_id          INT NOT NULL REFERENCES users(id),
    exercise_id      INT NOT NULL REFERENCES exercises(id),
    total_clean_reps BIGINT DEFAULT 0,
    UNIQUE (user_id, exercise_id)
);
```

---

## Три счётчика повторов (чтобы не путать)

| Где | Что считает |
|---|---|
| `challenge_exercise_progress.clean_reps` | за один день, по одному упражнению (сбрасывается — новая строка каждый день) |
| `participations.total_clean_reps` | за всё время в одном челлендже (все упражнения), только растёт |
| `user_exercise_stats.total_clean_reps` | за всё время по упражнению глобально (все челленджи), только растёт |

---

## Индексы

Уникальные ограничения уже дают индексы (`username`, `email`, `join_code`, все `UNIQUE(...)`). Дополнительно под частые запросы:

```sql
-- Лидерборд челленджа (сортировка по score и тай-брейкам)
CREATE INDEX idx_part_leaderboard ON participations (challenge_id, days_completed DESC, challenge_streak DESC, total_clean_reps DESC, joined_at);
-- «Мои челленджи»
CREATE INDEX idx_part_user ON participations (user_id);
-- Лог сессий по участию
CREATE INDEX idx_sessions_part ON sessions (participation_id);
-- Стрик/календарь: закрытые дни участия
CREATE INDEX idx_day_progress_streak ON challenge_day_progress (participation_id, date);
-- Прогресс упражнений за день
CREATE INDEX idx_ex_progress_day ON challenge_exercise_progress (participation_id, date);
-- Фильтр активных челленджей
CREATE INDEX idx_challenges_status ON challenges (status);
```

---

## Примечания

- Все даты прогресса (`date`) — в локальной таймзоне юзера (`users.timezone`), а не в UTC. «День» для закрытия и стрика заканчивается в полночь по времени юзера. Пример: тренировка в 23:30 по Москве должна попасть в сегодняшний день, а не в завтрашний (как вышло бы по UTC). Поэтому перед записью прогресса серверная дата вычисляется в `users.timezone`, и стрик растёт/рвётся по локальной полуночи. У двух юзеров в разных поясах «сегодня» наступает в разные моменты — это нормально.
- **`ON DELETE CASCADE`** на связках челленджа/участия: удаление челленджа или участия чистит зависимый прогресс. `exercises` и `users` не каскадим (справочные/корневые).
- **Закрытие дня, стрик, место, объём считает только сервер.** Клиент отправляет сырую сессию (`total_reps`, `clean_reps`, `duration_seconds`).
