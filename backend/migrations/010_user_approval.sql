-- New sign-ups must be approved by an admin before they can log in.
-- DEFAULT TRUE keeps every account that already exists working exactly as
-- before; the register endpoint explicitly inserts new accounts as FALSE.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT TRUE;
