#!/usr/bin/env python3
"""
Migration: Add multi-user support to existing database
Adds user_id column to scheduled_meals table and creates a default user
"""

import sqlite3
import sys


def run_migration(db_path='meal_planner.db'):
    """Add user_id column to scheduled_meals table"""
    print(f"Running multi-user migration on: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if scheduled_meals table exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='scheduled_meals'
        """)
        if not cursor.fetchone():
            print("  ⏭️  Skipping: scheduled_meals table doesn't exist yet")
            conn.close()
            return

        # Check if user_id column already exists
        cursor.execute("PRAGMA table_info(scheduled_meals)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'user_id' in columns:
            print("  ✓ Migration already applied (user_id column exists)")
            conn.close()
            return

        print("  📝 Adding user_id column to scheduled_meals...")

        # Add user_id column (default to 1 for existing records)
        cursor.execute("""
            ALTER TABLE scheduled_meals
            ADD COLUMN user_id INTEGER DEFAULT 1
        """)

        # Update existing records to belong to user 1
        cursor.execute("""
            UPDATE scheduled_meals
            SET user_id = 1
            WHERE user_id IS NULL
        """)

        conn.commit()
        print("  ✅ Successfully added user_id column to scheduled_meals")
        print("  ✅ All existing meal plans assigned to user 1")

    except sqlite3.Error as e:
        print(f"  ❌ Error: {e}")
        conn.rollback()
        conn.close()
        return False

    conn.close()
    return True


if __name__ == '__main__':
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'meal_planner.db'
    success = run_migration(db_path)
    sys.exit(0 if success else 1)
