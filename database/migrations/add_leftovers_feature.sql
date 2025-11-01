-- Migration: Add Leftovers Management Feature

-- Add leftovers columns to meals table
ALTER TABLE meals ADD COLUMN makes_leftovers BOOLEAN DEFAULT 0;
ALTER TABLE meals ADD COLUMN leftover_servings INTEGER DEFAULT 0;
ALTER TABLE meals ADD COLUMN leftover_days INTEGER DEFAULT 1; -- How many days leftovers last

-- Add leftover_meal_id to link original meal to leftover meal
ALTER TABLE meals ADD COLUMN is_leftover BOOLEAN DEFAULT 0;
ALTER TABLE meals ADD COLUMN original_meal_id INTEGER;

-- Table to track active leftovers in the fridge
CREATE TABLE IF NOT EXISTS leftovers_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    cooked_date DATE NOT NULL,
    servings_remaining INTEGER NOT NULL,
    expires_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    consumed_at TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_leftovers_active ON leftovers_inventory(consumed_at)
    WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leftovers_expires ON leftovers_inventory(expires_date);
