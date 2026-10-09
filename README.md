# Task Tracking System

A team task tracker with Kanban boards, projects, approvals and LINE
notifications. The UI is available in Thai and English.

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
- **i18n**: Thai (default) and English, set per user.

## Tech stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 18, Vite, React Router, Recharts, @hello-pangea/dnd, Socket.IO client |
| Backend  | Node.js, Express, `pg`, JWT, bcrypt, multer, node-cron, Socket.IO |
| Database | PostgreSQL 16 (run with Docker Compose)                           |

## Getting started

### 1. Database

```bash
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose up -d          # starts PostgreSQL 16 on port 5432
```

`schema.sql` creates the tables automatically the first time the database
volume is created.

### 2. Backend (port 4000)

```bash
cd backend
cp .env.example .env          # use the same database password; set JWT_SECRET
npm install
npm run dev
```

| Variable                                          | Purpose                                     |
| ------------------------------------------------- | ------------------------------------------- |
| `PORT`                                            | API port (default 4000)                     |
| `DB_HOST`, `DB_PORT`                              | Database address (default `localhost:5432`) |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database credentials                        |
| `JWT_SECRET`                                      | **Required.** Secret used to sign login tokens |
| `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` | Optional LINE Messaging API credentials     |

### 3. Frontend (port 5173)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server forwards `/api`,
`/line/webhook` and `/socket.io` to the backend on port 4000, so one tunnel
(for example ngrok) on port 5173 can serve both the app and the LINE webhook.

## Database migrations

`schema.sql` runs **only on an empty database volume**. For an existing
database, apply new files from `backend/migrations/` in order, for example:

```bash
docker compose exec -T db psql -U app -d task_tracker < backend/migrations/016_user_language.sql
```

Do not run `docker compose down -v` unless you want to delete the database.

## Project structure

```
.
├── backend/
│   ├── migrations/      # incremental SQL migrations
│   └── src/
│       ├── config/      # db, LINE, i18n, notifications
│       ├── controllers/
│       ├── jobs/        # due-date scheduler (runs every minute)
│       ├── middleware/  # auth, localization, uploads
│       ├── routes/
│       └── server.js
├── frontend/
│   ├── src/
│   │   ├── api/         # axios + Socket.IO clients
│   │   ├── components/
│   │   ├── context/     # auth, language, project, theme
│   │   ├── i18n/        # th.json, en.json
│   │   ├── pages/       # Board, Calendar, Dashboard, Admin, Profile, ...
│   │   └── utils/
│   └── vite.config.js
├── schema.sql
└── docker-compose.yml   # PostgreSQL
```
