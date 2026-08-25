PRAGMA foreign_keys = ON;

UPDATE dishes
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE category_id = 'cat_drink';

UPDATE categories
SET is_active = 0
WHERE id = 'cat_drink';

PRAGMA optimize;
