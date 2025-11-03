#!/usr/bin/env python3
"""
Database migration: Add users table and user_id foreign keys to all tables
This enables multi-user support with authentication
"""

import sqlite3
import sys
import os
import hashlib
import secrets

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def hash_password(password):
    """Hash a password using SHA-256 with salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${pwd_hash}"

def migrate(db_path='meal_planner.db'):
    """Add users table and update all tables with user_id"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if users table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='users'
        """)

        if cursor.fetchone():
            print("✅ Users table already exists")
            return

        print("🔄 Creating users table...")

        # Create users table
        cursor.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        """)

        # Create index on username for faster lookups
        cursor.execute("""
            CREATE INDEX idx_users_username ON users(username)
        """)

        print("✅ Users table created")

        # Create default admin user
        print("🔄 Creating default admin user...")
        default_password = secrets.token_urlsafe(12)
        password_hash = hash_password(default_password)

        cursor.execute("""
            INSERT INTO users (username, email, password_hash, display_name)
            VALUES (?, ?, ?, ?)
        """, ('admin', 'admin@localhost', password_hash, 'Admin User'))

        admin_user_id = cursor.lastrowid
        print(f"✅ Created default admin user (ID: {admin_user_id})")
        print(f"   Username: admin")
        print(f"   Password: {default_password}")
        print(f"   ⚠️  SAVE THIS PASSWORD! You'll need it to log in.")

        # Add user_id column to meals table
        print("🔄 Adding user_id to meals table...")
        cursor.execute("PRAGMA table_info(meals)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'user_id' not in columns:
            cursor.execute("""
                ALTER TABLE meals ADD COLUMN user_id INTEGER
                REFERENCES users(id) ON DELETE CASCADE
            """)

            # Assign all existing meals to admin user
            cursor.execute("""
                UPDATE meals SET user_id = ? WHERE user_id IS NULL
            """, (admin_user_id,))

            print(f"✅ Added user_id to meals table (assigned {cursor.rowcount} existing meals to admin)")

        # Add user_id column to meal_plans table
        print("🔄 Adding user_id to meal_plans table...")
        cursor.execute("PRAGMA table_info(meal_plans)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'user_id' not in columns:
            cursor.execute("""
                ALTER TABLE meal_plans ADD COLUMN user_id INTEGER
                REFERENCES users(id) ON DELETE CASCADE
            """)

            # Assign all existing meal plans to admin user
            cursor.execute("""
                UPDATE meal_plans SET user_id = ? WHERE user_id IS NULL
            """, (admin_user_id,))

            print(f"✅ Added user_id to meal_plans table (assigned {cursor.rowcount} existing plans to admin)")

        # Add user_id to shopping_items table if it exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='shopping_items'
        """)

        if cursor.fetchone():
            print("🔄 Adding user_id to shopping_items table...")
            cursor.execute("PRAGMA table_info(shopping_items)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'user_id' not in columns:
                cursor.execute("""
                    ALTER TABLE shopping_items ADD COLUMN user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE
                """)

                cursor.execute("""
                    UPDATE shopping_items SET user_id = ? WHERE user_id IS NULL
                """, (admin_user_id,))

                print(f"✅ Added user_id to shopping_items table")

        # Add user_id to meal_history table if it exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='meal_history'
        """)

        if cursor.fetchone():
            print("🔄 Adding user_id to meal_history table...")
            cursor.execute("PRAGMA table_info(meal_history)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'user_id' not in columns:
                cursor.execute("""
                    ALTER TABLE meal_history ADD COLUMN user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE
                """)

                cursor.execute("""
                    UPDATE meal_history SET user_id = ? WHERE user_id IS NULL
                """, (admin_user_id,))

                print(f"✅ Added user_id to meal_history table")

        # Add user_id to leftovers table if it exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='leftovers'
        """)

        if cursor.fetchone():
            print("🔄 Adding user_id to leftovers table...")
            cursor.execute("PRAGMA table_info(leftovers)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'user_id' not in columns:
                cursor.execute("""
                    ALTER TABLE leftovers ADD COLUMN user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE
                """)

                cursor.execute("""
                    UPDATE leftovers SET user_id = ? WHERE user_id IS NULL
                """, (admin_user_id,))

                print(f"✅ Added user_id to leftovers table")

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

                print(f"✅ Added user_id to school_menu_items table")

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

                print(f"✅ Added user_id to school_menu_feedback table")

        # Add user_id to bento_items table if it exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='bento_items'
        """)

        if cursor.fetchone():
            print("🔄 Adding user_id to bento_items table...")
            cursor.execute("PRAGMA table_info(bento_items)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'user_id' not in columns:
                cursor.execute("""
                    ALTER TABLE bento_items ADD COLUMN user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE
                """)

                cursor.execute("""
                    UPDATE bento_items SET user_id = ? WHERE user_id IS NULL
                """, (admin_user_id,))

                print(f"✅ Added user_id to bento_items table")

        # Add user_id to bento_plans table if it exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='bento_plans'
        """)

        if cursor.fetchone():
            print("🔄 Adding user_id to bento_plans table...")
            cursor.execute("PRAGMA table_info(bento_plans)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'user_id' not in columns:
                cursor.execute("""
                    ALTER TABLE bento_plans ADD COLUMN user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE
                """)

                cursor.execute("""
                    UPDATE bento_plans SET user_id = ? WHERE user_id IS NULL
                """, (admin_user_id,))

                print(f"✅ Added user_id to bento_plans table")

        conn.commit()

        print("")
        print("=" * 60)
        print("✅ Multi-user migration complete!")
        print("=" * 60)
        print("")
        print("Default admin credentials:")
        print(f"  Username: admin")
        print(f"  Password: {default_password}")
        print("")
        print("⚠️  IMPORTANT: Save these credentials!")
        print("   You can create additional users through the UI after logging in.")
        print("")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
