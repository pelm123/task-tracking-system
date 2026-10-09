-- Instant notifications: every new row in `notifications` fires a Postgres
-- NOTIFY carrying the recipient's user id. The API server LISTENs for it and
-- pushes a "notification:new" event to that user's open browser tabs, so the
-- sound plays immediately instead of waiting for the next poll.
CREATE OR REPLACE FUNCTION notify_new_notification()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_notification', NEW.user_id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_push ON notifications;
CREATE TRIGGER trg_notifications_push
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_notification();
