#!/usr/bin/env python3
"""
Database migration: Add image_url column to meals table
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def migrate(db_path='meal_planner.db'):
    """Add image_url column to meals table"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(meals)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'image_url' not in columns:
            print("Adding image_url column to meals table...")
            cursor.execute("""
                ALTER TABLE meals
                ADD COLUMN image_url TEXT
            """)
            conn.commit()
            print("✅ Successfully added image_url column")
        else:
            print("⚠️  image_url column already exists, skipping")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
