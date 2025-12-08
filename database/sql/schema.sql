-- Meal Planning Database Schema

-- Family members
CREATE TABLE family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    dietary_preferences TEXT,
    notes TEXT
);

-- Ingredients catalog
CREATE TABLE ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- 'protein', 'veggie', 'starch', 'fruit', 'dairy', 'pantry', 'snack'
    kid_friendly_level INTEGER DEFAULT 5, -- 1-10 scale (10 = most kid friendly)
    prep_difficulty TEXT DEFAULT 'easy', -- 'easy', 'medium', 'hard'
    notes TEXT
);

-- Meal types
CREATE TABLE meal_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- 'dinner', 'lunch', 'snack', 'breakfast'
    description TEXT
);

-- Recipes/Meals
CREATE TABLE meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    meal_type_id INTEGER NOT NULL,
    kid_friendly_level INTEGER DEFAULT 5, -- 1-10 scale
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    adult_friendly BOOLEAN DEFAULT 1,
    notes TEXT,
    -- Extended recipe fields (added for React frontend)
    difficulty TEXT,
    servings INTEGER,
    tags TEXT,
    ingredients TEXT,
    instructions TEXT,
    cuisine TEXT,
    image_url TEXT,
    source_url TEXT,
    top_comments TEXT,
    FOREIGN KEY (meal_type_id) REFERENCES meal_types(id)
);

-- Meal components (links meals to ingredients with portions)
CREATE TABLE meal_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    component_type TEXT NOT NULL, -- 'protein', 'veggie', 'starch', 'fruit', 'side', 'condiment'
    quantity TEXT, -- '2 cups', '1 lb', etc.
    is_optional BOOLEAN DEFAULT 0,
    FOREIGN KEY (meal_id) REFERENCES meals(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- Weekly meal plans
CREATE TABLE meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled meals in a plan
CREATE TABLE scheduled_meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_plan_id INTEGER NOT NULL,
    meal_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL, -- 'Saturday', 'Sunday', etc.
    meal_date DATE NOT NULL,
    meal_type_id INTEGER NOT NULL,
    servings INTEGER DEFAULT 4,
    notes TEXT,
    FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id),
    FOREIGN KEY (meal_id) REFERENCES meals(id),
    FOREIGN KEY (meal_type_id) REFERENCES meal_types(id)
);

-- Shopping list
CREATE TABLE shopping_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_plan_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_completed BOOLEAN DEFAULT 0,
    FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id)
);

-- Shopping list items
CREATE TABLE shopping_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shopping_list_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    quantity TEXT,
    category TEXT,
    is_purchased BOOLEAN DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- School cafeteria menu tracking
CREATE TABLE IF NOT EXISTS school_menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_date DATE NOT NULL,
    meal_name TEXT NOT NULL,
    meal_type TEXT DEFAULT 'lunch', -- lunch, breakfast, snack
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(menu_date, meal_name, meal_type) -- Prevent duplicate entries for same day
);

-- School menu feedback (track what kids like/dislike)
CREATE TABLE IF NOT EXISTS school_menu_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    feedback_type TEXT CHECK(feedback_type IN ('disliked', 'allergic', 'wont_eat')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES school_menu_items(id) ON DELETE CASCADE
);

-- Leftovers inventory
CREATE TABLE IF NOT EXISTS leftovers_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER,
    meal_name TEXT NOT NULL,
    servings_left INTEGER NOT NULL,
    date_cooked DATE NOT NULL,
    expiration_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id)
);

-- Meal history (track what was actually eaten)
CREATE TABLE IF NOT EXISTS meal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    date_eaten DATE NOT NULL,
    meal_type TEXT NOT NULL,
    servings INTEGER DEFAULT 4,
    rating INTEGER CHECK(rating >= 1 AND rating <= 10),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id)
);

-- Meal favorites
CREATE TABLE IF NOT EXISTS meal_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL UNIQUE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id)
);

-- Indexes for better query performance
CREATE INDEX idx_meal_ingredients_meal ON meal_ingredients(meal_id);
CREATE INDEX idx_meal_ingredients_ingredient ON meal_ingredients(ingredient_id);
CREATE INDEX idx_scheduled_meals_plan ON scheduled_meals(meal_plan_id);
CREATE INDEX idx_scheduled_meals_date ON scheduled_meals(meal_date);
CREATE INDEX idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_school_menu_date ON school_menu_items(menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_school_menu_type ON school_menu_items(meal_type);
CREATE INDEX IF NOT EXISTS idx_school_feedback_item ON school_menu_feedback(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_leftovers_expiration ON leftovers_inventory(expiration_date);
CREATE INDEX IF NOT EXISTS idx_meal_history_date ON meal_history(date_eaten DESC);
