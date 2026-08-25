PRAGMA foreign_keys = ON;

-- Los administradores invitados también pueden comprar desde la aplicación
-- familiar. Los clientes normales conservan únicamente su rol customer.
INSERT OR IGNORE INTO user_roles (user_id, role, school_id)
SELECT id, 'customer', 'school_eis'
FROM app_users
WHERE email IN ('daniel@wembla.com', 'dachavarriam@gmail.com');

PRAGMA optimize;
