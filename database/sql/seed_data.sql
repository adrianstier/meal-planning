-- Essential seed data (no sample meals)
-- This file sets up default categories and ingredients only

-- Insert meal types (required for the app to function)
INSERT OR IGNORE INTO meal_types (name, description) VALUES
    ('dinner', 'Evening family meal'),
    ('lunch', 'Midday meal'),
    ('snack', 'Afternoon or anytime snack'),
    ('breakfast', 'Morning meal');

-- Note: Sample meals, ingredients, and meal plans have been removed.
-- Users should add their own recipes through the app interface.
