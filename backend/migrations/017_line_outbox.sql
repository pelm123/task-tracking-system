-- Migration 017: LINE delivery outbox.
--
-- The Notification service now owns LINE delivery. Services that create a
-- notification only INSERT the row; when `line_emoji` is set the row also
-- wants a LINE push, and the trigger below announces its id on the
-- `line_outbox` channel. The Notification service LISTENs, applies the
-- user's LINE preferences and sends the push.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS line_emoji TEXT;

CREATE OR REPLACE FUNCTION notify_line_outbox()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.line_emoji IS NOT NULL THEN
        PERFORM pg_notify('line_outbox', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_line_outbox ON notifications;
CREATE TRIGGER trg_notifications_line_outbox
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION notify_line_outbox();
