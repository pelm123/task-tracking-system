-- Lets each task carry its own "remind me before due date" lead time,
-- instead of the hardcoded 24-hour window the due-date checker used to use.
-- Existing tasks default to 24 (the old fixed behavior), so nothing changes
-- for them until someone edits it.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_hours_before INTEGER NOT NULL DEFAULT 24;
