#!/usr/bin/env python3
"""
Database migration: Fix production schema issues
Ensures restaurants table and leftovers.cooked_date column exist
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def fix_production_schema(db_path='meal_planner.db'):
    """Fix missing tables and columns in production database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("=" * 60)
        print("🔧 Fixing production database schema...")
        print("=" * 60)

        # 1. Create restaurants table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS restaurants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                latitude REAL,
                longitude REAL,
                phone TEXT,
                website TEXT,
                cuisine_type TEXT,
                price_range TEXT,
                hours_data TEXT,
                happy_hour_info TEXT,
                outdoor_seating BOOLEAN DEFAULT 0,
                has_bar BOOLEAN DEFAULT 0,
                takes_reservations BOOLEAN DEFAULT 0,
                good_for_groups BOOLEAN DEFAULT 0,
                kid_friendly BOOLEAN DEFAULT 0,
                rating REAL,
                notes TEXT,
                tags TEXT,
                last_scraped TIMESTAMP,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("✅ Restaurants table ensured")

        # Create indexes for restaurants
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine
            ON restaurants(cuisine_type)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_restaurants_location
            ON restaurants(latitude, longitude)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_restaurants_user
            ON restaurants(user_id)
        """)
        print("✅ Restaurants indexes created")

        # 2. Check if leftovers table exists and has all columns
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='leftovers'
        """)
        leftovers_exists = cursor.fetchone() is not None

        if not leftovers_exists:
            # Create the full leftovers table
            cursor.execute("""
                CREATE TABLE leftovers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meal_id INTEGER,
                    user_id INTEGER NOT NULL,
                    meal_name TEXT NOT NULL,
                    servings_remaining INTEGER NOT NULL,
                    cooked_date DATE NOT NULL,
                    expires_date DATE NOT NULL,
                    container_type TEXT,
                    location TEXT DEFAULT 'fridge',
                    notes TEXT,
                    is_frozen BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    consumed_at TIMESTAMP,
                    FOREIGN KEY (meal_id) REFERENCES meals(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            print("✅ Leftovers table created")
        else:
            # Check if cooked_date column exists
            cursor.execute("PRAGMA table_info(leftovers)")
            columns = cursor.fetchall()
            column_names = [col[1] for col in columns]

            if 'cooked_date' not in column_names:
                # Need to recreate the table with the column
                print("⚠️  Missing cooked_date column - recreating table...")

                # Backup existing data
                cursor.execute("""
                    CREATE TABLE leftovers_backup AS
                    SELECT * FROM leftovers
                """)

                # Drop old table
                cursor.execute("DROP TABLE leftovers")

                # Create new table with all columns
                cursor.execute("""
                    CREATE TABLE leftovers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        meal_id INTEGER,
                        user_id INTEGER NOT NULL,
                        meal_name TEXT NOT NULL,
                        servings_remaining INTEGER NOT NULL,
                        cooked_date DATE NOT NULL,
                        expires_date DATE NOT NULL,
                        container_type TEXT,
                        location TEXT DEFAULT 'fridge',
                        notes TEXT,
                        is_frozen BOOLEAN DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        consumed_at TIMESTAMP,
                        FOREIGN KEY (meal_id) REFERENCES meals(id),
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                """)

                # Get common columns between old and new table
                cursor.execute("PRAGMA table_info(leftovers_backup)")
                old_columns = [col[1] for col in cursor.fetchall()]
                common_columns = [col for col in old_columns if col in column_names]

                if common_columns:
                    # Restore data for existing columns, using defaults for new ones
                    columns_str = ', '.join(common_columns)
                    cursor.execute(f"""
                        INSERT INTO leftovers ({columns_str}, cooked_date)
                        SELECT {columns_str},
                               COALESCE(created_at, date('now', '-3 days')) as cooked_date
                        FROM leftovers_backup
                    """)
                    print(f"✅ Restored {cursor.rowcount} leftover records")

                # Drop backup table
                cursor.execute("DROP TABLE leftovers_backup")
                print("✅ Leftovers table recreated with cooked_date column")
            else:
                print("✅ Leftovers table already has cooked_date column")

        # Create indexes for leftovers
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_leftovers_user
            ON leftovers(user_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_leftovers_meal
            ON leftovers(meal_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_leftovers_expires
            ON leftovers(expires_date)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_leftovers_cooked
            ON leftovers(cooked_date)
        """)
        print("✅ Leftovers indexes created")

        # 3. Create meal_history table if needed (referenced in errors)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS meal_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                meal_id INTEGER NOT NULL,
                cooked_date DATE NOT NULL,
                servings_made INTEGER,
                rating INTEGER,
                notes TEXT,
                cook_time_actual INTEGER,
                difficulty_actual TEXT,
                would_make_again BOOLEAN,
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (meal_id) REFERENCES meals(id)
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_meal_history_user
            ON meal_history(user_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_meal_history_date
            ON meal_history(cooked_date DESC)
        """)
        print("✅ Meal history table ensured")

        conn.commit()

        print("\n" + "=" * 60)
        print("✅ Production schema fixed successfully!")
        print("=" * 60)
        print("\nFixed issues:")
        print("  - Restaurants table created/verified")
        print("  - Leftovers table has cooked_date column")
        print("  - Meal history table created/verified")
        print("  - All necessary indexes created")
        print("")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    fix_production_schema()