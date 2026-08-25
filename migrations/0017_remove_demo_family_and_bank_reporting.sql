PRAGMA foreign_keys = ON;

-- Preserve the destination for transfer payments created before bank selection was persisted.
UPDATE payment_batches
SET bank_account_id = (
  SELECT id FROM bank_accounts WHERE is_active = 1 ORDER BY sort_order, created_at LIMIT 1
)
WHERE bank_account_id IS NULL
  AND payment_method IN ('bank_transfer', 'credit_transfer')
  AND EXISTS (SELECT 1 FROM bank_accounts WHERE is_active = 1);

-- The official application no longer carries the seeded family account or student profiles.
DELETE FROM students WHERE guardian_user_id = 'user_demo_family';
DELETE FROM app_users WHERE id = 'user_demo_family';

PRAGMA optimize;
