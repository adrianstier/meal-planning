#!/usr/bin/env python3
"""
Database migration: Fix image URLs that have /https:// or /http:// (broken by previous migration)
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def migrate(db_path='meal_planner.db'):
    """Fix broken image URLs that start with /http:// or /https://"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Find all meals with broken image URLs
        cursor.execute("""
            SELECT id, image_url
            FROM meals
            WHERE image_url LIKE '/http://%'
            OR image_url LIKE '/https://%'
        """)

        meals_to_fix = cursor.fetchall()

        if not meals_to_fix:
            print("✅ No broken image URLs found")
            return

        print(f"🔧 Fixing {len(meals_to_fix)} broken image URLs...")

        for meal_id, image_url in meals_to_fix:
            # Remove the leading slash
            fixed_url = image_url[1:]  # Remove first character (the /)
            cursor.execute("""
                UPDATE meals
                SET image_url = ?
                WHERE id = ?
            """, (fixed_url, meal_id))
            print(f"  ✓ Fixed meal {meal_id}: {image_url} → {fixed_url}")

        conn.commit()
        print(f"✅ Successfully fixed {len(meals_to_fix)} broken image URLs")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
