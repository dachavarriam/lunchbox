PRAGMA foreign_keys = ON;

CREATE TABLE payment_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  bank_name TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_number TEXT NOT NULL DEFAULT 'Pendiente de configurar',
  account_type TEXT NOT NULL DEFAULT 'Pendiente de configurar',
  updated_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payment_settings (id, bank_name, account_holder)
VALUES ('default', 'BAC Credomatic', 'CHM SA');

CREATE TABLE payment_batches (
  id TEXT PRIMARY KEY,
  checkout_number TEXT NOT NULL UNIQUE,
  guardian_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'card', 'credit', 'credit_transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'amount_mismatch', 'expired', 'cancelled', 'refund_pending', 'refunded')),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  credit_applied_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_applied_cents >= 0),
  amount_due_cents INTEGER NOT NULL CHECK (amount_due_cents >= 0),
  customer_reference TEXT,
  receipt_object_key TEXT,
  receipt_original_name TEXT,
  receipt_content_type TEXT,
  receipt_size_bytes INTEGER,
  receipt_submitted_at TEXT,
  expires_at TEXT NOT NULL,
  reviewed_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_batch_orders (
  payment_batch_id TEXT NOT NULL REFERENCES payment_batches(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  PRIMARY KEY (payment_batch_id, order_id)
);

CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents != 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('admin_grant', 'checkout_debit', 'cancellation_credit', 'adjustment')),
  reason TEXT NOT NULL,
  payment_batch_id TEXT REFERENCES payment_batches(id) ON DELETE SET NULL,
  created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_issues (
  id TEXT PRIMARY KEY,
  payment_batch_id TEXT NOT NULL REFERENCES payment_batches(id) ON DELETE CASCADE,
  expected_cents INTEGER NOT NULL CHECK (expected_cents >= 0),
  received_cents INTEGER NOT NULL CHECK (received_cents >= 0),
  difference_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_customer' CHECK (status IN ('awaiting_customer', 'refund_requested', 'balance_pending', 'resolved')),
  customer_choice TEXT CHECK (customer_choice IS NULL OR customer_choice IN ('refund', 'pay_difference')),
  customer_responded_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE support_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('comment', 'complaint', 'request', 'payment', 'other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_batches_guardian ON payment_batches(guardian_user_id, created_at DESC);
CREATE INDEX idx_payment_batches_status ON payment_batches(status, expires_at);
CREATE INDEX idx_credit_ledger_user ON credit_ledger(user_id, created_at);
CREATE INDEX idx_payment_issues_status ON payment_issues(status, created_at);
CREATE INDEX idx_support_requests_status ON support_requests(status, created_at);

PRAGMA optimize;
