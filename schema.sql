-- Task Tracking System — initial schema
-- Run this against PostgreSQL (e.g. via docker-compose init scripts,
-- mounted at /docker-entrypoint-initdb.d/schema.sql)

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ── Enum types ──────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'pm', 'member');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
-- 'task_updated' (general edits: title/description/priority/due date/
-- reminder) is deliberately left out of line_notification_prefs below —
-- it's in-app only and never pushed to LINE.
CREATE TYPE notification_type AS ENUM ('due_soon', 'assigned', 'comment', 'status_change', 'approved', 'approval_denied', 'task_updated', 'overdue');

-- ── Users ───────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          user_role NOT NULL DEFAULT 'member',
    line_user_id  VARCHAR(64) UNIQUE,
    line_link_code VARCHAR(10) UNIQUE,
    -- which notification_type values push to LINE once an account is
    -- linked; all on by default (see ProfilePage's "LINE notifications")
    line_notification_prefs JSONB NOT NULL DEFAULT
      '{"assigned": true, "status_change": true, "comment": true, "due_soon": true, "approved": true, "approval_denied": true, "overdue": true}'::jsonb,
    -- new sign-ups are inserted as FALSE and can't log in until an admin approves
    is_approved   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Projects ────────────────────────────────────────────────
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(500) NOT NULL,
    color       VARCHAR(7),   -- '#RRGGBB', picked from the palette in config/projectColors.js
    description TEXT,
    created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tasks ───────────────────────────────────────────────────
CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title        VARCHAR(500) NOT NULL,
    description  TEXT,
    status       task_status NOT NULL DEFAULT 'todo',
    priority     task_priority NOT NULL DEFAULT 'medium',
    due_date     TIMESTAMPTZ,
    -- how many hours before due_date the assignees get a "due soon"
    -- notification — defaults to a day, editable per task
    reminder_hours_before INTEGER NOT NULL DEFAULT 24,
    created_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- set when status transitions to 'done', cleared if reopened — used for
    -- month / fiscal-year completion reporting on the dashboard, since
    -- updated_at is bumped on every edit and can't be used for that
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_project   ON tasks(project_id);
CREATE INDEX idx_tasks_status   ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- ── Task assignees (many-to-many) ──────────────────────────────
CREATE TABLE task_assignees (
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);

-- keep updated_at fresh on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ── Comments ────────────────────────────────────────────────
CREATE TABLE comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_task ON comments(task_id);

-- ── Attachments ─────────────────────────────────────────────
CREATE TABLE attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    file_size   INTEGER,
    mime_type   VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_task ON attachments(task_id);

-- ── Notifications ───────────────────────────────────────────
CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
    type       notification_type NOT NULL,
    message    TEXT NOT NULL,
    is_read    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
