#!/usr/bin/env python3
"""
Migration: Remove duplicate meals from database
Keeps the most recent entry for each meal name per user
"""

import sqlite3
import os
import sys

def remove_duplicate_meals(db_path='meal_planner.db'):
    """Remove duplicate meal entries, keeping the most recent one"""

    if not os.path.exists(db_path):
        print(f"Database {db_path} doesn't exist, skipping migration")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Finding duplicate meals...")

    # Find all duplicate meal names per user
    cursor.execute("""
        SELECT user_id, name, COUNT(*) as count
        FROM meals
        GROUP BY user_id, name
        HAVING count > 1
        ORDER BY count DESC
    """)

    duplicates = cursor.fetchall()

    if not duplicates:
        print("✅ No duplicate meals found!")
        conn.close()
        return

    print(f"Found {len(duplicates)} sets of duplicate meals:")
    for user_id, name, count in duplicates:
        print(f"  - '{name}' (user {user_id}): {count} copies")

    total_deleted = 0

    # For each set of duplicates, keep only the newest entry
    for user_id, name, count in duplicates:
        # Get all IDs for this meal name, ordered by creation date (newest first)
        cursor.execute("""
            SELECT id, created_at
            FROM meals
            WHERE user_id = ? AND name = ?
            ORDER BY created_at DESC
        """, (user_id, name))

        meal_ids = cursor.fetchall()

        # Keep the first (newest) and delete the rest
        ids_to_delete = [meal_id for meal_id, _ in meal_ids[1:]]

        if ids_to_delete:
            placeholders = ','.join('?' * len(ids_to_delete))
            cursor.execute(f"""
                DELETE FROM meals
                WHERE id IN ({placeholders})
            """, ids_to_delete)

            deleted_count = cursor.rowcount
            total_deleted += deleted_count
            print(f"  ✓ Deleted {deleted_count} duplicate(s) of '{name}'")

    conn.commit()
    print(f"\n✅ Migration complete! Deleted {total_deleted} duplicate meals")

    conn.close()

if __name__ == '__main__':
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'meal_planner.db'
    remove_duplicate_meals(db_path)
