#!/usr/bin/env python3
"""
Database migration: Add recipe source URL and comments columns to meals table
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def migrate(db_path='meal_planner.db'):
    """Add source_url and top_comments columns to meals table"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check which columns already exist
        cursor.execute("PRAGMA table_info(meals)")
        columns = [col[1] for col in cursor.fetchall()]

        changes_made = False

        # Add source_url column if it doesn't exist
        if 'source_url' not in columns:
            print("Adding source_url column to meals table...")
            cursor.execute("""
                ALTER TABLE meals
                ADD COLUMN source_url TEXT
            """)
            changes_made = True
            print("✅ Successfully added source_url column")
        else:
            print("⚠️  source_url column already exists, skipping")

        # Add top_comments column if it doesn't exist (stores JSON array of comments)
        if 'top_comments' not in columns:
            print("Adding top_comments column to meals table...")
            cursor.execute("""
                ALTER TABLE meals
                ADD COLUMN top_comments TEXT
            """)
            changes_made = True
            print("✅ Successfully added top_comments column")
        else:
            print("⚠️  top_comments column already exists, skipping")

        if changes_made:
            conn.commit()
            print("✅ Recipe metadata migration completed successfully")
        else:
            print("✅ All columns already exist, no migration needed")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
