#!/usr/bin/env python3
"""
Database migration script to add history and favorites features
"""

import sqlite3
import os

def migrate_database():
    db_path = 'meal_planner.db'

    if not os.path.exists(db_path):
        print("❌ Database not found. Run setup.py first.")
        return False

    print("🔄 Migrating database to add history & favorites features...")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Read and execute migration SQL
        with open('add_history_features.sql', 'r') as f:
            migration_sql = f.read()

        # Execute each statement
        for statement in migration_sql.split(';'):
            statement = statement.strip()
            if statement:
                try:
                    cursor.execute(statement)
                except sqlite3.OperationalError as e:
                    # Column/table might already exist
                    if 'duplicate column name' in str(e).lower() or 'already exists' in str(e).lower():
                        print(f"⚠️  Skipping (already exists): {statement[:50]}...")
                    else:
                        raise

        conn.commit()
        print("✅ Database migration completed successfully!")

        # Verify new tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]

        print(f"\n📊 Current tables:")
        for table in tables:
            print(f"  • {table}")

        return True

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    success = migrate_database()
    exit(0 if success else 1)
