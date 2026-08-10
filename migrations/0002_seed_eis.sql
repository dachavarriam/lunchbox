INSERT INTO schools (id, slug, name, short_name)
VALUES ('school_eis', 'eis', 'Escuela Internacional Sampedrana', 'EIS');

INSERT INTO service_windows (id, school_id, service_type, label_es, label_en, delivery_time, cutoff_time) VALUES
  ('window_eis_breakfast', 'school_eis', 'breakfast', 'Desayuno', 'Breakfast', '09:00', '08:15'),
  ('window_eis_lunch', 'school_eis', 'lunch', 'Almuerzo', 'Lunch', '11:30', '10:00');

INSERT INTO classrooms (id, school_id, grade, section, classroom_name, building, guide_teacher) VALUES
  ('class_eis_3b', 'school_eis', '3°', 'B', 'Aula 12', 'Edificio Primaria', 'Miss Laura'),
  ('class_eis_ka', 'school_eis', 'Kinder', 'A', 'Aula K-A', 'Edificio Preescolar', 'Miss Andrea'),
  ('class_eis_2a', 'school_eis', '2°', 'A', 'Aula 7', 'Edificio Primaria', 'Miss Gabriela');

INSERT INTO categories (id, slug, name_es, name_en, sort_order) VALUES
  ('cat_breakfast', 'desayunos', 'Desayunos', 'Breakfast', 10),
  ('cat_lunch', 'almuerzos', 'Almuerzos', 'Lunch', 20),
  ('cat_dessert', 'postres', 'Postres', 'Desserts', 30),
  ('cat_drink', 'bebidas', 'Bebidas', 'Drinks', 40),
  ('cat_special', 'especiales', 'Especiales', 'Specials', 50);

INSERT INTO dishes (id, category_id, slug, name_es, name_en, description_es, description_en, price_cents, emoji, badge_es, badge_en) VALUES
  ('dish_b01', 'cat_breakfast', 'mini-pancakes', 'Mini pancakes', 'Mini pancakes', 'Banano, miel y yogurt natural.', 'Banana, honey and plain yogurt.', 8500, '🥞', 'Favorito', 'Favorite'),
  ('dish_b02', 'cat_breakfast', 'baleada-escolar', 'Baleada escolar', 'School baleada', 'Frijoles, queso y huevo en tortilla de harina.', 'Beans, cheese and egg in a flour tortilla.', 7500, '🫓', 'Catracha', 'Local favorite'),
  ('dish_b03', 'cat_breakfast', 'molletes-escolares', 'Molletes escolares', 'School molletes', 'Pan horneado, frijoles, queso y fruta.', 'Baked bread, beans, cheese and fruit.', 9000, '🥖', NULL, NULL),
  ('dish_b04', 'cat_breakfast', 'avena-frutas', 'Avena con frutas', 'Oatmeal with fruit', 'Avena cremosa, banano, fresa y canela.', 'Creamy oatmeal, banana, strawberry and cinnamon.', 8000, '🥣', 'Balanceado', 'Balanced'),
  ('dish_b05', 'cat_breakfast', 'sandwich-huevo', 'Sándwich de huevo', 'Egg sandwich', 'Huevo, queso y aguacate en pan suave.', 'Egg, cheese and avocado on soft bread.', 9500, '🥪', NULL, NULL),
  ('dish_l01', 'cat_lunch', 'quesadilla-pollo', 'Quesadilla de pollo', 'Chicken quesadilla', 'Pollo, queso, frijoles y pico de gallo.', 'Chicken, cheese, beans and pico de gallo.', 11500, '🌮', 'Favorito', 'Favorite'),
  ('dish_l02', 'cat_lunch', 'bowl-mexicano', 'Bowl mexicano', 'Mexican bowl', 'Arroz, pollo, maíz, frijoles y aguacate.', 'Rice, chicken, corn, beans and avocado.', 12500, '🥑', 'Balanceado', 'Balanced'),
  ('dish_l03', 'cat_lunch', 'taquitos-suaves', 'Taquitos suaves', 'Soft tacos', 'Tres taquitos de pollo con arroz.', 'Three chicken tacos with rice.', 11000, '🌯', 'Nuevo', 'New'),
  ('dish_l04', 'cat_lunch', 'pollo-plancha', 'Pollo a la plancha', 'Grilled chicken', 'Pollo, puré de papa y vegetales.', 'Chicken, mashed potatoes and vegetables.', 13500, '🍗', NULL, NULL),
  ('dish_l05', 'cat_lunch', 'pasta-pomodoro', 'Pasta pomodoro', 'Pasta pomodoro', 'Pasta corta, salsa de tomate y queso aparte.', 'Short pasta, tomato sauce and cheese on the side.', 12000, '🍝', 'Sin picante', 'Mild'),
  ('dish_d01', 'cat_dessert', 'brownie-cacao', 'Brownie de cacao', 'Cocoa brownie', 'Porción escolar horneada, suave y chocolatosa.', 'A soft, chocolatey school-size portion.', 4500, '🍫', NULL, NULL),
  ('dish_d02', 'cat_dessert', 'galleta-avena', 'Galleta de avena', 'Oat cookie', 'Avena, canela y pasas.', 'Oats, cinnamon and raisins.', 3500, '🍪', NULL, NULL),
  ('dish_d03', 'cat_dessert', 'vasito-frutas', 'Vasito de frutas', 'Fruit cup', 'Frutas frescas de temporada.', 'Fresh seasonal fruit.', 5000, '🍓', 'Fresco', 'Fresh'),
  ('dish_d04', 'cat_dessert', 'arroz-leche', 'Arroz con leche', 'Rice pudding', 'Arroz cremoso con canela.', 'Creamy rice pudding with cinnamon.', 4500, '🍚', NULL, NULL),
  ('dish_d05', 'cat_dessert', 'gelatina-colores', 'Gelatina de colores', 'Colorful gelatin', 'Gelatina frutal en porción individual.', 'Individual fruit gelatin.', 3000, '🍮', NULL, NULL),
  ('dish_r01', 'cat_drink', 'agua-purificada', 'Agua purificada', 'Purified water', 'Botella individual de 12 oz.', 'Individual 12 oz bottle.', 2500, '💧', NULL, NULL),
  ('dish_r02', 'cat_drink', 'agua-jamaica', 'Agua de jamaica', 'Hibiscus water', 'Natural y ligeramente endulzada, 12 oz.', 'Natural and lightly sweetened, 12 oz.', 3000, '🥤', NULL, NULL),
  ('dish_r03', 'cat_drink', 'limonada-natural', 'Limonada natural', 'Fresh lemonade', 'Limón fresco y poca azúcar, 12 oz.', 'Fresh lime and light sugar, 12 oz.', 3500, '🍋', NULL, NULL),
  ('dish_r04', 'cat_drink', 'jugo-naranja', 'Jugo de naranja', 'Orange juice', 'Jugo de naranja, 10 oz.', 'Orange juice, 10 oz.', 4000, '🍊', NULL, NULL),
  ('dish_r05', 'cat_drink', 'leche-chocolate', 'Leche con chocolate', 'Chocolate milk', 'Leche fría con cacao, 8 oz.', 'Cold cocoa milk, 8 oz.', 4000, '🥛', NULL, NULL),
  ('dish_s01', 'cat_special', 'taco-tuesday', 'Taco Tuesday', 'Taco Tuesday', 'Combo de tacos, arroz y bebida del día.', 'Taco combo with rice and drink of the day.', 14500, '🌮', 'Especial', 'Special'),
  ('dish_s02', 'cat_special', 'viernes-pizza', 'Viernes de pizza', 'Pizza Friday', 'Pizza personal de queso con fruta.', 'Personal cheese pizza with fruit.', 14000, '🍕', 'Viernes', 'Friday'),
  ('dish_s03', 'cat_special', 'bowl-vegetariano', 'Bowl vegetariano', 'Vegetarian bowl', 'Arroz, frijoles, vegetales y aguacate.', 'Rice, beans, vegetables and avocado.', 12000, '🥗', 'Vegetariano', 'Vegetarian'),
  ('dish_s04', 'cat_special', 'combo-cumpleanos', 'Combo de cumpleaños', 'Birthday combo', 'Mini hamburguesa, papas horneadas y postre.', 'Mini burger, baked fries and dessert.', 15500, '🎉', 'Celebración', 'Celebration'),
  ('dish_s05', 'cat_special', 'especial-chef', 'Especial del chef', 'Chef special', 'Platillo rotativo preparado para la semana.', 'Rotating weekly chef special.', 15000, '👨‍🍳', 'Semanal', 'Weekly');
