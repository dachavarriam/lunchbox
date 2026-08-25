PRAGMA foreign_keys = ON;

ALTER TABLE payment_transfers
ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'bank_transfer'
CHECK (payment_method IN ('bank_transfer', 'card'));

ALTER TABLE payment_transfers
ADD COLUMN receipt_original_name TEXT;

ALTER TABLE payment_transfers
ADD COLUMN receipt_content_type TEXT;

ALTER TABLE payment_transfers
ADD COLUMN receipt_size_bytes INTEGER
CHECK (receipt_size_bytes IS NULL OR receipt_size_bytes > 0);

ALTER TABLE payment_transfers
ADD COLUMN receipt_submitted_at TEXT;

CREATE INDEX idx_payment_transfers_receipt
ON payment_transfers(status, receipt_submitted_at);

PRAGMA optimize;
