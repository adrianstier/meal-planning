-- Migration: Add Meal History & Favorites Feature
-- Run this to add history tracking to existing database

-- Table to track when meals were actually made
CREATE TABLE IF NOT EXISTS meal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    cooked_date DATE NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5), -- How it turned out
    notes TEXT, -- "Kids loved it!", "Too spicy", etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

-- Table to track favorite meals
CREATE TABLE IF NOT EXISTS meal_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL UNIQUE,
    favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_history_date ON meal_history(cooked_date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_history_meal ON meal_history(meal_id);
CREATE INDEX IF NOT EXISTS idx_favorites_meal ON meal_favorites(meal_id);

-- Add last_cooked column to meals table for quick access
ALTER TABLE meals ADD COLUMN last_cooked DATE;
ALTER TABLE meals ADD COLUMN times_cooked INTEGER DEFAULT 0;
ALTER TABLE meals ADD COLUMN is_favorite BOOLEAN DEFAULT 0;
