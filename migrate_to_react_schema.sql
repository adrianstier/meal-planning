-- Migration: Update database schema to match React app expectations
-- This adds the new columns needed by the React TypeScript app

-- Add new columns to meals table if they don't exist
ALTER TABLE meals ADD COLUMN meal_type TEXT;
ALTER TABLE meals ADD COLUMN servings INTEGER;
ALTER TABLE meals ADD COLUMN difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard'));
ALTER TABLE meals ADD COLUMN tags TEXT;
ALTER TABLE meals ADD COLUMN ingredients TEXT;
ALTER TABLE meals ADD COLUMN instructions TEXT;
ALTER TABLE meals ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update meal_type column based on meal_type_id
-- 1 = dinner, 2 = lunch, 3 = snack, 4 = breakfast (from schema.sql)
UPDATE meals SET meal_type =
  CASE
    WHEN meal_type_id = 1 THEN 'dinner'
    WHEN meal_type_id = 2 THEN 'lunch'
    WHEN meal_type_id = 3 THEN 'snack'
    WHEN meal_type_id = 4 THEN 'breakfast'
    ELSE 'dinner'
  END
WHERE meal_type IS NULL;

-- Set default difficulty for existing meals
UPDATE meals SET difficulty = 'medium' WHERE difficulty IS NULL;

-- Set default servings for existing meals
UPDATE meals SET servings = 4 WHERE servings IS NULL;

-- Populate created_at for existing records
UPDATE meals SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
