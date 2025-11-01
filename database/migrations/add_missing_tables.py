#!/usr/bin/env python3
"""
Migration: Add missing tables to existing database
Adds school_menu_items, school_menu_feedback, leftovers_inventory, meal_history, meal_favorites
"""

import sqlite3
import os

def migrate_add_missing_tables(db_path='meal_planner.db'):
    """Add missing tables if they don't exist"""

    if not os.path.exists(db_path):
        print(f"Database {db_path} doesn't exist, skipping migration")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Checking for missing tables...")

    # Get existing tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in cursor.fetchall()}

    tables_added = []

    # School menu items
    if 'school_menu_items' not in existing_tables:
        print("Adding school_menu_items table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS school_menu_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                menu_date DATE NOT NULL,
                meal_name TEXT NOT NULL,
                meal_type TEXT DEFAULT 'lunch',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(menu_date, meal_name, meal_type)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_school_menu_date ON school_menu_items(menu_date DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_school_menu_type ON school_menu_items(meal_type)")
        tables_added.append('school_menu_items')

    # School menu feedback
    if 'school_menu_feedback' not in existing_tables:
        print("Adding school_menu_feedback table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS school_menu_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                menu_item_id INTEGER NOT NULL,
                feedback_type TEXT CHECK(feedback_type IN ('disliked', 'allergic', 'wont_eat')),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (menu_item_id) REFERENCES school_menu_items(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_school_feedback_item ON school_menu_feedback(menu_item_id)")
        tables_added.append('school_menu_feedback')

    # Leftovers inventory
    if 'leftovers_inventory' not in existing_tables:
        print("Adding leftovers_inventory table...")
        cursor.execute("""
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
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_leftovers_expiration ON leftovers_inventory(expiration_date)")
        tables_added.append('leftovers_inventory')

    # Meal history
    if 'meal_history' not in existing_tables:
        print("Adding meal_history table...")
        cursor.execute("""
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
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_history_date ON meal_history(date_eaten DESC)")
        tables_added.append('meal_history')

    # Meal favorites
    if 'meal_favorites' not in existing_tables:
        print("Adding meal_favorites table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS meal_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meal_id INTEGER NOT NULL UNIQUE,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (meal_id) REFERENCES meals(id)
            )
        """)
        tables_added.append('meal_favorites')

    conn.commit()
    conn.close()

    if tables_added:
        print(f"✅ Migration complete! Added {len(tables_added)} tables:")
        for table in tables_added:
            print(f"   • {table}")
    else:
        print("✅ All tables already exist, no migration needed")

if __name__ == '__main__':
    migrate_add_missing_tables()
