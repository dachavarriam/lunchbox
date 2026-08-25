PRAGMA foreign_keys = ON;

CREATE TABLE payment_batch_request_keys (
  request_key TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  payment_batch_id TEXT NOT NULL UNIQUE REFERENCES payment_batches(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

PRAGMA optimize;
