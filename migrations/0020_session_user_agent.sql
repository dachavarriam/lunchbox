PRAGMA foreign_keys = ON;

-- Lets "Mi perfil" show which device/browser each active session belongs to,
-- so a family can recognize and close sessions they don't want active.
ALTER TABLE auth_sessions ADD COLUMN user_agent TEXT;

PRAGMA optimize;
