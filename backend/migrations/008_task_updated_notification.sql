-- New notification type for general task edits (title, description,
-- priority, due date, reminder time). This one is in-app only — it is
-- deliberately never passed to notifyLineIfLinked, so it won't appear in
-- the LINE notification preferences list on the Profile page either.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_updated';
