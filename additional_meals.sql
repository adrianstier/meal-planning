-- Additional Meal Data
-- More dinner options, easy meals, and breakfast ideas

-- Add more ingredients first

-- More proteins
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Fish fillets', 'protein', 7, 'medium'),
    ('Chicken sausage', 'protein', 9, 'easy'),
    ('Ham', 'protein', 8, 'easy'),
    ('Mussels', 'protein', 4, 'medium'),
    ('Salmon', 'protein', 6, 'medium'),
    ('Cream cheese', 'protein', 8, 'easy');

-- More veggies
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Blackened broccoli', 'veggie', 7, 'easy'),
    ('Mushrooms', 'veggie', 5, 'easy'),
    ('Tomatoes', 'veggie', 8, 'easy'),
    ('Squash', 'veggie', 6, 'medium'),
    ('Mixed vegetables', 'veggie', 7, 'easy'),
    ('Lettuce', 'veggie', 7, 'easy'),
    ('Pita bread', 'veggie', 9, 'easy');

-- More starches
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Bowtie pasta', 'starch', 10, 'easy'),
    ('Frites (french fries)', 'starch', 10, 'easy'),
    ('Pesto', 'starch', 7, 'easy'),
    ('Bagel', 'starch', 10, 'easy'),
    ('Crepes', 'starch', 8, 'medium'),
    ('Oats', 'starch', 8, 'easy');

-- More fruits
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Banana', 'fruit', 10, 'easy'),
    ('Mixed berries', 'fruit', 10, 'easy');

-- More dairy
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Greek yogurt', 'dairy', 9, 'easy'),
    ('Feta cheese', 'dairy', 6, 'easy');

-- More pantry items
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Avocado', 'pantry', 7, 'easy'),
    ('Salsa', 'pantry', 8, 'easy'),
    ('Sour cream', 'pantry', 8, 'easy'),
    ('Pesto sauce', 'pantry', 7, 'easy'),
    ('Parmesan', 'pantry', 8, 'easy'),
    ('Tomato sauce', 'pantry', 9, 'easy');

-- More snacks
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Veggie pot stickers', 'snack', 8, 'easy'),
    ('Hard boiled egg', 'snack', 7, 'easy');

-- Insert additional dinner meals

-- Regular dinner meals
INSERT INTO meals (name, meal_type_id, kid_friendly_level, prep_time_minutes, cook_time_minutes, adult_friendly, notes) VALUES
    ('Fish with Veggies and Rice', 1, 7, 10, 20, 1, 'Simple and healthy'),
    ('Pita Chicken Burrito Bowl', 1, 8, 15, 20, 1, 'Customizable bowls'),
    ('Tortilla Soup', 1, 7, 15, 30, 1, 'Warm and comforting'),
    ('Rice Avo Veggie Bean Bowl', 1, 7, 10, 15, 1, 'Vegetarian option'),
    ('Chicken Sausage with Blackened Broccoli & Bowties', 1, 9, 10, 25, 1, 'Kid favorite'),
    ('Squash Soup', 1, 6, 15, 35, 1, 'Fall favorite'),
    ('Mussels Frites', 1, 4, 10, 20, 1, 'Adult meal - have backup for kids');

-- Easy meals
INSERT INTO meals (name, meal_type_id, kid_friendly_level, prep_time_minutes, cook_time_minutes, adult_friendly, notes) VALUES
    ('Pesto Pasta', 1, 9, 5, 15, 1, 'Super quick weeknight meal'),
    ('Quesadillas', 1, 10, 5, 10, 1, 'Always a hit'),
    ('Grilled Cheese', 1, 10, 5, 10, 0, 'Classic kid meal'),
    ('Tomato Parmesan Pasta', 1, 9, 5, 20, 1, 'Simple and delicious'),
    ('Veggie Pot Stickers', 1, 8, 5, 12, 1, 'Quick frozen option'),
    ('Veggie Burgers', 1, 8, 5, 15, 1, 'Meatless Monday option'),
    ('Greek Hummus Pita with Yogurt', 1, 7, 10, 0, 1, 'No-cook Mediterranean'),
    ('Mushroom Burger', 1, 7, 10, 15, 1, 'Vegetarian option'),
    ('Dinner Crepes - Veggie/Ham & Cheese', 1, 8, 15, 20, 1, 'Fun weekend dinner');

-- Breakfast meals
INSERT INTO meals (name, meal_type_id, kid_friendly_level, prep_time_minutes, cook_time_minutes, adult_friendly, notes) VALUES
    ('Oatmeal', 4, 8, 5, 10, 1, 'Warm and filling'),
    ('Scrambled Eggs', 4, 9, 5, 10, 1, 'Classic breakfast'),
    ('Yogurt Bowl', 4, 10, 5, 0, 1, 'Quick and healthy'),
    ('Boiled Eggs with Toast', 4, 8, 5, 10, 1, 'Protein-packed'),
    ('Egg-in-Hole Toast', 4, 9, 5, 10, 1, 'Fun for kids'),
    ('Overnight Banana Oats', 4, 9, 5, 0, 1, 'Prep ahead option'),
    ('Bagel with Salmon & Cream Cheese', 4, 6, 5, 0, 1, 'More adult breakfast'),
    ('Berry Smoothie', 4, 10, 5, 0, 1, 'Quick and refreshing'),
    ('Avocado Toast with Hard Boiled Egg', 4, 7, 10, 0, 1, 'Trendy and filling');

-- Link ingredients to new meals

-- Fish with Veggies and Rice
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Fish with Veggies and Rice'),
     (SELECT id FROM ingredients WHERE name = 'Fish fillets'), 'protein', '4 fillets'),
    ((SELECT id FROM meals WHERE name = 'Fish with Veggies and Rice'),
     (SELECT id FROM ingredients WHERE name = 'Mixed vegetables'), 'veggie', '3 cups'),
    ((SELECT id FROM meals WHERE name = 'Fish with Veggies and Rice'),
     (SELECT id FROM ingredients WHERE name = 'White rice'), 'starch', '2 cups');

-- Pita Chicken Burrito Bowl
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Pita Chicken Burrito Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Chicken breast'), 'protein', '1.5 lbs'),
    ((SELECT id FROM meals WHERE name = 'Pita Chicken Burrito Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Lettuce'), 'veggie', '1 head'),
    ((SELECT id FROM meals WHERE name = 'Pita Chicken Burrito Bowl'),
     (SELECT id FROM ingredients WHERE name = 'White rice'), 'starch', '2 cups'),
    ((SELECT id FROM meals WHERE name = 'Pita Chicken Burrito Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Avocado'), 'side', '2'),
    ((SELECT id FROM meals WHERE name = 'Pita Chicken Burrito Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Salsa'), 'condiment', '1 cup');

-- Tortilla Soup
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Tortilla Soup'),
     (SELECT id FROM ingredients WHERE name = 'Chicken breast'), 'protein', '1 lb'),
    ((SELECT id FROM meals WHERE name = 'Tortilla Soup'),
     (SELECT id FROM ingredients WHERE name = 'Tomatoes'), 'veggie', '3 cups'),
    ((SELECT id FROM meals WHERE name = 'Tortilla Soup'),
     (SELECT id FROM ingredients WHERE name = 'Tortillas'), 'starch', '6'),
    ((SELECT id FROM meals WHERE name = 'Tortilla Soup'),
     (SELECT id FROM ingredients WHERE name = 'Avocado'), 'side', '1');

-- Rice Avo Veggie Bean Bowl
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Rice Avo Veggie Bean Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Black beans'), 'protein', '2 cans'),
    ((SELECT id FROM meals WHERE name = 'Rice Avo Veggie Bean Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Mixed vegetables'), 'veggie', '3 cups'),
    ((SELECT id FROM meals WHERE name = 'Rice Avo Veggie Bean Bowl'),
     (SELECT id FROM ingredients WHERE name = 'White rice'), 'starch', '2 cups'),
    ((SELECT id FROM meals WHERE name = 'Rice Avo Veggie Bean Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Avocado'), 'side', '2');

-- Chicken Sausage with Blackened Broccoli & Bowties
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Chicken Sausage with Blackened Broccoli & Bowties'),
     (SELECT id FROM ingredients WHERE name = 'Chicken sausage'), 'protein', '1 package'),
    ((SELECT id FROM meals WHERE name = 'Chicken Sausage with Blackened Broccoli & Bowties'),
     (SELECT id FROM ingredients WHERE name = 'Blackened broccoli'), 'veggie', '2 heads'),
    ((SELECT id FROM meals WHERE name = 'Chicken Sausage with Blackened Broccoli & Bowties'),
     (SELECT id FROM ingredients WHERE name = 'Bowtie pasta'), 'starch', '1 lb');

-- Squash Soup
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Squash Soup'),
     (SELECT id FROM ingredients WHERE name = 'Squash'), 'veggie', '2 lbs'),
    ((SELECT id FROM meals WHERE name = 'Squash Soup'),
     (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '1 loaf');

-- Mussels Frites
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Mussels Frites'),
     (SELECT id FROM ingredients WHERE name = 'Mussels'), 'protein', '2 lbs'),
    ((SELECT id FROM meals WHERE name = 'Mussels Frites'),
     (SELECT id FROM ingredients WHERE name = 'Frites (french fries)'), 'starch', '2 lbs');

-- Pesto Pasta
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Pesto Pasta'),
     (SELECT id FROM ingredients WHERE name = 'Pasta'), 'starch', '1 lb'),
    ((SELECT id FROM meals WHERE name = 'Pesto Pasta'),
     (SELECT id FROM ingredients WHERE name = 'Pesto sauce'), 'condiment', '1 jar'),
    ((SELECT id FROM meals WHERE name = 'Pesto Pasta'),
     (SELECT id FROM ingredients WHERE name = 'Parmesan'), 'condiment', '1/2 cup');

-- Grilled Cheese
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Grilled Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Cheddar cheese'), 'protein', '8 slices'),
    ((SELECT id FROM meals WHERE name = 'Grilled Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '8 slices'),
    ((SELECT id FROM meals WHERE name = 'Grilled Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Butter'), 'condiment', '4 tbsp');

-- Tomato Parmesan Pasta
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Tomato Parmesan Pasta'),
     (SELECT id FROM ingredients WHERE name = 'Pasta'), 'starch', '1 lb'),
    ((SELECT id FROM meals WHERE name = 'Tomato Parmesan Pasta'),
     (SELECT id FROM ingredients WHERE name = 'Tomato sauce'), 'condiment', '2 cups'),
    ((SELECT id FROM meals WHERE name = 'Tomato Parmesan Pasta'),
     (SELECT id FROM ingredients WHERE name = 'Parmesan'), 'condiment', '1 cup');

-- Veggie Burgers
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Veggie Burgers'),
     (SELECT id FROM ingredients WHERE name = 'Black beans'), 'protein', '2 cans'),
    ((SELECT id FROM meals WHERE name = 'Veggie Burgers'),
     (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '4 buns'),
    ((SELECT id FROM meals WHERE name = 'Veggie Burgers'),
     (SELECT id FROM ingredients WHERE name = 'Lettuce'), 'veggie', '4 leaves');

-- Greek Hummus Pita
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Greek Hummus Pita with Yogurt'),
     (SELECT id FROM ingredients WHERE name = 'Hummus'), 'protein', '1 container'),
    ((SELECT id FROM meals WHERE name = 'Greek Hummus Pita with Yogurt'),
     (SELECT id FROM ingredients WHERE name = 'Pita bread'), 'starch', '6 pitas'),
    ((SELECT id FROM meals WHERE name = 'Greek Hummus Pita with Yogurt'),
     (SELECT id FROM ingredients WHERE name = 'Greek yogurt'), 'side', '2 cups'),
    ((SELECT id FROM meals WHERE name = 'Greek Hummus Pita with Yogurt'),
     (SELECT id FROM ingredients WHERE name = 'Cucumbers'), 'veggie', '2');

-- Mushroom Burger
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Mushroom Burger'),
     (SELECT id FROM ingredients WHERE name = 'Mushrooms'), 'protein', '4 large portobello'),
    ((SELECT id FROM meals WHERE name = 'Mushroom Burger'),
     (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '4 buns'),
    ((SELECT id FROM meals WHERE name = 'Mushroom Burger'),
     (SELECT id FROM ingredients WHERE name = 'Lettuce'), 'veggie', '4 leaves');

-- Dinner Crepes
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Dinner Crepes - Veggie/Ham & Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Ham'), 'protein', '8 slices'),
    ((SELECT id FROM meals WHERE name = 'Dinner Crepes - Veggie/Ham & Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Shredded cheese'), 'protein', '2 cups'),
    ((SELECT id FROM meals WHERE name = 'Dinner Crepes - Veggie/Ham & Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Crepes'), 'starch', '8'),
    ((SELECT id FROM meals WHERE name = 'Dinner Crepes - Veggie/Ham & Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Mixed vegetables'), 'veggie', '2 cups');

-- Breakfast meals ingredients

-- Oatmeal
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Oatmeal'),
     (SELECT id FROM ingredients WHERE name = 'Oats'), 'starch', '2 cups'),
    ((SELECT id FROM meals WHERE name = 'Oatmeal'),
     (SELECT id FROM ingredients WHERE name = 'Banana'), 'fruit', '2'),
    ((SELECT id FROM meals WHERE name = 'Oatmeal'),
     (SELECT id FROM ingredients WHERE name = 'Mixed berries'), 'fruit', '1 cup');

-- Scrambled Eggs
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Scrambled Eggs'),
     (SELECT id FROM ingredients WHERE name = 'Eggs'), 'protein', '8'),
    ((SELECT id FROM meals WHERE name = 'Scrambled Eggs'),
     (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '4 slices');

-- Yogurt Bowl
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Yogurt Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Greek yogurt'), 'protein', '3 cups'),
    ((SELECT id FROM meals WHERE name = 'Yogurt Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Granola'), 'starch', '1 cup'),
    ((SELECT id FROM meals WHERE name = 'Yogurt Bowl'),
     (SELECT id FROM ingredients WHERE name = 'Mixed berries'), 'fruit', '2 cups');

-- Boiled Eggs with Toast
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Boiled Eggs with Toast'),
     (SELECT id FROM ingredients WHERE name = 'Eggs'), 'protein', '6'),
    ((SELECT id FROM meals WHERE name = 'Boiled Eggs with Toast'),
     (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '4 slices');

-- Egg-in-Hole Toast
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Egg-in-Hole Toast'),
     (SELECT id FROM ingredients WHERE name = 'Eggs'), 'protein', '4'),
    ((SELECT id FROM meals WHERE name = 'Egg-in-Hole Toast'),
     (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '4 slices');

-- Overnight Banana Oats
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Overnight Banana Oats'),
     (SELECT id FROM ingredients WHERE name = 'Oats'), 'starch', '2 cups'),
    ((SELECT id FROM meals WHERE name = 'Overnight Banana Oats'),
     (SELECT id FROM ingredients WHERE name = 'Banana'), 'fruit', '2'),
    ((SELECT id FROM meals WHERE name = 'Overnight Banana Oats'),
     (SELECT id FROM ingredients WHERE name = 'Milk'), 'protein', '2 cups');

-- Bagel with Salmon & Cream Cheese
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Bagel with Salmon & Cream Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Salmon'), 'protein', '8 oz'),
    ((SELECT id FROM meals WHERE name = 'Bagel with Salmon & Cream Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Cream cheese'), 'protein', '4 oz'),
    ((SELECT id FROM meals WHERE name = 'Bagel with Salmon & Cream Cheese'),
     (SELECT id FROM ingredients WHERE name = 'Bagel'), 'starch', '4');

-- Berry Smoothie
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Berry Smoothie'),
     (SELECT id FROM ingredients WHERE name = 'Mixed berries'), 'fruit', '3 cups'),
    ((SELECT id FROM meals WHERE name = 'Berry Smoothie'),
     (SELECT id FROM ingredients WHERE name = 'Greek yogurt'), 'protein', '2 cups'),
    ((SELECT id FROM meals WHERE name = 'Berry Smoothie'),
     (SELECT id FROM ingredients WHERE name = 'Banana'), 'fruit', '2');

-- Avocado Toast with Hard Boiled Egg
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    ((SELECT id FROM meals WHERE name = 'Avocado Toast with Hard Boiled Egg'),
     (SELECT id FROM ingredients WHERE name = 'Avocado'), 'protein', '2'),
    ((SELECT id FROM meals WHERE name = 'Avocado Toast with Hard Boiled Egg'),
     (SELECT id FROM ingredients WHERE name = 'Hard boiled egg'), 'protein', '4'),
    ((SELECT id FROM meals WHERE name = 'Avocado Toast with Hard Boiled Egg'),
     (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '4 slices');
