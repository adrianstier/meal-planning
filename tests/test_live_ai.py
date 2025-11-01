#!/usr/bin/env python3
"""
Test live AI recipe parsing with real API
"""

import os
from dotenv import load_dotenv
from ai_recipe_parser import RecipeParser
import json

load_dotenv()

def test_live_parsing():
    api_key = os.getenv('ANTHROPIC_API_KEY')

    if not api_key:
        print("❌ No API key found in .env")
        return False

    print("="*60)
    print("Testing Live AI Recipe Parsing")
    print("="*60)
    print(f"\n✓ API key loaded: {api_key[:15]}...\n")

    # Create parser
    parser = RecipeParser(api_key)

    # Test recipe
    recipe = """
    Easy Chicken Tacos

    Perfect for busy weeknights! Kids love building their own.

    Ingredients:
    - 1 lb chicken breast, diced
    - 1 packet taco seasoning
    - 8 taco shells
    - 1 cup shredded cheese
    - 1 cup lettuce, chopped
    - 2 tomatoes, diced
    - 1/2 cup sour cream
    - Salsa (optional)

    Instructions:
    1. Cook diced chicken in a pan over medium heat
    2. Add taco seasoning and water according to packet
    3. Simmer for 5 minutes
    4. Warm taco shells
    5. Let kids build their own tacos with toppings!

    Prep time: 10 minutes
    Cook time: 15 minutes
    Serves: 4
    """

    print("📝 Test Recipe:")
    print("-" * 60)
    print(recipe.strip())
    print("-" * 60)

    print("\n🤖 Sending to Claude AI for parsing...")

    try:
        result = parser.parse_recipe(recipe)

        print("\n✅ Successfully parsed!")
        print("\n📊 Extracted Data:")
        print("-" * 60)
        print(json.dumps(result, indent=2))
        print("-" * 60)

        # Verify key fields
        print("\n🔍 Verification:")
        checks = [
            ("Name", result.get('name')),
            ("Meal Type", result.get('meal_type')),
            ("Kid-Friendly Level", result.get('kid_friendly_level')),
            ("Prep Time", result.get('prep_time_minutes')),
            ("Cook Time", result.get('cook_time_minutes')),
            ("Ingredients Count", len(result.get('ingredients', [])))
        ]

        for check, value in checks:
            print(f"  ✓ {check}: {value}")

        print("\n🎉 AI Recipe Parser is working perfectly!")
        return True

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_live_parsing()
    exit(0 if success else 1)
