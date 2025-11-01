#!/usr/bin/env python3
"""
Interactive CLI for Family Meal Planning
"""

import argparse
from meal_planner import (
    MealPlannerDB, print_meal, print_shopping_list, print_weekly_plan
)


def main():
    parser = argparse.ArgumentParser(
        description="Family Meal Planning Assistant",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --init                    # Initialize database
  %(prog)s --week                    # Show this week's meal plan
  %(prog)s --shopping                # Generate shopping list
  %(prog)s --search chicken          # Search for chicken meals
  %(prog)s --kid-friendly            # Show kid-friendly meals
  %(prog)s --meals dinner            # Show all dinner options
  %(prog)s --stats                   # Show database statistics
        """
    )

    # Commands
    parser.add_argument('--init', action='store_true',
                       help='Initialize database with schema and sample data')
    parser.add_argument('--week', action='store_true',
                       help='Show weekly meal plan')
    parser.add_argument('--shopping', action='store_true',
                       help='Generate shopping list for the week')
    parser.add_argument('--meals', type=str, metavar='TYPE',
                       help='Show all meals of type (dinner, lunch, snack, breakfast)')
    parser.add_argument('--search', type=str, metavar='QUERY',
                       help='Search meals by name or ingredient')
    parser.add_argument('--kid-friendly', action='store_true',
                       help='Show highly kid-friendly meals (7+/10)')
    parser.add_argument('--stats', action='store_true',
                       help='Show database statistics')
    parser.add_argument('--add-meal', action='store_true',
                       help='Interactive meal addition')

    # Options
    parser.add_argument('--db', type=str, default='meal_planner.db',
                       help='Database file path (default: meal_planner.db)')
    parser.add_argument('--plan-id', type=int, default=1,
                       help='Meal plan ID to use (default: 1)')

    args = parser.parse_args()

    db = MealPlannerDB(args.db)

    try:
        # Initialize database
        if args.init:
            db.initialize_database()
            return

        # Show weekly plan
        if args.week:
            meals = db.get_weekly_meal_plan(args.plan_id)
            if meals:
                print_weekly_plan(meals)
            else:
                print("❌ No meal plan found. Use --init to create sample data.")
            return

        # Generate shopping list
        if args.shopping:
            shopping_list = db.generate_shopping_list(args.plan_id)
            if shopping_list:
                print_shopping_list(shopping_list)
            else:
                print("❌ No meal plan found. Use --init to create sample data.")
            return

        # Show meals by type
        if args.meals:
            meals = db.get_meals_by_type(args.meals)
            if meals:
                print(f"\n{'='*60}")
                print(f"🍽️  {args.meals.upper()} OPTIONS ({len(meals)} meals)")
                print(f"{'='*60}")
                for meal in meals:
                    print_meal(meal, show_ingredients=True)
            else:
                print(f"❌ No {args.meals} meals found.")
            return

        # Search meals
        if args.search:
            meals = db.search_meals(args.search)
            if meals:
                print(f"\n{'='*60}")
                print(f"🔍  SEARCH RESULTS for '{args.search}' ({len(meals)} meals)")
                print(f"{'='*60}")
                for meal in meals:
                    print_meal(meal, show_ingredients=True)
            else:
                print(f"❌ No meals found matching '{args.search}'")
            return

        # Show kid-friendly meals
        if args.kid_friendly:
            meals = db.get_kid_friendly_meals(min_level=7)
            if meals:
                print(f"\n{'='*60}")
                print(f"⭐ KID-FRIENDLY MEALS ({len(meals)} meals)")
                print(f"{'='*60}")
                for meal in meals:
                    print_meal(meal, show_ingredients=True)
            else:
                print("❌ No kid-friendly meals found.")
            return

        # Show statistics
        if args.stats:
            stats = db.get_stats()
            print(f"\n{'='*60}")
            print(f"📊  DATABASE STATISTICS")
            print(f"{'='*60}")
            print(f"\n✓ Total Meals: {stats['total_meals']}")
            print(f"✓ Total Ingredients: {stats['total_ingredients']}")
            print(f"✓ Total Meal Plans: {stats['total_meal_plans']}")

            print(f"\n📋 Meals by Type:")
            for meal_type, count in stats['meals_by_type'].items():
                print(f"  • {meal_type.title()}: {count}")

            print(f"\n🥘 Ingredients by Category:")
            for category, count in stats['ingredients_by_category'].items():
                print(f"  • {category.title()}: {count}")
            return

        # Interactive meal addition
        if args.add_meal:
            print("\n🍽️  ADD NEW MEAL")
            print("=" * 60)

            name = input("Meal name: ").strip()
            meal_type = input("Meal type (dinner/lunch/snack/breakfast): ").strip().lower()
            kid_friendly = int(input("Kid-friendly level (1-10): "))
            prep_time = int(input("Prep time (minutes): "))
            cook_time = int(input("Cook time (minutes): "))
            adult_friendly = input("Adult-friendly? (y/n): ").strip().lower() == 'y'
            notes = input("Notes (optional): ").strip() or None

            meal_id = db.add_meal(name, meal_type, kid_friendly,
                                 prep_time, cook_time, adult_friendly, notes)

            print(f"\n✅ Meal added! ID: {meal_id}")

            # Add ingredients
            add_ingredients = input("\nAdd ingredients? (y/n): ").strip().lower() == 'y'

            while add_ingredients:
                ing_name = input("  Ingredient name: ").strip()
                component_type = input("  Type (protein/veggie/starch/fruit/condiment): ").strip()
                quantity = input("  Quantity (e.g., '2 cups'): ").strip()
                optional = input("  Optional? (y/n): ").strip().lower() == 'y'

                db.add_ingredient_to_meal(meal_id, ing_name, component_type,
                                         quantity, optional)

                add_more = input("\n  Add another ingredient? (y/n): ").strip().lower()
                add_ingredients = add_more == 'y'

            print("\n✅ Meal creation complete!")
            return

        # No arguments provided
        parser.print_help()

    finally:
        db.close()


if __name__ == "__main__":
    main()
