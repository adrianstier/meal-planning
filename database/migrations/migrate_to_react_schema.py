#!/usr/bin/env python3
"""
Database Migration: Update schema to match React app expectations
Adds new columns: meal_type, servings, difficulty, tags, ingredients, instructions, created_at
"""

import sqlite3
import sys
import os
from datetime import datetime

def migrate_database(db_path='meal_planner.db'):
    """Run database migration to add React schema columns"""
    print(f"Migrating database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Starting database migration to React schema...")

    # Check which columns already exist
    cursor.execute("PRAGMA table_info(meals)")
    existing_columns = {row[1] for row in cursor.fetchall()}

    # Add new columns one by one
    columns_to_add = [
        ('meal_type', 'TEXT'),
        ('servings', 'INTEGER'),
        ('difficulty', 'TEXT'),
        ('tags', 'TEXT'),
        ('ingredients', 'TEXT'),
        ('instructions', 'TEXT'),
        ('created_at', 'TIMESTAMP'),
    ]

    for col_name, col_type in columns_to_add:
        if col_name not in existing_columns:
            try:
                print(f"Adding column: {col_name}")
                cursor.execute(f"ALTER TABLE meals ADD COLUMN {col_name} {col_type}")
                conn.commit()
            except sqlite3.OperationalError as e:
                print(f"  Warning: {e}")

    # Update meal_type based on meal_type_id
    # 1 = dinner, 2 = lunch, 3 = snack, 4 = breakfast
    print("Updating meal_type values...")
    cursor.execute("""
        UPDATE meals SET meal_type =
          CASE
            WHEN meal_type_id = 1 THEN 'dinner'
            WHEN meal_type_id = 2 THEN 'lunch'
            WHEN meal_type_id = 3 THEN 'snack'
            WHEN meal_type_id = 4 THEN 'breakfast'
            ELSE 'dinner'
          END
        WHERE meal_type IS NULL OR meal_type = ''
    """)

    # Set default values for existing meals
    print("Setting default values for existing meals...")
    cursor.execute("UPDATE meals SET difficulty = 'medium' WHERE difficulty IS NULL OR difficulty = ''")
    cursor.execute("UPDATE meals SET servings = 4 WHERE servings IS NULL")
    cursor.execute("UPDATE meals SET created_at = ? WHERE created_at IS NULL", (datetime.now(),))

    conn.commit()

    # Verify migration
    cursor.execute("SELECT COUNT(*) FROM meals WHERE meal_type IS NOT NULL")
    migrated_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM meals")
    total_count = cursor.fetchone()[0]

    print(f"\n✅ Migration complete!")
    print(f"   Total meals: {total_count}")
    print(f"   Meals with meal_type: {migrated_count}")

    # Show sample data
    print("\nSample migrated data:")
    cursor.execute("""
        SELECT id, name, meal_type, difficulty, servings
        FROM meals
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} ({row[2]}, {row[3]}, {row[4]} servings)")

    conn.close()

if __name__ == '__main__':
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'meal_planner.db'

    if not os.path.exists(db_path):
        print(f"Warning: Database not found at {db_path}, will create new one")

    migrate_database(db_path)
