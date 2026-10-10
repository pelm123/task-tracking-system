# Running with Docker

```bash
cp .env.example .env        # then edit: set JWT_SECRET (openssl rand -hex 32)
docker compose up -d --build
docker compose ps           # db, backend, frontend should be healthy/up
```

Open `http://<host>:${WEB_PORT:-8080}`.

## Architecture
```
browser ─► gateway (nginx, also serves the SPA)  :8080
             ├─ /api/auth, /api/users                      ─► auth           (sign-up, login, users)
             ├─ /api/tasks, projects, comments,
             │  attachments, dashboard, health             ─► tasks          (tasks, projects, files, risk/AI)
             └─ /api/notifications, /api/line,
                /line/webhook, /socket.io                   ─► notifications  (in-app + LINE, scheduler, Socket.IO)
                         all three ─► one PostgreSQL (db)
```
- The three services are built from one image (`backend/`), started with
  different commands (`src/services/*.js`). `npm run dev` still runs the
  single-process server (`src/server.js`).
- Services never call each other over HTTP; they share the database and talk
  through Postgres NOTIFY: `task_event` (tasks -> Socket.IO) and `line_outbox`
  (a notification that wants a LINE push, migration 017).
- JWTs are verified locally in every service with the same `JWT_SECRET`.
- Per-service health: `docker compose ps` (each has a healthcheck).

## Notes
- `schema.sql` runs **only on an empty database volume**. For an existing
  volume apply new files from `backend/migrations/` by hand, e.g.
  `docker compose exec -T db psql -U app -d task_tracker < backend/migrations/017_line_outbox.sql`.
- Never run `docker compose down -v` on a live system: it deletes `db_data`
  (database) and `uploads_data` (attachments).
- Uploads are stored in the `uploads_data` volume (`/app/uploads`).
- If npmjs.org is blocked, set `NPM_REGISTRY=<mirror url>` in `.env`.
- The db service uses a fixed `container_name` and publishes 5432; stop any
  other Postgres/compose project using them first.
- Local development is unchanged: `npm run dev` in `backend/` and `frontend/`
  (Vite proxies to `localhost:4000`).
