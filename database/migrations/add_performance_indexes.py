#!/usr/bin/env python3
"""
Migration: Add performance indexes for frequently queried columns
Improves query performance for meal planning operations
"""

import sqlite3
import sys
import os


def migrate(db_path='meal_planner.db'):
    """Add performance indexes to database"""
    print("🔄 Adding performance indexes...")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Index for meal_type queries (very common filter)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_meals_meal_type
            ON meals(meal_type)
        """)
        print("✅ Added index on meals.meal_type")

        # Index for cuisine filtering
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_meals_cuisine
            ON meals(cuisine)
        """)
        print("✅ Added index on meals.cuisine")

        # Index for kid_friendly_level queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_meals_kid_friendly
            ON meals(kid_friendly_level)
        """)
        print("✅ Added index on meals.kid_friendly_level")

        # Index for favorite meals
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_meals_is_favorite
            ON meals(is_favorite)
        """)
        print("✅ Added index on meals.is_favorite")

        # Index for last_cooked queries (for recent/not-cooked-in-a-while)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_meals_last_cooked
            ON meals(last_cooked)
        """)
        print("✅ Added index on meals.last_cooked")

        # Index for scheduled_meals date queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_scheduled_meals_date
            ON scheduled_meals(meal_date)
        """)
        print("✅ Added index on scheduled_meals.meal_date")

        # Index for scheduled_meals by meal_plan_id
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_scheduled_meals_plan_id
            ON scheduled_meals(meal_plan_id)
        """)
        print("✅ Added index on scheduled_meals.meal_plan_id")

        # Index for school menu date queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_school_menu_date
            ON school_menu_items(menu_date)
        """)
        print("✅ Added index on school_menu_items.menu_date")

        # Index for shopping items by purchased status
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_shopping_items_purchased
            ON shopping_items(is_purchased)
        """)
        print("✅ Added index on shopping_items.is_purchased")

        # Index for leftovers expiration queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_leftovers_expires
            ON leftovers_inventory(expires_date)
        """)
        print("✅ Added index on leftovers_inventory.expires_date")

        # Index for unconsumed leftovers
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_leftovers_consumed
            ON leftovers_inventory(consumed_at)
        """)
        print("✅ Added index on leftovers_inventory.consumed_at")

        # Composite index for meal history queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_meal_history_meal_date
            ON meal_history(meal_id, cooked_date)
        """)
        print("✅ Added composite index on meal_history(meal_id, cooked_date)")

        # Index for bento plans date queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_bento_plans_date
            ON bento_plans(date)
        """)
        print("✅ Added index on bento_plans.date")

        conn.commit()
        print("\n✅ All performance indexes added successfully!")

        # Analyze tables to update query planner statistics
        print("\n📊 Analyzing tables for query optimization...")
        cursor.execute("ANALYZE")
        conn.commit()
        print("✅ Query planner statistics updated!")

        return True

    except sqlite3.Error as e:
        print(f"❌ Error adding indexes: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()


if __name__ == '__main__':
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'meal_planner.db'

    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        sys.exit(1)

    success = migrate(db_path)
    sys.exit(0 if success else 1)
