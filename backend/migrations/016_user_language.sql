-- Migration 016: per-user language (Thai / English).
--
-- The server now writes notifications, LINE messages and the "sent back"
-- comment in each recipient's own language, so it needs to know it.
-- Existing users default to Thai (the app's default language); everyone can
-- switch with the language button in the header, which saves it here.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'th'
  CHECK (language IN ('th', 'en'));
