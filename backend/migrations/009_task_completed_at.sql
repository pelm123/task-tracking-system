-- Adds a real "completed" timestamp, set when a task's status transitions
-- to 'done' and cleared if it's ever reopened. Needed for accurate month /
-- fiscal-year completion reporting on the consolidated dashboard —
-- updated_at can't be used for this since trg_tasks_updated_at bumps it on
-- every edit, not just on completion.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill a best-effort value for tasks that are already Done, so existing
-- data isn't excluded from reports just because it predates this column.
-- updated_at is the closest available signal for when that happened.
UPDATE tasks SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL;
