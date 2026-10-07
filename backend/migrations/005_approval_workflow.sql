-- Adds the notification types used by the PM approval workflow:
-- a member can move a task into Review, but only a PM/admin can move it to
-- Done (approve) or send it back to To Do (deny). Both actions notify the
-- task's assignees, so the notification_type enum needs two new values.
--
-- ALTER TYPE ... ADD VALUE cannot run inside the same transaction as other
-- statements on some Postgres versions, so each ALTER is its own statement
-- (psql runs this file statement-by-statement, which is what we want here).
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'approval_denied';
