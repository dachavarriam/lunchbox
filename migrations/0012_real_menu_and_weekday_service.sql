PRAGMA foreign_keys = ON;

UPDATE categories
SET name_es = 'Menú', name_en = 'Menu', sort_order = 10, is_active = 1
WHERE id = 'cat_permanent';

UPDATE categories
SET name_es = 'Menú del día', name_en = 'Menu of the day', sort_order = 20, is_active = 1
WHERE id = 'cat_special';

UPDATE categories SET sort_order = 30, is_active = 0 WHERE id = 'cat_drink';

UPDATE dishes
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE category_id IN ('cat_permanent', 'cat_special');

-- Libera los slugs de los ocho productos de demostración que se reutilizan.
UPDATE dishes
SET slug = 'legacy-' || id, updated_at = CURRENT_TIMESTAMP
WHERE id IN ('dish_p01', 'dish_p02', 'dish_p03', 'dish_p04', 'dish_p05', 'dish_p06', 'dish_p07', 'dish_p08');

INSERT INTO dishes (
  id, category_id, slug, name_es, name_en, description_es, description_en,
  price_cents, prep_time_minutes, emoji, badge_es, badge_en, is_active
) VALUES
  ('dish_p01', 'cat_permanent', 'chilaquiles', 'Chilaquiles', 'Chilaquiles',
   'Chilaquiles con carne y salsa a elección; incluyen quesillo, crema y queso.',
   'Chilaquiles with your choice of meat and salsa, topped with quesillo, cream and cheese.',
   20600, 15, 'meal', NULL, NULL, 1),
  ('dish_p02', 'cat_permanent', 'sopa-teposteca', 'Sopa teposteca', 'Teposteca soup',
   'Deliciosa sopa de tortilla con pollo acompañada de queso, aguacate y crema.',
   'Tortilla soup with chicken, cheese, avocado and cream.',
   19000, 15, 'meal', NULL, NULL, 1),
  ('dish_p03', 'cat_permanent', 'tacos-birria', 'Tacos de birria', 'Birria tacos',
   'Tres tacos acompañados con salsa de birria, cebolla y cilantro.',
   'Three tacos served with birria sauce, onion and cilantro.',
   19500, 15, 'meal', NULL, NULL, 1),
  ('dish_p04', 'cat_permanent', 'tacos-queso-birria', 'Tacos de queso birria', 'Cheese birria tacos',
   'Tres tacos de birria con queso acompañados con salsa de birria, cebolla y cilantro.',
   'Three cheese birria tacos served with birria sauce, onion and cilantro.',
   21000, 15, 'meal', NULL, NULL, 1),
  ('dish_p05', 'cat_permanent', 'tacos-flautas', 'Tacos flautas', 'Flauta tacos',
   'Flautas de pollo con lechuga, salsa verde, queso y crema; tres para Niño y cuatro para Adulto.',
   'Chicken flautas with lettuce, green salsa, cheese and cream; three child-size or four adult-size.',
   19000, 15, 'meal', NULL, NULL, 1),
  ('dish_p06', 'cat_permanent', 'deditos-pollo', 'Deditos de pollo', 'Chicken fingers',
   'Deditos de pollo con papas fritas.', 'Chicken fingers with french fries.',
   19000, 15, 'meal', NULL, NULL, 1),
  ('dish_p07', 'cat_permanent', 'sandwich-parrilla', 'Sándwich a la parrilla', 'Grilled cheese sandwich',
   'Delicioso sándwich a la parrilla con queso cheddar y mozzarella.',
   'Grilled sandwich with cheddar and mozzarella cheese.',
   17000, 15, 'meal', NULL, NULL, 1),
  ('dish_p08', 'cat_permanent', 'tacos-mexicanos', 'Tacos mexicanos', 'Mexican tacos',
   'Tres tacos con carne a elección, cebolla, cilantro, limón, salsa de la casa y chismol.',
   'Three tacos with your choice of meat, onion, cilantro, lime, house salsa and chismol.',
   19000, 15, 'meal', NULL, NULL, 1),
  ('dish_p09', 'cat_permanent', 'gringas', 'Gringas', 'Gringas',
   'Dos tortillas de harina rellenas de queso y carne a elección; acompañadas con guacamole.',
   'Two flour tortillas filled with cheese and your choice of meat, served with guacamole.',
   19000, 15, 'meal', NULL, NULL, 1),
  ('dish_p10', 'cat_permanent', 'nachos', 'Nachos', 'Nachos',
   'Totopos con frijoles refritos, pico de gallo, jalapeños, guacamole, quesillo y queso cheddar.',
   'Tortilla chips with refried beans, pico de gallo, jalapeños, guacamole, quesillo and cheddar.',
   19000, 15, 'meal', NULL, NULL, 1),
  ('dish_day_mon', 'cat_special', 'menu-dia-lunes-milanesa', 'Milanesa', 'Milanesa',
   'Cuadritos de milanesa con arroz, brócoli con queso mozzarella y fruta mixta.',
   'Milanesa bites with rice, broccoli, mozzarella and mixed fruit.',
   19800, 15, 'meal', 'Lunes', 'Monday', 1),
  ('dish_day_tue', 'cat_special', 'menu-dia-martes-farfalle-pollo', 'Farfalle con pollo', 'Chicken farfalle',
   'Pollo asado en cubitos con pasta farfalle en salsa, queso parmesano, maíz y postre de manzana con mantequilla de maní.',
   'Grilled chicken with farfalle pasta, Parmesan, corn and an apple with peanut butter dessert.',
   19000, 15, 'meal', 'Martes', 'Tuesday', 1),
  ('dish_day_thu', 'cat_special', 'menu-dia-jueves-lomo-cerdo', 'Lomo de cerdo a la plancha', 'Grilled pork loin',
   'Lomo de cerdo con papitas cambray salteadas, ketchup, aguacate, pepino y galleta.',
   'Grilled pork loin with sautéed baby potatoes, ketchup, avocado, cucumber and a cookie.',
   19500, 15, 'meal', 'Jueves', 'Thursday', 1),
  ('dish_day_fri', 'cat_special', 'menu-dia-viernes-tacos-mexicanos', 'Tacos mexicanos', 'Mexican tacos',
   'Tres tacos con carne a elección, chismol y postre de gelatina.',
   'Three tacos with your choice of meat, chismol and gelatin for dessert.',
   19800, 15, 'meal', 'Viernes', 'Friday', 1)
ON CONFLICT(id) DO UPDATE SET
  category_id = excluded.category_id,
  slug = excluded.slug,
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  description_es = excluded.description_es,
  description_en = excluded.description_en,
  price_cents = excluded.price_cents,
  prep_time_minutes = excluded.prep_time_minutes,
  emoji = excluded.emoji,
  badge_es = excluded.badge_es,
  badge_en = excluded.badge_en,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

DELETE FROM dish_option_groups
WHERE dish_id IN (
  'dish_p01', 'dish_p02', 'dish_p03', 'dish_p04', 'dish_p05', 'dish_p06', 'dish_p07',
  'dish_p08', 'dish_p09', 'dish_p10', 'dish_day_mon', 'dish_day_tue', 'dish_day_thu', 'dish_day_fri'
);

INSERT INTO dish_option_groups (id, dish_id, name_es, name_en, min_select, max_select, sort_order, is_active) VALUES
  ('group_p01_size', 'dish_p01', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p01_meat', 'dish_p01', 'Elige la carne', 'Choose the meat', 1, 1, 20, 1),
  ('group_p01_salsa', 'dish_p01', 'Elige la salsa', 'Choose the salsa', 1, 1, 30, 1),
  ('group_p02_size', 'dish_p02', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p03_size', 'dish_p03', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p04_size', 'dish_p04', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p05_size', 'dish_p05', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p06_size', 'dish_p06', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p07_size', 'dish_p07', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p08_size', 'dish_p08', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p08_meat', 'dish_p08', 'Elige la carne', 'Choose the meat', 1, 1, 20, 1),
  ('group_p09_size', 'dish_p09', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p09_meat', 'dish_p09', 'Elige la carne', 'Choose the meat', 1, 1, 20, 1),
  ('group_p10_size', 'dish_p10', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_p10_meat', 'dish_p10', 'Elige la carne o preparación', 'Choose meat or preparation', 1, 1, 20, 1),
  ('group_day_mon_size', 'dish_day_mon', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_day_tue_size', 'dish_day_tue', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_day_thu_size', 'dish_day_thu', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_day_fri_size', 'dish_day_fri', 'Elige el tamaño', 'Choose a size', 1, 1, 10, 1),
  ('group_day_fri_meat', 'dish_day_fri', 'Elige la carne', 'Choose the meat', 1, 1, 20, 1);

INSERT INTO dish_options (id, group_id, name_es, name_en, price_delta_cents, sort_order, is_active) VALUES
  ('opt_p01_child', 'group_p01_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_p01_adult', 'group_p01_size', 'Adulto', 'Adult', 2900, 20, 1),
  ('opt_p01_chicken', 'group_p01_meat', 'Pollo', 'Chicken', 0, 10, 1),
  ('opt_p01_pastor', 'group_p01_meat', 'Pastor', 'Al pastor', 0, 20, 1),
  ('opt_p01_green', 'group_p01_salsa', 'Salsa verde', 'Green salsa', 0, 10, 1),
  ('opt_p01_red', 'group_p01_salsa', 'Salsa roja', 'Red salsa', 0, 20, 1),
  ('opt_p02_child', 'group_p02_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_p02_adult', 'group_p02_size', 'Adulto', 'Adult', 3000, 20, 1),
  ('opt_p03_child', 'group_p03_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_p03_adult', 'group_p03_size', 'Adulto', 'Adult', 3300, 20, 1),
  ('opt_p04_child', 'group_p04_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_p04_adult', 'group_p04_size', 'Adulto', 'Adult', 2500, 20, 1),
  ('opt_p05_child', 'group_p05_size', 'Niño · 3 tacos', 'Child · 3 tacos', 0, 10, 1),
  ('opt_p05_adult', 'group_p05_size', 'Adulto · 4 tacos', 'Adult · 4 tacos', 3000, 20, 1),
  ('opt_p06_child', 'group_p06_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_p06_adult', 'group_p06_size', 'Adulto', 'Adult', 3000, 20, 1),
  ('opt_p07_child', 'group_p07_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_p07_adult', 'group_p07_size', 'Adulto', 'Adult', 2500, 20, 1),
  ('opt_p08_child', 'group_p08_size', 'Niño · una tortilla', 'Child · single tortilla', 0, 10, 1),
  ('opt_p08_adult', 'group_p08_size', 'Adulto · doble tortilla', 'Adult · double tortilla', 3500, 20, 1),
  ('opt_p08_pastor', 'group_p08_meat', 'Pastor', 'Al pastor', 0, 10, 1),
  ('opt_p08_beef', 'group_p08_meat', 'Res', 'Beef', 0, 20, 1),
  ('opt_p08_chilorio', 'group_p08_meat', 'Chilorio de pollo', 'Chicken chilorio', 0, 30, 1),
  ('opt_p08_cochinita', 'group_p08_meat', 'Cochinita pibil', 'Cochinita pibil', 0, 40, 1),
  ('opt_p08_chorizo', 'group_p08_meat', 'Chorizo', 'Chorizo', 0, 50, 1),
  ('opt_p08_chicharron', 'group_p08_meat', 'Chicharrón en salsa verde', 'Pork rind in green salsa', 0, 60, 1),
  ('opt_p09_child', 'group_p09_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_p09_adult', 'group_p09_size', 'Adulto', 'Adult', 2500, 20, 1),
  ('opt_p09_chicken', 'group_p09_meat', 'Pollo', 'Chicken', 0, 10, 1),
  ('opt_p09_chorizo', 'group_p09_meat', 'Chorizo', 'Chorizo', 0, 20, 1),
  ('opt_p09_pastor', 'group_p09_meat', 'Pastor', 'Al pastor', 3000, 30, 1),
  ('opt_p09_beef', 'group_p09_meat', 'Res', 'Beef', 3000, 40, 1),
  ('opt_p09_shrimp', 'group_p09_meat', 'Camarón con chipotle', 'Chipotle shrimp', 4500, 50, 1),
  ('opt_p10_child', 'group_p10_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_p10_adult', 'group_p10_size', 'Adulto', 'Adult', 3000, 20, 1),
  ('opt_p10_chicken', 'group_p10_meat', 'Pollo', 'Chicken', 0, 10, 1),
  ('opt_p10_pastor', 'group_p10_meat', 'Pastor', 'Al pastor', 0, 20, 1),
  ('opt_p10_vegetarian', 'group_p10_meat', 'Vegetariano', 'Vegetarian', 0, 30, 1),
  ('opt_day_mon_child', 'group_day_mon_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_day_mon_adult', 'group_day_mon_size', 'Adulto', 'Adult', 2200, 20, 1),
  ('opt_day_tue_child', 'group_day_tue_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_day_tue_adult', 'group_day_tue_size', 'Adulto', 'Adult', 3000, 20, 1),
  ('opt_day_thu_child', 'group_day_thu_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_day_thu_adult', 'group_day_thu_size', 'Adulto', 'Adult', 3000, 20, 1),
  ('opt_day_fri_child', 'group_day_fri_size', 'Niño', 'Child', 0, 10, 1),
  ('opt_day_fri_adult', 'group_day_fri_size', 'Adulto', 'Adult', 2700, 20, 1),
  ('opt_day_fri_pastor', 'group_day_fri_meat', 'Pastor', 'Al pastor', 0, 10, 1),
  ('opt_day_fri_chicken', 'group_day_fri_meat', 'Pollo', 'Chicken', 0, 20, 1),
  ('opt_day_fri_beef', 'group_day_fri_meat', 'Res', 'Beef', 0, 30, 1);

PRAGMA optimize;
