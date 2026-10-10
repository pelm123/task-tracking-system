# Task Tracking System

A team task tracker with Kanban boards, projects, approvals, due-date risk
flags and LINE notifications. The UI is available in Thai and English.

## Features

- **Projects & tasks**: Kanban board (drag and drop), list and calendar views,
  multiple assignees per task, priorities, due dates and per-project colors.
- **Roles**: `admin`, `pm` and `member`. New sign-ups wait for admin approval,
  and tasks can go through an approval (review) step.
- **Collaboration**: comments, file attachments and a per-task activity log.
- **Dashboard**: charts of task status and workload.
- **Notifications**: real-time in-app notifications over Socket.IO, plus
  optional LINE messages (task assigned, updated, due soon, overdue). Each
  user can choose which ones they receive.
- **Due-date risk**: rule-based flags (low / medium / high) for open tasks,
  based on time left, status, priority, assignee workload and history.
  An optional AI explanation is available through OpenRouter.
- **i18n**: Thai (default) and English, set per user.

## Tech stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 18, Vite, React Router, Recharts, @hello-pangea/dnd, Socket.IO client |
| Backend  | Node.js, Express, `pg`, JWT, bcrypt, multer, node-cron, Socket.IO |
| Database | PostgreSQL 16                                                     |
| Runtime  | Docker Compose, nginx (serves the SPA and acts as the API gateway) |

## Architecture

```
browser ─► gateway (nginx, also serves the SPA)  :8080
             ├─ /api/auth, /api/users              ─► auth           (sign-up, login, users)
             ├─ /api/tasks, projects, comments,
             │  attachments, dashboard, health     ─► tasks          (tasks, projects, files, risk/AI)
             └─ /api/notifications, /api/line,
                /line/webhook, /socket.io           ─► notifications  (in-app + LINE, scheduler, Socket.IO)
                         all three ─► one PostgreSQL (db)
```

- All three services are built from the same `backend/` image and started
  with different entry points (`backend/src/services/*.js`).
- The services never call each other over HTTP. They share the database and
  communicate through Postgres `NOTIFY`.
- Every service verifies JWTs locally using the shared `JWT_SECRET`.

See [DOCKER.md](DOCKER.md) for more detail.

## Getting started (Docker)

```bash
cp .env.example .env          # then set JWT_SECRET (openssl rand -hex 32)
docker compose up -d --build
docker compose ps             # every service should be healthy
```

Open `http://localhost:8080`. To use a different port, set `WEB_PORT` in `.env`.

### Configuration (`.env`)

| Variable                                          | Purpose                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database credentials (read only when the volume is first created) |
| `JWT_SECRET`                                      | **Required.** Secret used to sign login tokens         |
| `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` | Optional LINE Messaging API credentials              |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`          | Optional AI risk explanations                        |
| `UPLOAD_MAX_MB`                                   | Maximum attachment size (default 200)                |
| `WEB_PORT`                                        | Port the app is served on (default 8080)             |
| `NPM_REGISTRY`                                    | Optional npm mirror used during image builds         |

## Local development

Start PostgreSQL (for example `docker compose up -d db`), then:

```bash
# backend: single-process server on :4000
cd backend
npm install
npm run dev

# frontend: Vite dev server, proxies /api to localhost:4000
cd frontend
npm install
npm run dev
```

Run the backend tests with `npm test` in `backend/`.

## Database

- `schema.sql` creates the full schema. It runs automatically, but **only on
  an empty database volume**.
- For an existing database, apply new files from `backend/migrations/` in
  order, for example:

  ```bash
  docker compose exec -T db psql -U app -d task_tracker < backend/migrations/017_line_outbox.sql
  ```

- Do not run `docker compose down -v` on a live system. It deletes the
  database (`db_data`) and the uploaded files (`uploads_data`).

## Project structure

```
.
├── backend/
│   ├── migrations/      # incremental SQL migrations
│   ├── src/
│   │   ├── config/      # db, LINE, i18n, risk scoring, realtime, AI
│   │   ├── controllers/
│   │   ├── jobs/        # due-date scheduler (runs every minute)
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/    # auth / tasks / notifications entry points
│   │   └── server.js    # single-process server for local dev
│   └── test/
├── frontend/
│   ├── src/
│   │   ├── api/         # axios + Socket.IO clients
│   │   ├── components/
│   │   ├── context/
│   │   ├── i18n/        # th.json, en.json
│   │   └── pages/       # Board, Calendar, Dashboard, Admin, Profile, ...
│   └── nginx.conf       # gateway config
├── schema.sql
├── docker-compose.yml
└── DOCKER.md
```
