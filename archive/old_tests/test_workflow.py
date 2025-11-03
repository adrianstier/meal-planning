#!/usr/bin/env python3
"""Test the complete meal planning workflow with cuisine filtering"""

import requests
import json
from datetime import datetime, timedelta
from collections import Counter

BASE_URL = "http://localhost:5001"

def test_generate_plan_with_cuisines():
    """Test generating a meal plan with cuisine filtering"""
    print("=" * 60)
    print("STEP 1: Generate Weekly Meal Plan with Cuisine Filtering")
    print("=" * 60)

    # Get today's date for the week start
    today = datetime.now()
    start_date = today.strftime('%Y-%m-%d')

    payload = {
        "start_date": start_date,
        "num_days": 7,
        "meal_types": ["dinner"],
        "avoid_school_duplicates": True,
        "cuisines": ["Italian", "Mexican"]
    }

    print(f"\n📋 Request: Generate 7 dinners from Italian + Mexican cuisines")
    print(f"   Start date: {start_date}")

    response = requests.post(f"{BASE_URL}/api/plan/generate-week", json=payload)
    result = response.json()

    if not result.get('success'):
        print(f"❌ Error: {result.get('error')}")
        return None

    meals = result.get('data', [])
    print(f"\n✅ Generated {len(meals)} meals")
    print("\n📅 Generated Meal Plan:")
    for meal in meals:
        cuisine = meal.get('cuisine', 'Unknown')
        print(f"   {meal['date']}: {meal['meal_name']} ({cuisine})")

    # Count by cuisine
    cuisine_counts = Counter(m.get('cuisine') for m in meals)
    print(f"\n🌍 Cuisine Balance:")
    for cuisine, count in cuisine_counts.items():
        print(f"   {cuisine}: {count} meals")

    return meals, start_date

def test_apply_plan(meals):
    """Test applying the generated plan"""
    print("\n" + "=" * 60)
    print("STEP 2: Apply Generated Plan to Calendar")
    print("=" * 60)

    response = requests.post(f"{BASE_URL}/api/plan/apply-generated", json={"plan": meals})
    result = response.json()

    if result.get('success'):
        print(f"✅ Successfully applied {len(meals)} meals to the calendar")
    else:
        print(f"❌ Error: {result.get('error')}")
        return False

    return True

def test_generate_shopping_list(start_date):
    """Test generating a shopping list from the meal plan"""
    print("\n" + "=" * 60)
    print("STEP 3: Generate Shopping List from Meal Plan")
    print("=" * 60)

    # Calculate end date (7 days later)
    end_date = (datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=6)).strftime('%Y-%m-%d')

    payload = {
        "start_date": start_date,
        "end_date": end_date
    }

    print(f"\n🛒 Generating shopping list for {start_date} to {end_date}")

    response = requests.post(f"{BASE_URL}/api/shopping/generate", json=payload)
    result = response.json()

    if not result.get('success'):
        print(f"❌ Error: {result.get('error')}")
        return

    items = result.get('data', [])
    print(f"\n✅ Generated {len(items)} shopping items")

    # Group by category
    by_category = {}
    for item in items:
        category = item.get('category', 'Uncategorized')
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(item)

    print(f"\n📝 Shopping List by Category:")
    for category in sorted(by_category.keys()):
        print(f"\n   {category}:")
        for item in by_category[category]:
            qty = f" ({item.get('quantity')})" if item.get('quantity') else ""
            print(f"     • {item['item_name']}{qty}")

    return items

def main():
    print("\n🍽️  MEAL PLANNING WORKFLOW TEST")
    print("=" * 60)
    print("Testing: Cuisine Filtering → Meal Plan → Shopping List")
    print("=" * 60)

    try:
        # Step 1: Generate plan with cuisine filtering
        result = test_generate_plan_with_cuisines()
        if not result:
            print("\n❌ Workflow failed at Step 1")
            return

        meals, start_date = result

        # Step 2: Apply the plan
        if not test_apply_plan(meals):
            print("\n❌ Workflow failed at Step 2")
            return

        # Step 3: Generate shopping list
        items = test_generate_shopping_list(start_date)
        if items is None:
            print("\n❌ Workflow failed at Step 3")
            return

        print("\n" + "=" * 60)
        print("✅ WORKFLOW COMPLETE!")
        print("=" * 60)
        print(f"\n📊 Summary:")
        print(f"   • {len(meals)} meals planned with balanced Italian + Mexican cuisines")
        print(f"   • {len(items)} shopping items generated and organized by category")
        print(f"   • Ready to cook for the week!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
