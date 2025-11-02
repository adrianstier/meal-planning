#!/usr/bin/env python3
"""
Database migration: Fix image URLs that are missing leading slash
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def migrate(db_path='meal_planner.db'):
    """Fix image_url paths that are missing leading slash"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Find all meals with image_url that doesn't start with /
        cursor.execute("""
            SELECT id, image_url
            FROM meals
            WHERE image_url IS NOT NULL
            AND image_url != ''
            AND image_url NOT LIKE '/%'
        """)

        meals_to_fix = cursor.fetchall()

        if not meals_to_fix:
            print("✅ All image URLs are already correct")
            return

        print(f"🔧 Fixing {len(meals_to_fix)} image URLs...")

        for meal_id, image_url in meals_to_fix:
            # Add leading slash
            fixed_url = f"/{image_url}"
            cursor.execute("""
                UPDATE meals
                SET image_url = ?
                WHERE id = ?
            """, (fixed_url, meal_id))
            print(f"  ✓ Fixed meal {meal_id}: {image_url} → {fixed_url}")

        conn.commit()
        print(f"✅ Successfully fixed {len(meals_to_fix)} image URLs")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
