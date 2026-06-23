# WowFit Challenges

"Duolingo for sport": fitness challenges where users confirm exercises through the camera (MediaPipe in the browser), with a daily streak ("flame") and a per-challenge leaderboard. Mobile-first web app.

- **Team:** Green Team · **Track:** Industrial
- **Docs:** see [`docs/`](../../Downloads/Telegram%20Desktop/docs) — Week 2 report, specification, git guide.

## Stack
- **Frontend:** React + TypeScript + Vite (Tailwind).
- **Backend:** Python FastAPI + SQLAlchemy.
- **DB:** PostgreSQL.
- **Infra:** Docker + docker-compose, Nginx.

## Structure
```
frontend/   React + TS (UI, auth)
backend/    FastAPI (auth: signup/login/JWT)
docs/       reports and specifications
docker-compose.yml
```

## Run with Docker (one command)
```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend (Swagger): http://localhost:8001/docs · health: http://localhost:8001/health
- PostgreSQL: localhost:5432

The frontend talks to the backend through `/api` (Nginx proxies it to the backend) — same origin, no CORS issues.

## Deployed version (for TAs)
- **URL:** http://10.93.27.12:80

## Local dev (without Docker)
**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # set JWT_SECRET and DATABASE_URL
uvicorn main:app --reload --port 8000
```
**Frontend:**
```bash
cd frontend
npm install
npm run dev     # http://localhost:5173, proxies /api -> :8000
```

## Current status (Week 2)
MVP core: working authentication (sign up / sign in), frontend connected to backend, runs with a single command. Challenges / CV come in the following weeks (see `docs/week2-report.md`).
