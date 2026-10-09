-- Who changed what, and when.
--  * comments.updated_at: set when the author edits a comment (NULL = never edited)
--  * task_activity: one row per change to a task (created, edited, status
--    moves, approvals, file added/removed), with the person who did it.

ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS task_activity (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(40) NOT NULL,
    detail     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity(task_id, created_at DESC);
