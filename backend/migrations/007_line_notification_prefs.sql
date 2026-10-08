-- Lets each user turn individual LINE notification types on/off, instead of
-- getting every push once their account is linked. Keys match the
-- notification_type enum; all default to true so linked accounts keep
-- getting everything until someone opts out of something specific.
ALTER TABLE users ADD COLUMN IF NOT EXISTS line_notification_prefs JSONB NOT NULL DEFAULT
  '{"assigned": true, "status_change": true, "comment": true, "due_soon": true, "approved": true, "approval_denied": true}'::jsonb;
