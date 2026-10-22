PRAGMA foreign_keys = ON;

-- One-time codes for email login. Only the hash is stored, never the code.
CREATE TABLE email_otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_otp_email ON email_otp_codes(email, expires_at);

PRAGMA optimize;
