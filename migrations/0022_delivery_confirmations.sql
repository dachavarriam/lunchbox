PRAGMA foreign_keys = ON;

-- Photo evidence for the delivery role confirming hand-off at the school's collection point.
CREATE TABLE delivery_confirmations (
  id TEXT PRIMARY KEY,
  delivered_by_user_id TEXT NOT NULL REFERENCES app_users(id),
  photo_object_key TEXT NOT NULL,
  photo_content_type TEXT NOT NULL,
  order_count INTEGER NOT NULL,
  order_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delivery_confirmations_created ON delivery_confirmations(created_at);

PRAGMA optimize;
