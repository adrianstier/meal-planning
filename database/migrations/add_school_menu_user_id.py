#!/usr/bin/env python3
"""
Database migration: Add user_id to school_menu_items and school_menu_feedback tables
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def migrate(db_path='meal_planner.db'):
    """Add user_id columns to school menu tables"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Get admin user ID
        cursor.execute("SELECT id FROM users ORDER BY id LIMIT 1")
        admin_user = cursor.fetchone()

        if not admin_user:
            print("❌ No users found in database. Please run add_users_and_auth.py first.")
            return

        admin_user_id = admin_user[0]
        print(f"Found admin user ID: {admin_user_id}")

        # Add user_id to school_menu_items table if it exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='school_menu_items'
        """)

        if cursor.fetchone():
            print("🔄 Adding user_id to school_menu_items table...")
            cursor.execute("PRAGMA table_info(school_menu_items)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'user_id' not in columns:
                cursor.execute("""
                    ALTER TABLE school_menu_items ADD COLUMN user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE
                """)

                cursor.execute("""
                    UPDATE school_menu_items SET user_id = ? WHERE user_id IS NULL
                """, (admin_user_id,))

                print(f"✅ Added user_id to school_menu_items table (assigned {cursor.rowcount} items to admin)")
            else:
                print("✅ user_id column already exists in school_menu_items table")

        # Add user_id to school_menu_feedback table if it exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='school_menu_feedback'
        """)

        if cursor.fetchone():
            print("🔄 Adding user_id to school_menu_feedback table...")
            cursor.execute("PRAGMA table_info(school_menu_feedback)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'user_id' not in columns:
                cursor.execute("""
                    ALTER TABLE school_menu_feedback ADD COLUMN user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE
                """)

                cursor.execute("""
                    UPDATE school_menu_feedback SET user_id = ? WHERE user_id IS NULL
                """, (admin_user_id,))

                print(f"✅ Added user_id to school_menu_feedback table (assigned {cursor.rowcount} feedback items to admin)")
            else:
                print("✅ user_id column already exists in school_menu_feedback table")

        conn.commit()

        print("")
        print("=" * 60)
        print("✅ School menu user_id migration complete!")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
