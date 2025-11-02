#!/usr/bin/env python3
"""
Migration: Add leftovers tracking table
Enables tracking leftovers with expiration dates and portions
"""

import sqlite3
import os

def migrate_add_leftovers_table(db_path='meal_planner.db'):
    """Add leftovers tracking table"""

    if not os.path.exists(db_path):
        print(f"Database {db_path} doesn't exist, skipping migration")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Checking for leftovers table...")

    # Get existing tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in cursor.fetchall()}

    if 'leftovers' not in existing_tables:
        print("Creating leftovers table...")
        cursor.execute("""
            CREATE TABLE leftovers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meal_id INTEGER,
                meal_name TEXT NOT NULL,
                portions REAL DEFAULT 1,
                container_location TEXT,
                cooked_date DATE NOT NULL,
                expires_date DATE NOT NULL,
                is_consumed BOOLEAN DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE SET NULL
            )
        """)
        try:
            cursor.execute("CREATE INDEX idx_leftovers_expires ON leftovers(expires_date)")
        except sqlite3.OperationalError:
            pass  # Index already exists
        try:
            cursor.execute("CREATE INDEX idx_leftovers_consumed ON leftovers(is_consumed)")
        except sqlite3.OperationalError:
            pass  # Index already exists
        conn.commit()
        print("✅ Migration complete! Added leftovers table")
    else:
        print("✅ leftovers table already exists, no migration needed")

    conn.close()

if __name__ == '__main__':
    migrate_add_leftovers_table()
