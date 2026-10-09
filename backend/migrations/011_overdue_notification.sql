-- New notification type, created by the scheduler (jobs/dueDateCheck.js) once
-- a task passes its due date without being done. Also pushed to LINE; the
-- per-user LINE preferences need no schema change — a missing "overdue" key
-- is treated as ON, and users can switch it off from their Profile page.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'overdue';
