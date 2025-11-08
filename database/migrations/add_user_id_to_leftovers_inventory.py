#!/usr/bin/env python3
"""
Migration: Add user_id to leftovers_inventory table for explicit data isolation
"""

import sqlite3
import sys


def migrate_add_user_id_to_leftovers(db_path='meal_planner.db'):
    """Add user_id column to leftovers_inventory table"""

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if user_id column already exists
        cursor.execute("PRAGMA table_info(leftovers_inventory)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'user_id' in columns:
            print("✓ user_id column already exists in leftovers_inventory")
            conn.close()
            return

        print("📊 Adding user_id column to leftovers_inventory...")

        # Add user_id column
        cursor.execute("""
            ALTER TABLE leftovers_inventory
            ADD COLUMN user_id INTEGER REFERENCES users(id)
        """)

        # Populate user_id from the related meal
        cursor.execute("""
            UPDATE leftovers_inventory
            SET user_id = (
                SELECT user_id
                FROM meals
                WHERE meals.id = leftovers_inventory.meal_id
            )
        """)

        # Make user_id NOT NULL after populating
        # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
        print("🔄 Recreating table with NOT NULL constraint...")

        cursor.execute("""
            CREATE TABLE leftovers_inventory_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meal_id INTEGER NOT NULL,
                cooked_date DATE NOT NULL,
                servings_remaining INTEGER NOT NULL,
                expires_date DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                consumed_at TIMESTAMP,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Copy data
        cursor.execute("""
            INSERT INTO leftovers_inventory_new
            SELECT id, meal_id, cooked_date, servings_remaining, expires_date,
                   notes, created_at, consumed_at, user_id
            FROM leftovers_inventory
        """)

        # Drop old table and rename
        cursor.execute("DROP TABLE leftovers_inventory")
        cursor.execute("ALTER TABLE leftovers_inventory_new RENAME TO leftovers_inventory")

        # Recreate indexes
        cursor.execute("""
            CREATE INDEX idx_leftovers_active
            ON leftovers_inventory(consumed_at)
            WHERE consumed_at IS NULL
        """)

        cursor.execute("""
            CREATE INDEX idx_leftovers_expires
            ON leftovers_inventory(expires_date)
        """)

        cursor.execute("""
            CREATE INDEX idx_leftovers_user
            ON leftovers_inventory(user_id)
        """)

        conn.commit()
        print("✅ user_id column added to leftovers_inventory successfully!")

    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'meal_planner.db'
    migrate_add_user_id_to_leftovers(db_path)
