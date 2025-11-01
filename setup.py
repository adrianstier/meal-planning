#!/usr/bin/env python3
"""
Setup script to initialize the meal planning database
Loads all SQL files in the correct order
"""

import os
from meal_planner import MealPlannerDB


def setup_database():
    """Initialize database with all data"""
    print("=" * 60)
    print("🍽️  Family Meal Planner - Database Setup")
    print("=" * 60)

    db = MealPlannerDB()

    # Check if database already exists
    if os.path.exists(db.db_path):
        # In production (Railway or Render), skip the prompt and just use existing DB
        if os.getenv('RAILWAY_ENVIRONMENT') or os.getenv('RENDER'):
            print(f"✓ Using existing database at '{db.db_path}'")
            print("  (Skipping recreation in production environment)")
            return
        # In local dev, prompt user
        response = input(f"\n⚠️  Database '{db.db_path}' already exists. Recreate? (y/n): ")
        if response.lower() != 'y':
            print("❌ Setup cancelled.")
            return
        os.remove(db.db_path)
        print(f"✓ Removed existing database")

    print("\n📊 Creating database...")

    # Initialize with schema and seed data
    db.initialize_database()

    # Load additional meals and run migrations
    sql_files = [
        'database/sql/additional_meals.sql',
        'database/sql/weekly_produce.sql',
        'database/migrations/add_history_features.sql',
        'database/migrations/add_leftovers_feature.sql'
    ]

    conn = db.connect()
    cursor = conn.cursor()

    for sql_file in sql_files:
        if os.path.exists(sql_file):
            print(f"\n📥 Loading {os.path.basename(sql_file)}...")
            with open(sql_file, 'r') as f:
                try:
                    cursor.executescript(f.read())
                    conn.commit()
                    print(f"✓ {os.path.basename(sql_file)} loaded successfully")
                except Exception as e:
                    print(f"⚠️  Warning loading {os.path.basename(sql_file)}: {e}")
        else:
            print(f"⚠️  {os.path.basename(sql_file)} not found, skipping...")

    # Run React schema migration
    print("\n🔄 Running React schema migration...")
    try:
        import subprocess
        result = subprocess.run(['python3', 'database/migrations/migrate_to_react_schema.py'],
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ React schema migrated!")
        else:
            print(f"⚠️  Migration warning: {result.stderr}")
    except Exception as e:
        print(f"⚠️  Could not run migration: {e}")

    print("\n" + "=" * 60)
    print("📊 DATABASE STATISTICS")
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
    print("\n🚀 Next steps:")
    print("  1. Copy .env.example to .env and add your ANTHROPIC_API_KEY")
    print("  2. Run: python app.py")
    print("  3. Open: http://localhost:5000")
    print("\n💡 Or use CLI: python cli.py --help")
    print()


if __name__ == "__main__":
    setup_database()
