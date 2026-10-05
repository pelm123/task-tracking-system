-- Migration: add LINE Messaging API account-linking fields

ALTER TABLE users ADD COLUMN line_user_id VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN line_link_code VARCHAR(10) UNIQUE;
