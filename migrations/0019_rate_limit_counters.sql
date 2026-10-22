PRAGMA foreign_keys = ON;

-- Fixed-window counters for application-level rate limiting (login, soporte,
-- checkout, comprobantes). Not a replacement for Cloudflare's own edge-level
-- rate limiting rules, but works without any extra Cloudflare configuration.
CREATE TABLE rate_limit_counters (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

PRAGMA optimize;
