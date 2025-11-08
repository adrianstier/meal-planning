#!/usr/bin/env python3
"""
Database migration: Add restaurants table
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def add_restaurants_table(db_path='meal_planner.db'):
    """Create the restaurants table with all necessary fields"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Create restaurants table
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

        # Create indexes for better performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine
            ON restaurants(cuisine_type)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_restaurants_location
            ON restaurants(latitude, longitude)
        """)

        conn.commit()

        print("=" * 60)
        print("✅ Restaurants table created successfully!")
        print("=" * 60)
        print("\nTable structure:")
        print("  - Basic info: name, address, phone, website")
        print("  - Location: latitude, longitude (for map display)")
        print("  - Details: cuisine_type, price_range, rating")
        print("  - Features: outdoor_seating, has_bar, kid_friendly, etc.")
        print("  - AI data: hours_data, happy_hour_info (JSON)")
        print("  - Metadata: tags, notes, timestamps")
        print("")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    add_restaurants_table()
