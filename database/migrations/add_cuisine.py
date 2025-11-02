#!/usr/bin/env python3
"""
Database migration: Add cuisine column to meals table
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def migrate(db_path='meal_planner.db'):
    """Add cuisine column to meals table"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(meals)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'cuisine' not in columns:
            print("Adding cuisine column to meals table...")
            cursor.execute("""
                ALTER TABLE meals
                ADD COLUMN cuisine TEXT
            """)
            conn.commit()
            print("✅ Successfully added cuisine column")
        else:
            print("⚠️  cuisine column already exists, skipping")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
