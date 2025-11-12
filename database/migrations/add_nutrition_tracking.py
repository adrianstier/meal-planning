#!/usr/bin/env python3
"""
Add nutrition tracking tables

This migration adds comprehensive nutrition tracking:
- Nutrition data for meals
- Daily nutrition logs
- Weekly nutrition summaries
- Nutrition goals per user
"""

import sqlite3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from meal_planner import MealPlannerDB


def migrate():
    """Add nutrition tracking tables"""
    db = MealPlannerDB()
    db_path = db.db_path
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("📦 Creating nutrition tables...")

    # Add nutrition columns to meals table
    cursor.execute("""
        ALTER TABLE meals ADD COLUMN calories INTEGER
    """)
    cursor.execute("""
        ALTER TABLE meals ADD COLUMN protein_g REAL
    """)
    cursor.execute("""
        ALTER TABLE meals ADD COLUMN carbs_g REAL
    """)
    cursor.execute("""
        ALTER TABLE meals ADD COLUMN fat_g REAL
    """)
    cursor.execute("""
        ALTER TABLE meals ADD COLUMN fiber_g REAL
    """)
    cursor.execute("""
        ALTER TABLE meals ADD COLUMN sugar_g REAL
    """)
    cursor.execute("""
        ALTER TABLE meals ADD COLUMN sodium_mg REAL
    """)

    print("📦 Creating nutrition_logs table...")

    # Daily nutrition logs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS nutrition_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            log_date DATE NOT NULL,
            meal_id INTEGER,
            meal_name TEXT,
            meal_type TEXT,  -- breakfast, lunch, dinner, snack
            servings REAL DEFAULT 1,
            calories INTEGER,
            protein_g REAL,
            carbs_g REAL,
            fat_g REAL,
            fiber_g REAL,
            sugar_g REAL,
            sodium_mg REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE SET NULL
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date
        ON nutrition_logs(user_id, log_date DESC)
    """)

    print("📦 Creating nutrition_goals table...")

    # User nutrition goals
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS nutrition_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            daily_calories INTEGER DEFAULT 2000,
            daily_protein_g REAL DEFAULT 50,
            daily_carbs_g REAL DEFAULT 275,
            daily_fat_g REAL DEFAULT 78,
            daily_fiber_g REAL DEFAULT 25,
            max_sugar_g REAL DEFAULT 50,
            max_sodium_mg REAL DEFAULT 2300,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    print("📦 Creating nutrition_summaries table...")

    # Weekly nutrition summaries (cached for performance)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS nutrition_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            week_start_date DATE NOT NULL,
            week_end_date DATE NOT NULL,
            avg_daily_calories INTEGER,
            avg_daily_protein_g REAL,
            avg_daily_carbs_g REAL,
            avg_daily_fat_g REAL,
            avg_daily_fiber_g REAL,
            avg_daily_sugar_g REAL,
            avg_daily_sodium_mg REAL,
            days_logged INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, week_start_date)
        )
    """)

    print("📦 Creating default nutrition goals for existing users...")

    # Give all existing users default goals
    cursor.execute("""
        INSERT INTO nutrition_goals (user_id)
        SELECT id FROM users
        WHERE id NOT IN (SELECT user_id FROM nutrition_goals)
    """)

    conn.commit()
    conn.close()

    print("✅ Nutrition tracking migration complete!")
    print("   - nutrition columns added to meals table")
    print("   - nutrition_logs table created")
    print("   - nutrition_goals table created")
    print("   - nutrition_summaries table created")
    print("   - Default goals set for existing users")


if __name__ == '__main__':
    try:
        migrate()
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠️  Nutrition columns already exist - skipping column additions")
            print("✅ Migration complete (tables already up to date)")
        else:
            raise
