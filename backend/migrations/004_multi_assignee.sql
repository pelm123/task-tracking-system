-- Multi-assignee support: replace tasks.assignee_id (single user) with a
-- many-to-many task_assignees join table.

CREATE TABLE task_assignees (
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);

-- backfill: carry over every task's existing single assignee
INSERT INTO task_assignees (task_id, user_id)
SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- drop the old single-assignee column and its index
DROP INDEX IF EXISTS idx_tasks_assignee;
ALTER TABLE tasks DROP COLUMN assignee_id;
