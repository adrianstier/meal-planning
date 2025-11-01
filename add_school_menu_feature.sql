-- Migration: Add School Cafeteria Menu Tracking
-- Run this to add school menu tracking to existing database

-- Table to store school menu items
CREATE TABLE IF NOT EXISTS school_menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_date DATE NOT NULL,
    meal_name TEXT NOT NULL,
    meal_type TEXT DEFAULT 'lunch', -- lunch, breakfast, snack
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(menu_date, meal_name, meal_type) -- Prevent duplicate entries for same day
);

-- Table to track which school menu items kids didn't like
CREATE TABLE IF NOT EXISTS school_menu_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    feedback_type TEXT CHECK(feedback_type IN ('disliked', 'allergic', 'wont_eat')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES school_menu_items(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_school_menu_date ON school_menu_items(menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_school_menu_type ON school_menu_items(meal_type);
CREATE INDEX IF NOT EXISTS idx_school_feedback_item ON school_menu_feedback(menu_item_id);
