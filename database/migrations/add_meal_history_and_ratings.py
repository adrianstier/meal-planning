#!/usr/bin/env python3
"""
Migration: Add meal history tracking and kid ratings
Enables tracking how often meals are cooked and kid approval ratings
"""

import sqlite3
import os

def migrate_add_meal_history_and_ratings(db_path='meal_planner.db'):
    """Add columns for meal history and kid ratings"""

    if not os.path.exists(db_path):
        print(f"Database {db_path} doesn't exist, skipping migration")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Adding meal history and ratings columns...")

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(meals)")
        columns = {row[1] for row in cursor.fetchall()}

        # Add kid_rating column if it doesn't exist
        if 'kid_rating' not in columns:
            cursor.execute("ALTER TABLE meals ADD COLUMN kid_rating INTEGER DEFAULT NULL")
            print("✅ Added kid_rating column")

        # Add times_cooked column if it doesn't exist
        if 'times_cooked' not in columns:
            cursor.execute("ALTER TABLE meals ADD COLUMN times_cooked INTEGER DEFAULT 0")
            print("✅ Added times_cooked column")

        # Add notes column if it doesn't exist
        if 'notes' not in columns:
            cursor.execute("ALTER TABLE meals ADD COLUMN notes TEXT DEFAULT NULL")
            print("✅ Added notes column")

        conn.commit()
        print("✅ Migration complete! Added meal history and ratings tracking")
    except Exception as e:
        print(f"⚠️  Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_add_meal_history_and_ratings()
