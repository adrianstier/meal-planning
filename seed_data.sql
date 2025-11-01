-- Sample Data from Current Week

-- Insert family members
INSERT INTO family_members (name, age, notes) VALUES
    ('Parent 1', NULL, 'Enjoys adventurous meals'),
    ('Parent 2', NULL, 'Enjoys adventurous meals'),
    ('Zada', 7, 'Has practice on Thursdays'),
    ('Younger Child', 4, 'Needs kid-friendly options');

-- Insert meal types
INSERT INTO meal_types (name, description) VALUES
    ('dinner', 'Evening family meal'),
    ('lunch', 'Midday meal, often for kids'),
    ('snack', 'Afternoon or anytime snack'),
    ('breakfast', 'Morning meal');

-- Insert ingredients by category

-- Proteins
INSERT INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Trader Joe''s sausages', 'protein', 9, 'easy'),
    ('Chicken breast', 'protein', 8, 'medium'),
    ('Ground beef', 'protein', 9, 'easy'),
    ('Turkey slices', 'protein', 8, 'easy'),
    ('Cheddar cheese', 'protein', 10, 'easy'),
    ('Mozzarella cheese', 'protein', 10, 'easy'),
    ('Black beans', 'protein', 7, 'easy'),
    ('Pinto beans', 'protein', 7, 'easy'),
    ('Eggs', 'protein', 8, 'easy'),
    ('Peanut butter', 'protein', 10, 'easy');

-- Vegetables
INSERT INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Sweet potatoes', 'veggie', 9, 'easy'),
    ('Carrots', 'veggie', 9, 'easy'),
    ('Zucchini', 'veggie', 7, 'easy'),
    ('Corn on the cob', 'veggie', 10, 'easy'),
    ('Bell peppers', 'veggie', 7, 'easy'),
    ('Onions', 'veggie', 6, 'easy'),
    ('Green beans', 'veggie', 7, 'easy'),
    ('Broccoli', 'veggie', 6, 'easy'),
    ('Cabbage', 'veggie', 6, 'easy'),
    ('Cucumbers', 'veggie', 8, 'easy'),
    ('Snap peas', 'veggie', 8, 'easy'),
    ('Baby carrots', 'veggie', 10, 'easy');

-- Starches
INSERT INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Buttered noodles', 'starch', 10, 'easy'),
    ('Mac & cheese', 'starch', 10, 'easy'),
    ('Garlic bread', 'starch', 9, 'easy'),
    ('Mashed potatoes', 'starch', 9, 'medium'),
    ('Potato wedges', 'starch', 9, 'easy'),
    ('White rice', 'starch', 8, 'easy'),
    ('Tortillas', 'starch', 9, 'easy'),
    ('Pasta', 'starch', 10, 'easy'),
    ('Crackers', 'starch', 10, 'easy'),
    ('Pretzels', 'starch', 10, 'easy'),
    ('Bread', 'starch', 10, 'easy'),
    ('Pita chips', 'starch', 8, 'easy');

-- Fruits
INSERT INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Apple slices', 'fruit', 10, 'easy'),
    ('Grapes', 'fruit', 10, 'easy'),
    ('Berries', 'fruit', 10, 'easy'),
    ('Strawberries', 'fruit', 10, 'easy'),
    ('Pineapple', 'fruit', 9, 'easy'),
    ('Watermelon', 'fruit', 10, 'easy'),
    ('Melon cubes', 'fruit', 9, 'easy'),
    ('Orange slices', 'fruit', 9, 'easy');

-- Dairy
INSERT INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Trader Joe''s yogurt', 'dairy', 10, 'easy'),
    ('String cheese', 'dairy', 10, 'easy'),
    ('Milk', 'dairy', 10, 'easy'),
    ('Butter', 'dairy', 10, 'easy'),
    ('Shredded cheese', 'dairy', 10, 'easy');

-- Pantry/Condiments
INSERT INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Olive oil', 'pantry', 5, 'easy'),
    ('Honey', 'pantry', 10, 'easy'),
    ('Marinara sauce', 'pantry', 8, 'easy'),
    ('Hummus', 'pantry', 7, 'easy'),
    ('Guacamole', 'pantry', 7, 'easy'),
    ('Ranch dressing', 'pantry', 9, 'easy'),
    ('Lime', 'pantry', 6, 'easy'),
    ('Parmesan cheese', 'pantry', 8, 'easy'),
    ('Granola', 'pantry', 9, 'easy');

-- Snacks
INSERT INTO ingredients (name, category, kid_friendly_level, prep_difficulty) VALUES
    ('Popcorn', 'snack', 10, 'easy'),
    ('Chips', 'snack', 10, 'easy'),
    ('Fruit leather', 'snack', 10, 'easy'),
    ('Mini cookies', 'snack', 10, 'easy'),
    ('Applesauce pouches', 'snack', 10, 'easy'),
    ('Granola bars', 'snack', 10, 'easy'),
    ('Seaweed snacks', 'snack', 5, 'easy');

-- Insert meals (dinners)
INSERT INTO meals (name, meal_type_id, kid_friendly_level, prep_time_minutes, cook_time_minutes, adult_friendly, notes) VALUES
    ('Sausages with Sweet Potatoes', 1, 9, 10, 30, 1, 'Drizzle sweet potatoes with honey'),
    ('Baked Chicken with Roasted Veggies', 1, 8, 15, 40, 1, 'Make extra mac & cheese for Thursday lunch'),
    ('Grilled Chicken with Corn', 1, 9, 10, 20, 1, 'Add lime and parmesan on corn'),
    ('Beef Meatballs', 1, 8, 15, 25, 1, 'Serve peppers soft and sweet'),
    ('Turkey & Cheese Melts', 1, 9, 5, 10, 0, 'Simple midweek meal'),
    ('Chicken Tenders', 1, 10, 5, 20, 0, 'Light dinner pre-practice for Zada'),
    ('Quesadillas with Beans', 1, 9, 10, 15, 1, 'Add avocado or sour cream');

-- Insert meals (lunches)
INSERT INTO meals (name, meal_type_id, kid_friendly_level, prep_time_minutes, cook_time_minutes, adult_friendly, notes) VALUES
    ('PB&J Sandwiches', 2, 10, 5, 0, 0, 'Keep extra in freezer'),
    ('Turkey & Cheese Sandwich', 2, 10, 5, 0, 0, 'Add a cookie or yogurt'),
    ('Chicken Wraps with Cheese', 2, 9, 10, 0, 0, 'Use leftover chicken'),
    ('Mini Meatballs Lunch', 2, 8, 5, 0, 0, 'Pack warm in thermos'),
    ('Mac & Cheese Leftovers', 2, 10, 5, 0, 0, 'Warm and comforting'),
    ('Quesadilla Triangles', 2, 10, 10, 0, 0, 'Fun Friday lunch');

-- Insert meals (snacks)
INSERT INTO meals (name, meal_type_id, kid_friendly_level, prep_time_minutes, cook_time_minutes, adult_friendly, notes) VALUES
    ('Chips & Guac', 3, 8, 2, 0, 1, 'Quick and easy'),
    ('Hummus & Pita', 3, 7, 2, 0, 1, 'Portion ahead'),
    ('Veggie Sticks & Ranch', 3, 8, 5, 0, 1, 'Keep ranch cups handy'),
    ('Popcorn & String Cheese', 3, 10, 5, 0, 1, 'Easy midweek pick-me-up'),
    ('Apple Slices & PB', 3, 10, 5, 0, 1, 'Add cinnamon sprinkle'),
    ('Yogurt with Granola', 3, 10, 2, 0, 1, 'Sweet way to end week');

-- Link ingredients to meals (Saturday Dinner - Sausages)
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    (1, (SELECT id FROM ingredients WHERE name = 'Trader Joe''s sausages'), 'protein', '1 package'),
    (1, (SELECT id FROM ingredients WHERE name = 'Sweet potatoes'), 'veggie', '3 medium'),
    (1, (SELECT id FROM ingredients WHERE name = 'Buttered noodles'), 'starch', '1 lb pasta'),
    (1, (SELECT id FROM ingredients WHERE name = 'Apple slices'), 'fruit', '2 apples'),
    (1, (SELECT id FROM ingredients WHERE name = 'Honey'), 'condiment', '2 tbsp');

-- Sunday Dinner - Baked Chicken
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    (2, (SELECT id FROM ingredients WHERE name = 'Chicken breast'), 'protein', '4 pieces'),
    (2, (SELECT id FROM ingredients WHERE name = 'Carrots'), 'veggie', '1 lb'),
    (2, (SELECT id FROM ingredients WHERE name = 'Zucchini'), 'veggie', '2 medium'),
    (2, (SELECT id FROM ingredients WHERE name = 'Mac & cheese'), 'starch', '2 boxes'),
    (2, (SELECT id FROM ingredients WHERE name = 'Grapes'), 'fruit', '1 lb');

-- Monday Dinner - Grilled Chicken with Corn
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    (3, (SELECT id FROM ingredients WHERE name = 'Chicken breast'), 'protein', '4 pieces'),
    (3, (SELECT id FROM ingredients WHERE name = 'Corn on the cob'), 'veggie', '4 ears'),
    (3, (SELECT id FROM ingredients WHERE name = 'Garlic bread'), 'starch', '1 loaf'),
    (3, (SELECT id FROM ingredients WHERE name = 'Berries'), 'fruit', '2 cups'),
    (3, (SELECT id FROM ingredients WHERE name = 'Lime'), 'condiment', '1'),
    (3, (SELECT id FROM ingredients WHERE name = 'Parmesan cheese'), 'condiment', '1/4 cup');

-- Tuesday Dinner - Beef Meatballs
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    (4, (SELECT id FROM ingredients WHERE name = 'Ground beef'), 'protein', '1.5 lbs'),
    (4, (SELECT id FROM ingredients WHERE name = 'Bell peppers'), 'veggie', '2'),
    (4, (SELECT id FROM ingredients WHERE name = 'Onions'), 'veggie', '1'),
    (4, (SELECT id FROM ingredients WHERE name = 'Mashed potatoes'), 'starch', '2 lbs potatoes'),
    (4, (SELECT id FROM ingredients WHERE name = 'Pineapple'), 'fruit', '1 cup');

-- Wednesday Dinner - Turkey Melts
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    (5, (SELECT id FROM ingredients WHERE name = 'Turkey slices'), 'protein', '12 slices'),
    (5, (SELECT id FROM ingredients WHERE name = 'Cheddar cheese'), 'protein', '8 slices'),
    (5, (SELECT id FROM ingredients WHERE name = 'Green beans'), 'veggie', '1 lb'),
    (5, (SELECT id FROM ingredients WHERE name = 'Potato wedges'), 'starch', '3 potatoes'),
    (5, (SELECT id FROM ingredients WHERE name = 'Grapes'), 'fruit', '1 lb');

-- Thursday Dinner - Chicken Tenders
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    (6, (SELECT id FROM ingredients WHERE name = 'Chicken breast'), 'protein', '1.5 lbs'),
    (6, (SELECT id FROM ingredients WHERE name = 'Broccoli'), 'veggie', '2 heads'),
    (6, (SELECT id FROM ingredients WHERE name = 'White rice'), 'starch', '2 cups'),
    (6, (SELECT id FROM ingredients WHERE name = 'Watermelon'), 'fruit', '1/4 melon');

-- Friday Dinner - Quesadillas
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    (7, (SELECT id FROM ingredients WHERE name = 'Black beans'), 'protein', '1 can'),
    (7, (SELECT id FROM ingredients WHERE name = 'Shredded cheese'), 'protein', '2 cups'),
    (7, (SELECT id FROM ingredients WHERE name = 'Carrots'), 'veggie', '2'),
    (7, (SELECT id FROM ingredients WHERE name = 'Cabbage'), 'veggie', '1/4 head'),
    (7, (SELECT id FROM ingredients WHERE name = 'Tortillas'), 'starch', '8'),
    (7, (SELECT id FROM ingredients WHERE name = 'Pineapple'), 'fruit', '1 cup');

-- Add lunch meal ingredients (Sunday - PB&J)
INSERT INTO meal_ingredients (meal_id, ingredient_id, component_type, quantity) VALUES
    (8, (SELECT id FROM ingredients WHERE name = 'Peanut butter'), 'protein', '4 tbsp'),
    (8, (SELECT id FROM ingredients WHERE name = 'Bread'), 'starch', '4 slices'),
    (8, (SELECT id FROM ingredients WHERE name = 'Baby carrots'), 'veggie', '1 cup'),
    (8, (SELECT id FROM ingredients WHERE name = 'Pretzels'), 'starch', '2 cups'),
    (8, (SELECT id FROM ingredients WHERE name = 'Apple slices'), 'fruit', '1 apple');

-- Create a meal plan for the current week
INSERT INTO meal_plans (name, week_start_date, week_end_date, notes) VALUES
    ('Family Week - Sample', '2025-11-01', '2025-11-07', 'Balanced kid-friendly and adult meals');

-- Schedule meals for the week (using meal_plan_id = 1)
INSERT INTO scheduled_meals (meal_plan_id, meal_id, day_of_week, meal_date, meal_type_id, servings, notes) VALUES
    (1, 1, 'Saturday', '2025-11-01', 1, 4, 'Drizzle honey on sweet potatoes'),
    (1, 2, 'Sunday', '2025-11-02', 1, 4, 'Make extra mac & cheese'),
    (1, 3, 'Monday', '2025-11-03', 1, 4, NULL),
    (1, 4, 'Tuesday', '2025-11-04', 1, 4, NULL),
    (1, 5, 'Wednesday', '2025-11-05', 1, 4, NULL),
    (1, 6, 'Thursday', '2025-11-06', 1, 4, 'Light meal before Zada practice'),
    (1, 7, 'Friday', '2025-11-07', 1, 4, NULL);

-- Schedule lunches
INSERT INTO scheduled_meals (meal_plan_id, meal_id, day_of_week, meal_date, meal_type_id, servings, notes) VALUES
    (1, 8, 'Sunday', '2025-11-02', 2, 2, 'For the kids'),
    (1, 9, 'Monday', '2025-11-03', 2, 2, NULL),
    (1, 10, 'Tuesday', '2025-11-04', 2, 2, NULL),
    (1, 11, 'Wednesday', '2025-11-05', 2, 2, NULL),
    (1, 12, 'Thursday', '2025-11-06', 2, 2, NULL),
    (1, 13, 'Friday', '2025-11-07', 2, 2, NULL);

-- Schedule snacks
INSERT INTO scheduled_meals (meal_plan_id, meal_id, day_of_week, meal_date, meal_type_id, servings, notes) VALUES
    (1, 14, 'Sunday', '2025-11-02', 3, 4, NULL),
    (1, 15, 'Monday', '2025-11-03', 3, 4, NULL),
    (1, 16, 'Tuesday', '2025-11-04', 3, 4, NULL),
    (1, 17, 'Wednesday', '2025-11-05', 3, 4, NULL),
    (1, 18, 'Thursday', '2025-11-06', 3, 4, NULL),
    (1, 19, 'Friday', '2025-11-07', 3, 4, NULL);
