PRAGMA foreign_keys = ON;

CREATE TABLE cms_media (
  id TEXT PRIMARY KEY,
  dish_id TEXT REFERENCES dishes(id) ON DELETE SET NULL,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  uploaded_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cms_import_jobs (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('preview', 'applied', 'rejected')),
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  error_rows INTEGER NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
  summary_json TEXT,
  created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT
);

CREATE INDEX idx_cms_media_dish
ON cms_media(dish_id, created_at DESC);

CREATE INDEX idx_cms_import_jobs_created
ON cms_import_jobs(created_at DESC);

PRAGMA optimize;
