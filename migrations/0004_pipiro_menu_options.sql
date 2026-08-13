PRAGMA foreign_keys = ON;

INSERT INTO categories (id, slug, name_es, name_en, sort_order, is_active)
VALUES ('cat_permanent', 'menu-permanente', 'Menú permanente', 'Always available', 10, 1)
ON CONFLICT(id) DO UPDATE SET
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  sort_order = excluded.sort_order,
  is_active = 1;

UPDATE categories
SET is_active = 0
WHERE id IN ('cat_breakfast', 'cat_lunch', 'cat_dessert');

UPDATE categories
SET name_es = 'Especialidades', name_en = 'Specials', sort_order = 30, is_active = 1
WHERE id = 'cat_special';

UPDATE categories SET sort_order = 20, is_active = 1 WHERE id = 'cat_drink';

UPDATE dishes
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE category_id != 'cat_drink';

INSERT INTO dishes (
  id, category_id, slug, name_es, name_en, description_es, description_en,
  price_cents, emoji, badge_es, badge_en, is_active
) VALUES
  ('dish_p01', 'cat_permanent', 'chilaquiles', 'Chilaquiles', 'Chilaquiles', 'Totopos bañados en salsa, crema, queso y la preparación que elijas.', 'Tortilla chips with salsa, cream, cheese and your chosen topping.', 14500, '🍳', 'Siempre disponible', 'Always available', 1),
  ('dish_p02', 'cat_permanent', 'tacos', 'Tacos', 'Tacos', 'Tacos preparados al momento con la carne que prefieras.', 'Freshly prepared tacos with your choice of filling.', 13500, '🌮', 'Favorito', 'Favorite', 1),
  ('dish_p03', 'cat_permanent', 'nachos', 'Nachos', 'Nachos', 'Totopos crujientes con frijoles, queso y tu carne favorita.', 'Crispy tortilla chips with beans, cheese and your favorite meat.', 13000, '🧀', NULL, NULL, 1),
  ('dish_p04', 'cat_permanent', 'enchiladas', 'Enchiladas', 'Enchiladas', 'Enchiladas mexicanas con crema, queso y salsa a elección.', 'Mexican enchiladas with cream, cheese and your choice of salsa.', 12500, '🫔', NULL, NULL, 1),
  ('dish_p05', 'cat_permanent', 'sopa-tesposteca', 'Sopa Tesposteca', 'Tesposteca soup', 'Sopa tradicional mexicana servida caliente.', 'Traditional Mexican soup served warm.', 15500, '🍲', NULL, NULL, 1),
  ('dish_p06', 'cat_permanent', 'tacos-birria', 'Tacos Birria', 'Birria tacos', 'Tacos de birria con su consomé y opción de queso.', 'Birria tacos with consommé and an optional cheese preparation.', 17500, '🌮', 'Especial de la casa', 'House special', 1),
  ('dish_p07', 'cat_permanent', 'gringas', 'Gringas', 'Gringas', 'Tortilla de harina con queso y la carne que elijas.', 'Flour tortilla with cheese and your choice of meat.', 15000, '🌯', NULL, NULL, 1),
  ('dish_p08', 'cat_permanent', 'tacos-flautas', 'Tacos Flautas', 'Flauta tacos', 'Flautas doradas y crujientes con la carne que prefieras.', 'Golden crispy flautas with your choice of meat.', 14000, '🌯', NULL, NULL, 1)
ON CONFLICT(id) DO UPDATE SET
  category_id = excluded.category_id,
  slug = excluded.slug,
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  description_es = excluded.description_es,
  description_en = excluded.description_en,
  price_cents = excluded.price_cents,
  emoji = excluded.emoji,
  badge_es = excluded.badge_es,
  badge_en = excluded.badge_en,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

CREATE TABLE dish_option_groups (
  id TEXT PRIMARY KEY,
  dish_id TEXT NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  min_select INTEGER NOT NULL DEFAULT 1 CHECK (min_select >= 0),
  max_select INTEGER NOT NULL DEFAULT 1 CHECK (max_select >= min_select),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE dish_options (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES dish_option_groups(id) ON DELETE CASCADE,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price_delta_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE INDEX idx_dish_option_groups_dish
ON dish_option_groups(dish_id, is_active, sort_order);

CREATE INDEX idx_dish_options_group
ON dish_options(group_id, is_active, sort_order);

ALTER TABLE order_items ADD COLUMN options_snapshot_json TEXT;

INSERT INTO dish_option_groups (id, dish_id, name_es, name_en, sort_order) VALUES
  ('group_chilaquiles_salsa', 'dish_p01', 'Elige tu salsa', 'Choose your salsa', 10),
  ('group_chilaquiles_protein', 'dish_p01', 'Elige la preparación', 'Choose the filling', 20),
  ('group_tacos_protein', 'dish_p02', 'Elige la preparación', 'Choose the filling', 10),
  ('group_nachos_protein', 'dish_p03', 'Elige la preparación', 'Choose the filling', 10),
  ('group_enchiladas_salsa', 'dish_p04', 'Elige tu salsa', 'Choose your salsa', 10),
  ('group_birria_cheese', 'dish_p06', 'Elige la preparación', 'Choose the preparation', 10),
  ('group_gringas_protein', 'dish_p07', 'Elige la preparación', 'Choose the filling', 10),
  ('group_flautas_protein', 'dish_p08', 'Elige la preparación', 'Choose the filling', 10);

INSERT INTO dish_options (id, group_id, name_es, name_en, sort_order) VALUES
  ('opt_chil_salsa_verde', 'group_chilaquiles_salsa', 'Salsa verde', 'Green salsa', 10),
  ('opt_chil_salsa_roja', 'group_chilaquiles_salsa', 'Salsa roja', 'Red salsa', 20),
  ('opt_chil_pollo', 'group_chilaquiles_protein', 'Pollo', 'Chicken', 10),
  ('opt_chil_pastor', 'group_chilaquiles_protein', 'Pastor', 'Al pastor', 20),
  ('opt_chil_huevo', 'group_chilaquiles_protein', 'Huevo', 'Egg', 30),
  ('opt_chil_res', 'group_chilaquiles_protein', 'Res', 'Beef', 40),
  ('opt_taco_pastor', 'group_tacos_protein', 'Pastor', 'Al pastor', 10),
  ('opt_taco_chilorio', 'group_tacos_protein', 'Chilorio de pollo', 'Chicken chilorio', 20),
  ('opt_taco_chorizo', 'group_tacos_protein', 'Chorizo', 'Chorizo', 30),
  ('opt_taco_res', 'group_tacos_protein', 'Res', 'Beef', 40),
  ('opt_taco_cochinita', 'group_tacos_protein', 'Cochinita pibil', 'Cochinita pibil', 50),
  ('opt_nachos_pollo', 'group_nachos_protein', 'Pollo', 'Chicken', 10),
  ('opt_nachos_pastor', 'group_nachos_protein', 'Pastor', 'Al pastor', 20),
  ('opt_nachos_res', 'group_nachos_protein', 'Res', 'Beef', 30),
  ('opt_enchiladas_verde', 'group_enchiladas_salsa', 'Salsa verde', 'Green salsa', 10),
  ('opt_enchiladas_roja', 'group_enchiladas_salsa', 'Salsa roja', 'Red salsa', 20),
  ('opt_birria_con_queso', 'group_birria_cheese', 'Con queso', 'With cheese', 10),
  ('opt_birria_sin_queso', 'group_birria_cheese', 'Sin queso', 'Without cheese', 20),
  ('opt_gringas_pollo', 'group_gringas_protein', 'Pollo', 'Chicken', 10),
  ('opt_gringas_pastor', 'group_gringas_protein', 'Pastor', 'Al pastor', 20),
  ('opt_gringas_res', 'group_gringas_protein', 'Res', 'Beef', 30),
  ('opt_flautas_pollo', 'group_flautas_protein', 'Pollo', 'Chicken', 10),
  ('opt_flautas_pastor', 'group_flautas_protein', 'Pastor', 'Al pastor', 20),
  ('opt_flautas_res', 'group_flautas_protein', 'Res', 'Beef', 30);

PRAGMA optimize;
