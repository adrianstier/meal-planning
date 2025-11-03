#!/usr/bin/env python3
"""
Database migration: Reset admin password to a known value
This allows syncing the password across different deployments
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

def reset_admin_password(new_password='OwtvQubm2H9BP0qE', db_path='meal_planner.db'):
    """Reset the admin user's password"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if users table exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='users'
        """)

        if not cursor.fetchone():
            print("❌ Users table does not exist. Run add_users_and_auth.py first.")
            return

        # Check if admin user exists
        cursor.execute("SELECT id FROM users WHERE username = ?", ('admin',))
        admin_user = cursor.fetchone()

        if not admin_user:
            print("❌ Admin user does not exist.")
            return

        # Update admin password
        password_hash = hash_password(new_password)
        cursor.execute("""
            UPDATE users
            SET password_hash = ?
            WHERE username = ?
        """, (password_hash, 'admin'))

        conn.commit()

        print("=" * 60)
        print("✅ Admin password has been reset!")
        print("=" * 60)
        print("")
        print("Login credentials:")
        print(f"  Username: admin")
        print(f"  Password: {new_password}")
        print("")

    except Exception as e:
        print(f"❌ Password reset failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    # Allow passing custom password as argument
    if len(sys.argv) > 1:
        custom_password = sys.argv[1]
        reset_admin_password(custom_password)
    else:
        # Use the Railway password as default
        reset_admin_password('OwtvQubm2H9BP0qE')
