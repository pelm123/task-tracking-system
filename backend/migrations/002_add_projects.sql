-- Migration: add projects and link tasks to them

CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- backfill: put all existing tasks into one default project so nothing is
-- orphaned, using whichever user is currently an admin as the creator
INSERT INTO projects (name, description, created_by)
SELECT 'Default Project', 'Auto-created during migration to hold existing tasks', id
FROM users WHERE role = 'admin'
LIMIT 1;

UPDATE tasks SET project_id = (SELECT id FROM projects ORDER BY created_at ASC LIMIT 1)
WHERE project_id IS NULL;

ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX idx_tasks_project ON tasks(project_id);
