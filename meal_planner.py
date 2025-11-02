#!/usr/bin/env python3
"""
Family Meal Planning Application
Manages meals, ingredients, and weekly meal plans with kid-friendly options
"""

import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import os


def get_database_path() -> str:
    """
    Get the appropriate database path.
    Uses Railway persistent volume if available, otherwise local file.
    """
    # Check if running on Railway with a persistent volume
    volume_path = os.getenv('RAILWAY_VOLUME_MOUNT_PATH', '/app/data')

    if os.path.exists(volume_path) and os.path.isdir(volume_path):
        db_path = os.path.join(volume_path, 'meal_planner.db')
        print(f"📁 Using persistent volume database: {db_path}")
        return db_path
    else:
        print("📁 Using local database: meal_planner.db")
        return "meal_planner.db"


@dataclass
class Meal:
    """Represents a meal with all its components"""
    id: int
    name: str
    meal_type: str
    kid_friendly_level: int
    prep_time: int
    cook_time: int
    adult_friendly: bool
    notes: Optional[str]


@dataclass
class Ingredient:
    """Represents an ingredient"""
    id: int
    name: str
    category: str
    kid_friendly_level: int
    prep_difficulty: str
    notes: Optional[str]


class MealPlannerDB:
    """Database interface for meal planning"""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or get_database_path()
        self.conn = None

    def connect(self):
        """Connect to database"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        return self.conn

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

    def initialize_database(self, schema_file: str = "database/sql/schema.sql",
                           seed_file: str = "database/sql/seed_data.sql"):
        """Initialize database with schema and seed data"""
        from pathlib import Path

        conn = self.connect()
        cursor = conn.cursor()

        # Security: Validate paths to prevent path traversal attacks
        # Define allowed directory for SQL files
        allowed_base = Path(__file__).parent / "database"

        # Read and execute schema
        if schema_file:
            schema_path = Path(schema_file).resolve()
            # Security: Ensure path is within allowed directory
            try:
                schema_path.relative_to(allowed_base)
            except ValueError:
                raise ValueError(f"Security: Schema file path must be within {allowed_base}")

            if schema_path.exists():
                with open(schema_path, 'r') as f:
                    schema = f.read()
                    cursor.executescript(schema)
                print(f"✓ Database schema created from {schema_file}")

        # Read and execute seed data
        if seed_file:
            seed_path = Path(seed_file).resolve()
            # Security: Ensure path is within allowed directory
            try:
                seed_path.relative_to(allowed_base)
            except ValueError:
                raise ValueError(f"Security: Seed file path must be within {allowed_base}")

            if seed_path.exists():
                with open(seed_path, 'r') as f:
                    seed_data = f.read()
                    cursor.executescript(seed_data)
                print(f"✓ Sample data loaded from {seed_file}")

        conn.commit()
        print(f"✓ Database initialized at {self.db_path}")
        return conn

    def get_meals_by_type(self, meal_type: str,
                          min_kid_friendly: int = 1) -> List[Dict]:
        """Get all meals of a specific type"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT m.*, mt.name as meal_type_name
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            WHERE mt.name = ? AND m.kid_friendly_level >= ?
            ORDER BY m.kid_friendly_level DESC, m.name
        """

        cursor.execute(query, (meal_type, min_kid_friendly))
        meals = [dict(row) for row in cursor.fetchall()]

        # Security/Performance: Fix N+1 query - fetch all ingredients at once
        if meals:
            meal_ids = [meal['id'] for meal in meals]
            placeholders = ','.join(['?'] * len(meal_ids))

            cursor.execute(f"""
                SELECT mi.meal_id, i.name, i.category, mi.component_type,
                       mi.quantity, mi.is_optional
                FROM meal_ingredients mi
                JOIN ingredients i ON mi.ingredient_id = i.id
                WHERE mi.meal_id IN ({placeholders})
                ORDER BY mi.meal_id,
                    CASE mi.component_type
                        WHEN 'protein' THEN 1
                        WHEN 'veggie' THEN 2
                        WHEN 'starch' THEN 3
                        WHEN 'fruit' THEN 4
                        ELSE 5
                    END
            """, meal_ids)

            # Group ingredients by meal_id
            ingredients_by_meal = {}
            for row in cursor.fetchall():
                meal_id = row['meal_id']
                if meal_id not in ingredients_by_meal:
                    ingredients_by_meal[meal_id] = []
                ingredients_by_meal[meal_id].append({
                    'name': row['name'],
                    'category': row['category'],
                    'component_type': row['component_type'],
                    'quantity': row['quantity'],
                    'is_optional': row['is_optional']
                })

            # Attach ingredients to meals
            for meal in meals:
                meal['ingredients'] = ingredients_by_meal.get(meal['id'], [])

        return meals

    def get_meal_ingredients(self, meal_id: int) -> List[Dict]:
        """Get all ingredients for a specific meal"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT i.name, i.category, mi.component_type,
                   mi.quantity, mi.is_optional
            FROM meal_ingredients mi
            JOIN ingredients i ON mi.ingredient_id = i.id
            WHERE mi.meal_id = ?
            ORDER BY
                CASE mi.component_type
                    WHEN 'protein' THEN 1
                    WHEN 'veggie' THEN 2
                    WHEN 'starch' THEN 3
                    WHEN 'fruit' THEN 4
                    ELSE 5
                END
        """

        cursor.execute(query, (meal_id,))
        return [dict(row) for row in cursor.fetchall()]

    def get_weekly_meal_plan(self, meal_plan_id: int = 1) -> List[Dict]:
        """Get complete weekly meal plan with all meals"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT sm.*, m.name as meal_name, m.notes as meal_notes,
                   mt.name as meal_type_name, sm.meal_date, sm.day_of_week
            FROM scheduled_meals sm
            JOIN meals m ON sm.meal_id = m.id
            JOIN meal_types mt ON sm.meal_type_id = mt.id
            WHERE sm.meal_plan_id = ?
            ORDER BY sm.meal_date,
                CASE mt.name
                    WHEN 'breakfast' THEN 1
                    WHEN 'lunch' THEN 2
                    WHEN 'snack' THEN 3
                    WHEN 'dinner' THEN 4
                END
        """

        cursor.execute(query, (meal_plan_id,))
        scheduled = [dict(row) for row in cursor.fetchall()]

        # Get ingredients for each scheduled meal
        for meal in scheduled:
            meal['ingredients'] = self.get_meal_ingredients(meal['meal_id'])

        return scheduled

    def generate_shopping_list(self, meal_plan_id: int = 1) -> Dict[str, List[Dict]]:
        """Generate shopping list grouped by category"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT DISTINCT i.name, i.category,
                   GROUP_CONCAT(mi.quantity, ' + ') as quantities
            FROM scheduled_meals sm
            JOIN meal_ingredients mi ON sm.meal_id = mi.meal_id
            JOIN ingredients i ON mi.ingredient_id = i.id
            WHERE sm.meal_plan_id = ?
            GROUP BY i.id, i.name, i.category
            ORDER BY i.category, i.name
        """

        cursor.execute(query, (meal_plan_id,))
        items = [dict(row) for row in cursor.fetchall()]

        # Group by category
        shopping_list = {}
        for item in items:
            category = item['category'].title()
            if category not in shopping_list:
                shopping_list[category] = []
            shopping_list[category].append({
                'name': item['name'],
                'quantities': item['quantities']
            })

        return shopping_list

    def search_meals(self, query: str, meal_type: Optional[str] = None) -> List[Dict]:
        """Search meals by name or ingredients"""
        conn = self.connect()
        cursor = conn.cursor()

        sql = """
            SELECT DISTINCT m.*, mt.name as meal_type_name
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            LEFT JOIN meal_ingredients mi ON m.id = mi.meal_id
            LEFT JOIN ingredients i ON mi.ingredient_id = i.id
            WHERE (m.name LIKE ? OR i.name LIKE ?)
        """

        params = [f"%{query}%", f"%{query}%"]

        if meal_type:
            sql += " AND mt.name = ?"
            params.append(meal_type)

        sql += " ORDER BY m.kid_friendly_level DESC"

        cursor.execute(sql, params)
        meals = [dict(row) for row in cursor.fetchall()]

        for meal in meals:
            meal['ingredients'] = self.get_meal_ingredients(meal['id'])

        return meals

    def add_meal(self, name: str, meal_type: str, kid_friendly_level: int,
                 prep_time: int, cook_time: int, adult_friendly: bool = True,
                 notes: Optional[str] = None) -> int:
        """Add a new meal to the database"""
        conn = self.connect()
        cursor = conn.cursor()

        # Get meal_type_id
        cursor.execute("SELECT id FROM meal_types WHERE name = ?", (meal_type,))
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"Invalid meal type: {meal_type}")

        meal_type_id = result[0]

        cursor.execute("""
            INSERT INTO meals (name, meal_type_id, kid_friendly_level,
                             prep_time_minutes, cook_time_minutes,
                             adult_friendly, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (name, meal_type_id, kid_friendly_level, prep_time,
              cook_time, adult_friendly, notes))

        conn.commit()
        meal_id = cursor.lastrowid
        print(f"✓ Added meal: {name} (ID: {meal_id})")
        return meal_id

    def add_ingredient_to_meal(self, meal_id: int, ingredient_name: str,
                               component_type: str, quantity: str,
                               is_optional: bool = False):
        """Add an ingredient to a meal"""
        conn = self.connect()
        cursor = conn.cursor()

        # Get or create ingredient
        cursor.execute("SELECT id FROM ingredients WHERE name = ?",
                      (ingredient_name,))
        result = cursor.fetchone()

        if result:
            ingredient_id = result[0]
        else:
            # Create new ingredient with defaults
            cursor.execute("""
                INSERT INTO ingredients (name, category, kid_friendly_level)
                VALUES (?, ?, ?)
            """, (ingredient_name, component_type, 5))
            ingredient_id = cursor.lastrowid
            print(f"✓ Created new ingredient: {ingredient_name}")

        # Link to meal
        cursor.execute("""
            INSERT INTO meal_ingredients
            (meal_id, ingredient_id, component_type, quantity, is_optional)
            VALUES (?, ?, ?, ?, ?)
        """, (meal_id, ingredient_id, component_type, quantity, is_optional))

        conn.commit()
        print(f"✓ Added {ingredient_name} to meal")

    def get_kid_friendly_meals(self, min_level: int = 7) -> List[Dict]:
        """Get highly kid-friendly meals"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT m.*, mt.name as meal_type_name
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            WHERE m.kid_friendly_level >= ?
            ORDER BY m.kid_friendly_level DESC, m.name
        """

        cursor.execute(query, (min_level,))
        meals = [dict(row) for row in cursor.fetchall()]

        for meal in meals:
            meal['ingredients'] = self.get_meal_ingredients(meal['id'])

        return meals

    def get_stats(self) -> Dict:
        """Get database statistics"""
        conn = self.connect()
        cursor = conn.cursor()

        stats = {}

        # Count meals by type
        cursor.execute("""
            SELECT mt.name, COUNT(*) as count
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            GROUP BY mt.name
        """)
        stats['meals_by_type'] = {row['name']: row['count']
                                   for row in cursor.fetchall()}

        # Count ingredients by category
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM ingredients
            GROUP BY category
            ORDER BY count DESC
        """)
        stats['ingredients_by_category'] = {row['category']: row['count']
                                             for row in cursor.fetchall()}

        # Total counts
        cursor.execute("SELECT COUNT(*) as count FROM meals")
        stats['total_meals'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM ingredients")
        stats['total_ingredients'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM meal_plans")
        stats['total_meal_plans'] = cursor.fetchone()['count']

        return stats

    # ========== MEAL HISTORY & FAVORITES METHODS ==========

    def mark_meal_as_cooked(self, meal_id: int, cooked_date: str = None,
                            rating: int = None, notes: str = None):
        """Mark a meal as cooked on a specific date"""
        if cooked_date is None:
            cooked_date = datetime.now().strftime('%Y-%m-%d')

        conn = self.connect()
        cursor = conn.cursor()

        # Add to history
        cursor.execute("""
            INSERT INTO meal_history (meal_id, cooked_date, rating, notes)
            VALUES (?, ?, ?, ?)
        """, (meal_id, cooked_date, rating, notes))

        # Update meal stats
        cursor.execute("""
            UPDATE meals
            SET last_cooked = ?,
                times_cooked = times_cooked + 1
            WHERE id = ?
        """, (cooked_date, meal_id))

        conn.commit()
        return cursor.lastrowid

    def toggle_favorite(self, meal_id: int) -> bool:
        """Toggle a meal's favorite status"""
        conn = self.connect()
        cursor = conn.cursor()

        # Check if already favorited
        cursor.execute("SELECT id FROM meal_favorites WHERE meal_id = ?", (meal_id,))
        existing = cursor.fetchone()

        if existing:
            # Remove from favorites
            cursor.execute("DELETE FROM meal_favorites WHERE meal_id = ?", (meal_id,))
            cursor.execute("UPDATE meals SET is_favorite = 0 WHERE id = ?", (meal_id,))
            conn.commit()
            return False
        else:
            # Add to favorites
            cursor.execute("INSERT INTO meal_favorites (meal_id) VALUES (?)", (meal_id,))
            cursor.execute("UPDATE meals SET is_favorite = 1 WHERE id = ?", (meal_id,))
            conn.commit()
            return True

    def get_favorites(self) -> List[Dict]:
        """Get all favorite meals"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT m.*, mt.name as meal_type_name, mf.favorited_at
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            JOIN meal_favorites mf ON m.id = mf.meal_id
            ORDER BY mf.favorited_at DESC
        """

        cursor.execute(query)
        meals = [dict(row) for row in cursor.fetchall()]

        for meal in meals:
            meal['ingredients'] = self.get_meal_ingredients(meal['id'])

        return meals

    def get_recently_cooked(self, limit: int = 10) -> List[Dict]:
        """Get recently cooked meals"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT m.*, mt.name as meal_type_name,
                   m.last_cooked, m.times_cooked,
                   mh.rating, mh.notes as last_notes
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            LEFT JOIN meal_history mh ON m.id = mh.meal_id
                AND mh.cooked_date = m.last_cooked
            WHERE m.last_cooked IS NOT NULL
            ORDER BY m.last_cooked DESC
            LIMIT ?
        """

        cursor.execute(query, (limit,))
        meals = [dict(row) for row in cursor.fetchall()]

        for meal in meals:
            meal['ingredients'] = self.get_meal_ingredients(meal['id'])

        return meals

    def get_havent_made_in_while(self, days: int = 30, limit: int = 10) -> List[Dict]:
        """Get meals that haven't been made recently or ever"""
        conn = self.connect()
        cursor = conn.cursor()

        cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

        query = """
            SELECT m.*, mt.name as meal_type_name,
                   m.last_cooked, m.times_cooked
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            WHERE m.last_cooked IS NULL
               OR m.last_cooked < ?
            ORDER BY m.last_cooked ASC NULLS FIRST,
                     m.kid_friendly_level DESC
            LIMIT ?
        """

        cursor.execute(query, (cutoff_date, limit))
        meals = [dict(row) for row in cursor.fetchall()]

        for meal in meals:
            meal['ingredients'] = self.get_meal_ingredients(meal['id'])

        return meals

    def get_meal_history(self, meal_id: int = None, limit: int = 20) -> List[Dict]:
        """Get cooking history, optionally for a specific meal"""
        conn = self.connect()
        cursor = conn.cursor()

        if meal_id:
            query = """
                SELECT mh.*, m.name as meal_name, mt.name as meal_type_name
                FROM meal_history mh
                JOIN meals m ON mh.meal_id = m.id
                JOIN meal_types mt ON m.meal_type_id = mt.id
                WHERE mh.meal_id = ?
                ORDER BY mh.cooked_date DESC
                LIMIT ?
            """
            cursor.execute(query, (meal_id, limit))
        else:
            query = """
                SELECT mh.*, m.name as meal_name, mt.name as meal_type_name
                FROM meal_history mh
                JOIN meals m ON mh.meal_id = m.id
                JOIN meal_types mt ON m.meal_type_id = mt.id
                ORDER BY mh.cooked_date DESC
                LIMIT ?
            """
            cursor.execute(query, (limit,))

        return [dict(row) for row in cursor.fetchall()]

    # ========== LEFTOVERS MANAGEMENT METHODS ==========

    def add_leftovers(self, meal_id: int, cooked_date: str = None,
                     servings: int = 2, days_good: int = 3):
        """Add leftovers to inventory when a meal is cooked"""
        if cooked_date is None:
            cooked_date = datetime.now().strftime('%Y-%m-%d')

        expires_date = (datetime.strptime(cooked_date, '%Y-%m-%d') +
                       timedelta(days=days_good)).strftime('%Y-%m-%d')

        conn = self.connect()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO leftovers_inventory
            (meal_id, cooked_date, servings_remaining, expires_date)
            VALUES (?, ?, ?, ?)
        """, (meal_id, cooked_date, servings, expires_date))

        conn.commit()
        return cursor.lastrowid

    def get_active_leftovers(self) -> List[Dict]:
        """Get all unconsumed leftovers, sorted by expiration"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT l.*, m.name as meal_name, mt.name as meal_type_name
            FROM leftovers_inventory l
            JOIN meals m ON l.meal_id = m.id
            JOIN meal_types mt ON m.meal_type_id = mt.id
            WHERE l.consumed_at IS NULL
            ORDER BY l.expires_date ASC
        """

        cursor.execute(query)
        leftovers = [dict(row) for row in cursor.fetchall()]

        # Add days until expiration
        today = datetime.now().date()
        for item in leftovers:
            expires = datetime.strptime(item['expires_date'], '%Y-%m-%d').date()
            item['days_until_expiry'] = (expires - today).days
            item['is_expiring_soon'] = item['days_until_expiry'] <= 1

        return leftovers

    def mark_leftovers_consumed(self, leftover_id: int):
        """Mark leftovers as consumed"""
        conn = self.connect()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE leftovers_inventory
            SET consumed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (leftover_id,))

        conn.commit()
        return cursor.rowcount > 0

    def update_leftover_servings(self, leftover_id: int, servings: int):
        """Update remaining servings for leftovers"""
        conn = self.connect()
        cursor = conn.cursor()

        if servings <= 0:
            # Mark as consumed if no servings left
            return self.mark_leftovers_consumed(leftover_id)

        cursor.execute("""
            UPDATE leftovers_inventory
            SET servings_remaining = ?
            WHERE id = ?
        """, (servings, leftover_id))

        conn.commit()
        return cursor.rowcount > 0

    def get_leftover_friendly_meals(self, limit: int = 20) -> List[Dict]:
        """Get meals that make good leftovers"""
        conn = self.connect()
        cursor = conn.cursor()

        query = """
            SELECT m.*, mt.name as meal_type_name
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            WHERE m.makes_leftovers = 1
            ORDER BY m.kid_friendly_level DESC, m.name
            LIMIT ?
        """

        cursor.execute(query, (limit,))
        meals = [dict(row) for row in cursor.fetchall()]

        for meal in meals:
            meal['ingredients'] = self.get_meal_ingredients(meal['id'])

        return meals

    def update_meal_leftover_settings(self, meal_id: int, makes_leftovers: bool = True,
                                     servings: int = 2, days: int = 3):
        """Update leftover settings for a meal"""
        conn = self.connect()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE meals
            SET makes_leftovers = ?,
                leftover_servings = ?,
                leftover_days = ?
            WHERE id = ?
        """, (makes_leftovers, servings, days, meal_id))

        conn.commit()
        return cursor.rowcount > 0

    def suggest_leftover_lunches(self, date: str = None) -> List[Dict]:
        """Suggest using leftovers for lunch based on what's in the fridge"""
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')

        # Get active leftovers that are still good
        leftovers = self.get_active_leftovers()

        suggestions = []
        for item in leftovers:
            if item['servings_remaining'] > 0:
                suggestions.append({
                    'id': item['id'],
                    'meal_id': item['meal_id'],
                    'meal_name': item['meal_name'],
                    'servings': item['servings_remaining'],
                    'cooked_date': item['cooked_date'],
                    'expires_date': item['expires_date'],
                    'days_until_expiry': item['days_until_expiry'],
                    'is_expiring_soon': item['is_expiring_soon'],
                    'suggestion': f"Use up {item['meal_name']} leftovers"
                })

        return suggestions

    # ========================================================================
    # School Menu Methods
    # ========================================================================

    def add_school_menu_item(self, menu_date: str, meal_name: str,
                             meal_type: str = 'lunch', description: str = None):
        """Add a school cafeteria menu item"""
        conn = self.connect()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                INSERT INTO school_menu_items (menu_date, meal_name, meal_type, description)
                VALUES (?, ?, ?, ?)
            """, (menu_date, meal_name, meal_type, description))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            # Item already exists for this date
            return None

    def add_school_menu_bulk(self, menu_items: List[Dict]) -> int:
        """
        Add multiple school menu items at once
        menu_items: List of dicts with keys: menu_date, meal_name, meal_type, description
        Returns: number of items added
        """
        conn = self.connect()
        cursor = conn.cursor()
        added_count = 0

        for item in menu_items:
            try:
                cursor.execute("""
                    INSERT INTO school_menu_items (menu_date, meal_name, meal_type, description)
                    VALUES (?, ?, ?, ?)
                """, (
                    item['menu_date'],
                    item['meal_name'],
                    item.get('meal_type', 'lunch'),
                    item.get('description')
                ))
                added_count += 1
            except sqlite3.IntegrityError:
                # Skip duplicates
                continue

        conn.commit()
        return added_count

    def get_school_menu_by_date(self, menu_date: str) -> List[Dict]:
        """Get school menu for a specific date"""
        conn = self.connect()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT sm.*,
                   COUNT(sf.id) as dislike_count,
                   GROUP_CONCAT(sf.feedback_type) as feedback_types
            FROM school_menu_items sm
            LEFT JOIN school_menu_feedback sf ON sm.id = sf.menu_item_id
            WHERE sm.menu_date = ?
            GROUP BY sm.id
            ORDER BY sm.meal_type, sm.meal_name
        """, (menu_date,))

        return [dict(row) for row in cursor.fetchall()]

    def get_school_menu_range(self, start_date: str, end_date: str) -> List[Dict]:
        """Get school menu for a date range"""
        conn = self.connect()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT sm.*,
                   COUNT(sf.id) as dislike_count,
                   GROUP_CONCAT(sf.feedback_type) as feedback_types
            FROM school_menu_items sm
            LEFT JOIN school_menu_feedback sf ON sm.id = sf.menu_item_id
            WHERE sm.menu_date BETWEEN ? AND ?
            GROUP BY sm.id
            ORDER BY sm.menu_date, sm.meal_type, sm.meal_name
        """, (start_date, end_date))

        return [dict(row) for row in cursor.fetchall()]

    def get_upcoming_school_menu(self, days: int = 7) -> List[Dict]:
        """Get upcoming school menu items"""
        today = datetime.now().strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
        return self.get_school_menu_range(today, end_date)

    def add_menu_feedback(self, menu_item_id: int, feedback_type: str, notes: str = None):
        """Record feedback about a school menu item (disliked, allergic, wont_eat)"""
        conn = self.connect()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO school_menu_feedback (menu_item_id, feedback_type, notes)
            VALUES (?, ?, ?)
        """, (menu_item_id, feedback_type, notes))

        conn.commit()
        return cursor.lastrowid

    def get_disliked_school_meals(self) -> List[str]:
        """Get list of school meals kids don't like"""
        conn = self.connect()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT DISTINCT sm.meal_name
            FROM school_menu_items sm
            JOIN school_menu_feedback sf ON sm.id = sf.menu_item_id
            WHERE sf.feedback_type IN ('disliked', 'wont_eat')
        """)

        return [row['meal_name'] for row in cursor.fetchall()]

    def suggest_lunch_alternatives(self, menu_date: str) -> Dict:
        """
        Suggest lunch alternatives based on:
        1. What's for school lunch that day
        2. If kids dislike school lunch
        3. What leftovers are available
        4. Quick-to-make lunch options
        """
        conn = self.connect()
        cursor = conn.cursor()

        # Get school menu for that date
        school_menu = self.get_school_menu_by_date(menu_date)

        # Get disliked meals
        disliked_meals = self.get_disliked_school_meals()

        # Check if any school menu items are disliked
        needs_alternative = any(
            item['meal_name'] in disliked_meals or item['dislike_count'] > 0
            for item in school_menu
        )

        # Get available leftovers
        leftovers = self.get_active_leftovers()

        # Get quick lunch meals (under 15 min total time)
        cursor.execute("""
            SELECT m.*, mt.name as meal_type_name
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            WHERE mt.name IN ('lunch', 'snack')
            AND (m.prep_time_minutes + m.cook_time_minutes) <= 15
            AND m.kid_friendly_level >= 7
            ORDER BY m.kid_friendly_level DESC
            LIMIT 5
        """)
        quick_lunches = [dict(row) for row in cursor.fetchall()]

        return {
            'date': menu_date,
            'school_menu': school_menu,
            'needs_alternative': needs_alternative,
            'available_leftovers': leftovers,
            'quick_lunch_options': quick_lunches,
            'recommendation': self._generate_lunch_recommendation(
                needs_alternative, leftovers, quick_lunches, school_menu
            )
        }

    def _generate_lunch_recommendation(self, needs_alternative: bool,
                                      leftovers: List, quick_lunches: List,
                                      school_menu: List) -> str:
        """Generate a smart lunch recommendation"""
        if not needs_alternative and school_menu:
            return f"School lunch looks good today: {school_menu[0]['meal_name']}"

        if needs_alternative:
            if leftovers and len(leftovers) > 0:
                expiring_soon = [l for l in leftovers if l['days_until_expiry'] <= 2]
                if expiring_soon:
                    return f"🎯 Pack {expiring_soon[0]['meal_name']} leftovers (expires soon!)"
                return f"💡 Pack {leftovers[0]['meal_name']} leftovers"

            if quick_lunches:
                return f"🍱 Make quick lunch: {quick_lunches[0]['name']} (under 15 min)"

            return "⚠️ Plan ahead: Make extra dinner tonight for lunch tomorrow"

        return "✓ School lunch should be fine"

    def delete_school_menu_item(self, menu_item_id: int):
        """Delete a school menu item"""
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM school_menu_items WHERE id = ?", (menu_item_id,))
        conn.commit()

    def clear_old_school_menus(self, days_ago: int = 30):
        """Clear school menu items older than specified days"""
        cutoff_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM school_menu_items WHERE menu_date < ?", (cutoff_date,))
        conn.commit()
        return cursor.rowcount


def print_meal(meal: Dict, show_ingredients: bool = True):
    """Pretty print a meal"""
    print(f"\n{'='*60}")
    print(f"🍽️  {meal['name']}")
    print(f"{'='*60}")
    print(f"Type: {meal.get('meal_type_name', 'Unknown')}")
    print(f"Kid Friendly: {'⭐' * meal['kid_friendly_level']} ({meal['kid_friendly_level']}/10)")
    print(f"Prep Time: {meal.get('prep_time_minutes', 0)} min | Cook Time: {meal.get('cook_time_minutes', 0)} min")

    if meal.get('notes'):
        print(f"Notes: {meal['notes']}")

    if show_ingredients and meal.get('ingredients'):
        print(f"\nIngredients:")

        # Group by component type
        by_type = {}
        for ing in meal['ingredients']:
            comp_type = ing['component_type']
            if comp_type not in by_type:
                by_type[comp_type] = []
            by_type[comp_type].append(ing)

        for comp_type in ['protein', 'veggie', 'starch', 'fruit', 'side', 'condiment']:
            if comp_type in by_type:
                print(f"\n  {comp_type.title()}:")
                for ing in by_type[comp_type]:
                    optional = " (optional)" if ing['is_optional'] else ""
                    quantity = f" - {ing['quantity']}" if ing['quantity'] else ""
                    print(f"    • {ing['name']}{quantity}{optional}")


def print_shopping_list(shopping_list: Dict[str, List[Dict]]):
    """Pretty print shopping list"""
    print(f"\n{'='*60}")
    print(f"🛒  SHOPPING LIST")
    print(f"{'='*60}")

    category_emojis = {
        'Protein': '🍗',
        'Veggie': '🥦',
        'Starch': '🍞',
        'Fruit': '🍎',
        'Dairy': '🥛',
        'Pantry': '🧂',
        'Snack': '🍪'
    }

    for category in sorted(shopping_list.keys()):
        emoji = category_emojis.get(category, '📦')
        print(f"\n{emoji}  {category.upper()}")
        print("-" * 40)
        for item in shopping_list[category]:
            print(f"  ☐ {item['name']}")
            if item['quantities'] and item['quantities'] != 'None':
                print(f"      ({item['quantities']})")


def print_weekly_plan(meals: List[Dict]):
    """Pretty print weekly meal plan"""
    print(f"\n{'='*70}")
    print(f"📅  WEEKLY MEAL PLAN")
    print(f"{'='*70}")

    current_day = None

    for meal in meals:
        day = meal['day_of_week']
        meal_type = meal['meal_type_name']

        if day != current_day:
            current_day = day
            print(f"\n{'─'*70}")
            print(f"📆  {day.upper()} - {meal['meal_date']}")
            print(f"{'─'*70}")

        # Meal type icon
        icons = {'dinner': '🍽️', 'lunch': '🍱', 'snack': '🧃', 'breakfast': '🍳'}
        icon = icons.get(meal_type, '🍴')

        print(f"\n  {icon} {meal_type.title()}: {meal['meal_name']}")

        if meal.get('notes'):
            print(f"     💡 {meal['notes']}")

        # Show ingredients in compact form
        ingredients = meal.get('ingredients', [])
        if ingredients:
            by_type = {}
            for ing in ingredients:
                comp_type = ing['component_type']
                if comp_type not in by_type:
                    by_type[comp_type] = []
                by_type[comp_type].append(ing['name'])

            for comp_type in ['protein', 'veggie', 'starch', 'fruit']:
                if comp_type in by_type:
                    items = ', '.join(by_type[comp_type])
                    print(f"     • {comp_type.title()}: {items}")


if __name__ == "__main__":
    print("🍽️  Family Meal Planner - Database Manager")
    print("=" * 60)

    # Initialize database
    db = MealPlannerDB()
    db.initialize_database()

    print("\n" + "=" * 60)
    print("📊  DATABASE STATISTICS")
    print("=" * 60)

    stats = db.get_stats()
    print(f"\n✓ Total Meals: {stats['total_meals']}")
    print(f"✓ Total Ingredients: {stats['total_ingredients']}")
    print(f"✓ Total Meal Plans: {stats['total_meal_plans']}")

    print(f"\n📋 Meals by Type:")
    for meal_type, count in stats['meals_by_type'].items():
        print(f"  • {meal_type.title()}: {count}")

    print(f"\n🥘 Ingredients by Category:")
    for category, count in stats['ingredients_by_category'].items():
        print(f"  • {category.title()}: {count}")

    db.close()
    print(f"\n{'='*60}")
    print("✅ Database setup complete!")
    print(f"{'='*60}")
