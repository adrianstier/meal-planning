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

    def __init__(self, db_path: str = "meal_planner.db"):
        self.db_path = db_path
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

    def initialize_database(self, schema_file: str = "schema.sql",
                           seed_file: str = "seed_data.sql"):
        """Initialize database with schema and seed data"""
        conn = self.connect()
        cursor = conn.cursor()

        # Read and execute schema
        if os.path.exists(schema_file):
            with open(schema_file, 'r') as f:
                schema = f.read()
                cursor.executescript(schema)
            print(f"✓ Database schema created from {schema_file}")

        # Read and execute seed data
        if os.path.exists(seed_file):
            with open(seed_file, 'r') as f:
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

        # Get ingredients for each meal
        for meal in meals:
            meal['ingredients'] = self.get_meal_ingredients(meal['id'])

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
