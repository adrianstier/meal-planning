#!/usr/bin/env python3
"""
Migration: Add CSA (Community Supported Agriculture) Box Support
Creates tables for managing CSA deliveries and matching recipes with available ingredients
"""

import sqlite3
import sys
from datetime import datetime

def migrate(db_path):
    """Add CSA box tables to the database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("🥬 Adding CSA box support...")

        # Table 1: CSA Boxes - stores individual CSA deliveries
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS csa_boxes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                delivery_date DATE NOT NULL,
                source TEXT,
                notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        print("✅ Created csa_boxes table")

        # Table 2: CSA Box Items - individual ingredients in each box
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS csa_box_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                box_id INTEGER NOT NULL,
                ingredient_name TEXT NOT NULL,
                quantity REAL,
                unit TEXT,
                estimated_expiry_days INTEGER DEFAULT 7,
                is_used INTEGER DEFAULT 0,
                used_in_recipe_id INTEGER,
                used_date DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (box_id) REFERENCES csa_boxes(id) ON DELETE CASCADE,
                FOREIGN KEY (used_in_recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
            )
        """)
        print("✅ Created csa_box_items table")

        # Table 3: CSA Schedules - for recurring CSA deliveries
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS csa_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                source TEXT,
                frequency TEXT DEFAULT 'weekly',
                delivery_day TEXT,
                start_date DATE NOT NULL,
                end_date DATE,
                is_active INTEGER DEFAULT 1,
                auto_create_boxes INTEGER DEFAULT 1,
                default_items TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        print("✅ Created csa_schedules table")

        # Table 4: Recipe CSA Matches - cache for recipe recommendations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recipe_csa_matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                box_id INTEGER NOT NULL,
                recipe_id INTEGER NOT NULL,
                match_score REAL DEFAULT 0,
                matched_ingredients TEXT,
                missing_ingredients TEXT,
                diversity_score REAL DEFAULT 0,
                calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (box_id) REFERENCES csa_boxes(id) ON DELETE CASCADE,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
                UNIQUE(box_id, recipe_id)
            )
        """)
        print("✅ Created recipe_csa_matches table")

        # Create indexes for performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_csa_boxes_user_date
            ON csa_boxes(user_id, delivery_date DESC)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_csa_box_items_box
            ON csa_box_items(box_id, is_used)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_csa_schedules_user
            ON csa_schedules(user_id, is_active)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_recipe_matches_box
            ON recipe_csa_matches(box_id, match_score DESC)
        """)

        print("✅ Created indexes for CSA tables")

        conn.commit()
        print("✅ CSA box migration completed successfully!")
        return True

    except Exception as e:
        print(f"❌ Error during CSA box migration: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        # Default path
        db_path = "meal_planner.db"

    print(f"Running CSA box migration on: {db_path}")
    success = migrate(db_path)
    sys.exit(0 if success else 1)
