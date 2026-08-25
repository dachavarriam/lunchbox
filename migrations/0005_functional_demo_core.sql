PRAGMA foreign_keys = ON;

-- Functional demo actor. This identity is replaced by the authenticated user
-- once Google/email/passkey login is connected.
INSERT OR IGNORE INTO app_users (id, email, display_name, locale, status)
VALUES ('user_demo_family', 'familia.demo@pipiro.local', 'Daniela Chavarría', 'es-HN', 'active');

INSERT OR IGNORE INTO user_roles (user_id, role, school_id)
VALUES ('user_demo_family', 'customer', 'school_eis');

INSERT OR IGNORE INTO students (
  id, guardian_user_id, school_id, classroom_id, first_name, last_name, delivery_notes
) VALUES
  ('student_demo_sofia', 'user_demo_family', 'school_eis', 'class_eis_3b', 'Sofía', 'M.', 'Entregar en Aula 12'),
  ('student_demo_mateo', 'user_demo_family', 'school_eis', 'class_eis_ka', 'Mateo', 'M.', 'Entregar en Aula K-A');

INSERT OR IGNORE INTO student_allergies (
  id, student_id, allergen, severity, instructions
) VALUES
  ('allergy_demo_sofia_peanut', 'student_demo_sofia', 'Maní', 'severe', 'Evitar contacto cruzado'),
  ('allergy_demo_sofia_nuts', 'student_demo_sofia', 'Nueces', 'severe', 'Evitar contacto cruzado');

CREATE TABLE payment_transfers (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_reference TEXT,
  receipt_object_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'duplicate', 'expired')),
  reviewed_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE demo_request_keys (
  request_key TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_window_exceptions (
  id TEXT PRIMARY KEY,
  service_window_id TEXT NOT NULL REFERENCES service_windows(id) ON DELETE CASCADE,
  service_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  delivery_time TEXT,
  cutoff_time TEXT,
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  message_es TEXT,
  message_en TEXT,
  updated_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (service_window_id, service_date)
);

CREATE INDEX idx_payment_transfers_status
ON payment_transfers(status, created_at);

CREATE INDEX idx_service_window_exceptions_date
ON service_window_exceptions(service_date, status);

PRAGMA optimize;
