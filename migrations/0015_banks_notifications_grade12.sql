-- Multiple transfer destinations, communication outbox, grade 12, and menu labels.

UPDATE categories
SET name_es = 'Menú fijo', name_en = 'Fixed menu', sort_order = 20
WHERE id = 'cat_permanent';

UPDATE categories
SET sort_order = 10
WHERE id = 'cat_special';

INSERT OR IGNORE INTO classrooms (id, school_id, grade, section, classroom_name, building, guide_teacher) VALUES
  ('class_eis_grade_12_a', 'school_eis', '12°', 'A', '12° A', NULL, 'Por confirmar'),
  ('class_eis_grade_12_b', 'school_eis', '12°', 'B', '12° B', NULL, 'Por confirmar'),
  ('class_eis_grade_12_c', 'school_eis', '12°', 'C', '12° C', NULL, 'Por confirmar'),
  ('class_eis_grade_12_d', 'school_eis', '12°', 'D', '12° D', NULL, 'Por confirmar'),
  ('class_eis_grade_12_e', 'school_eis', '12°', 'E', '12° E', NULL, 'Por confirmar');

CREATE TABLE bank_accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL,
  instructions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 10,
  updated_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO bank_accounts (id, label, bank_name, account_holder, account_number, account_type, sort_order)
SELECT 'bank_default', bank_name, bank_name, account_holder, account_number, account_type, 10
FROM payment_settings WHERE id = 'default';

ALTER TABLE payment_batches ADD COLUMN bank_account_id TEXT;

CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES app_users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  recipient_email TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push')),
  template_key TEXT NOT NULL,
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active, sort_order);
CREATE INDEX idx_notification_outbox_status ON notification_outbox(status, available_at);

PRAGMA optimize;
