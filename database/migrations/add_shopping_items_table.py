#!/usr/bin/env python3
"""
Migration: Add shopping_items table
A simple shopping list table for basic shopping list functionality
"""

import sqlite3
import os

def migrate_add_shopping_items(db_path='meal_planner.db'):
    """Add shopping_items table if it doesn't exist"""

    if not os.path.exists(db_path):
        print(f"Database {db_path} doesn't exist, skipping migration")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Checking for shopping_items table...")

    # Get existing tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in cursor.fetchall()}

    if 'shopping_items' not in existing_tables:
        print("Adding shopping_items table...")
        cursor.execute("""
            CREATE TABLE shopping_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                category TEXT,
                quantity TEXT,
                is_purchased BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX idx_shopping_items_purchased ON shopping_items(is_purchased)")
        conn.commit()
        print("✅ Migration complete! Added shopping_items table")
    else:
        print("✅ shopping_items table already exists, no migration needed")

    conn.close()

if __name__ == '__main__':
    migrate_add_shopping_items()
