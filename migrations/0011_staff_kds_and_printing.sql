PRAGMA foreign_keys = ON;

ALTER TABLE dishes
ADD COLUMN prep_time_minutes INTEGER NOT NULL DEFAULT 15
CHECK (prep_time_minutes BETWEEN 1 AND 180);

CREATE TABLE staff_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'kitchen', 'delivery')),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  accepted_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  expires_at TEXT,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (email, role, school_id)
);

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('kitchen_ticket', 'package_label')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'printing', 'printed', 'failed', 'cancelled')),
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 10),
  requested_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  printed_at TEXT,
  printer_name TEXT,
  error_message TEXT
);

CREATE INDEX idx_staff_invitations_status ON staff_invitations(status, created_at DESC);
CREATE INDEX idx_print_jobs_status ON print_jobs(status, requested_at);
CREATE INDEX idx_print_jobs_order ON print_jobs(order_id, job_type);

PRAGMA optimize;
