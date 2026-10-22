PRAGMA foreign_keys = ON;

-- Photo evidence for the delivery role confirming hand-off of one specific order, so the
-- photo can be shown to that order's own guardian and serve as a record if a dispute comes up.
CREATE TABLE delivery_confirmations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  delivered_by_user_id TEXT NOT NULL REFERENCES app_users(id),
  photo_object_key TEXT NOT NULL,
  photo_content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delivery_confirmations_created ON delivery_confirmations(created_at);

PRAGMA optimize;
