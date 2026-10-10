PRAGMA foreign_keys = ON;

-- Administrative follow-up for transfer payments.
ALTER TABLE payment_batches ADD COLUMN receipt_requested_at TEXT;
ALTER TABLE payment_batches ADD COLUMN receipt_request_count INTEGER NOT NULL DEFAULT 0 CHECK (receipt_request_count >= 0);
ALTER TABLE payment_batches ADD COLUMN last_reminder_at TEXT;
ALTER TABLE payment_batches ADD COLUMN cancellation_reason TEXT;

PRAGMA optimize;
