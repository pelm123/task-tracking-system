-- Migration: expand user_role from (manager, member) to (admin, pm, member)
-- Run this once against your existing database.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pm';

-- existing "manager" accounts become "admin" (full access, same as before)
UPDATE users SET role = 'admin' WHERE role = 'manager';
