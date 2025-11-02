#!/usr/bin/env python3
"""
Database migration: Add bento box tables
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def migrate(db_path='meal_planner.db'):
    """Add bento_items and bento_plans tables"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Create bento_items table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bento_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                is_favorite BOOLEAN DEFAULT 0,
                allergens TEXT,
                notes TEXT,
                prep_time_minutes INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create bento_plans table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bento_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                child_name TEXT,
                compartment1_item_id INTEGER,
                compartment2_item_id INTEGER,
                compartment3_item_id INTEGER,
                compartment4_item_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (compartment1_item_id) REFERENCES bento_items(id),
                FOREIGN KEY (compartment2_item_id) REFERENCES bento_items(id),
                FOREIGN KEY (compartment3_item_id) REFERENCES bento_items(id),
                FOREIGN KEY (compartment4_item_id) REFERENCES bento_items(id)
            )
        """)

        # Create index on date for faster lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_bento_plans_date
            ON bento_plans(date)
        """)

        conn.commit()
        print("✅ Successfully created bento tables")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
