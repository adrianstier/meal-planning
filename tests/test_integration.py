#!/usr/bin/env python3
"""
Integration test - simulates a complete user workflow
"""

import json
from app import app
from meal_planner import MealPlannerDB

def test_complete_workflow():
    """Test a complete user workflow"""
    print("="*60)
    print("Integration Test - Complete User Workflow")
    print("="*60)

    app.config['TESTING'] = True
    client = app.test_client()
    db = MealPlannerDB()

    # Scenario: User wants to plan a week of meals
    print("\n📅 Scenario: Planning a week of family meals")
    print("-"*60)

    # Step 1: Check what meals are available
    print("\n1️⃣  Browsing available dinners...")
    response = client.get('/api/meals?type=dinner')
    result = response.get_json()
    assert result['success'], "Failed to get dinners"
    print(f"   ✓ Found {len(result['data'])} dinner options")

    # Step 2: Search for kid-friendly options
    print("\n2️⃣  Looking for kid-friendly meals...")
    response = client.get('/api/meals/kid-friendly?min_level=8')
    result = response.get_json()
    assert result['success'], "Failed to get kid-friendly meals"
    print(f"   ✓ Found {len(result['data'])} kid-friendly meals")

    # Step 3: Generate a randomized meal plan
    print("\n3️⃣  Generating a 7-day meal plan...")
    print("   Preferences: Quick meals, kid-friendly 7+, all foods")
    response = client.post('/api/meals/randomize',
        data=json.dumps({
            'dietary_preference': 'all',
            'time_constraint': 'quick',
            'kid_friendly_min': 7,
            'days': 7,
            'start_date': '2025-11-04'
        }),
        content_type='application/json')
    result = response.get_json()
    assert result['success'], f"Failed to randomize: {result.get('error')}"
    schedule = result['data']
    print(f"   ✓ Generated plan for {len(schedule)} days")

    # Show the plan
    print("\n   📋 This week's dinner plan:")
    for day in schedule[:3]:  # Show first 3
        meal = day['meal']
        total_time = meal['prep_time_minutes'] + meal['cook_time_minutes']
        print(f"   • {day['day']}: {meal['name']}")
        print(f"     ⏱️  {total_time} min | ⭐ {meal['kid_friendly_level']}/10")
    print(f"   ... and {len(schedule) - 3} more days")

    # Step 4: Find a new recipe online (simulate)
    print("\n4️⃣  Adding a new recipe to the database...")
    new_meal = {
        'name': 'Chicken Fajitas',
        'meal_type': 'dinner',
        'kid_friendly_level': 8,
        'prep_time_minutes': 15,
        'cook_time_minutes': 20,
        'adult_friendly': True,
        'notes': 'Let kids build their own',
        'ingredients': [
            {'name': 'Chicken breast', 'component_type': 'protein', 'quantity': '2 lbs'},
            {'name': 'Bell peppers', 'component_type': 'veggie', 'quantity': '3'},
            {'name': 'Tortillas', 'component_type': 'starch', 'quantity': '12'},
            {'name': 'Lime', 'component_type': 'condiment', 'quantity': '2'}
        ]
    }
    response = client.post('/api/meals',
        data=json.dumps(new_meal),
        content_type='application/json')
    result = response.get_json()
    assert result['success'], "Failed to add meal"
    meal_id = result['data']['meal_id']
    print(f"   ✓ Added 'Chicken Fajitas' (ID: {meal_id})")

    # Step 5: Search for the new meal
    print("\n5️⃣  Searching for the newly added meal...")
    response = client.get('/api/meals/search?q=fajitas')
    result = response.get_json()
    assert result['success'], "Failed to search"
    print(f"   ✓ Found {len(result['data'])} result(s)")
    assert len(result['data']) > 0, "Newly added meal not found!"

    # Step 6: Try different dietary filters
    print("\n6️⃣  Trying vegetarian meal plan...")
    response = client.post('/api/meals/randomize',
        data=json.dumps({
            'dietary_preference': 'vegetarian',
            'time_constraint': 'all',
            'kid_friendly_min': 6,
            'days': 5,
            'start_date': '2025-11-11'
        }),
        content_type='application/json')
    result = response.get_json()
    assert result['success'], f"Failed to generate vegetarian plan: {result.get('error')}"
    print(f"   ✓ Generated {len(result['data'])} vegetarian meals")

    # Show veggie meals
    print("\n   🥗 Vegetarian options:")
    for day in result['data'][:3]:
        meal = day['meal']
        print(f"   • {meal['name']}")

    # Step 7: Generate shopping list for existing plan
    print("\n7️⃣  Generating shopping list...")
    response = client.get('/api/shopping-list?plan_id=1')
    result = response.get_json()
    assert result['success'], "Failed to generate shopping list"
    shopping = result['data']
    print(f"   ✓ Shopping list has {len(shopping)} categories")

    # Show sample items
    print("\n   🛒 Sample shopping items:")
    for category in list(shopping.keys())[:3]:
        items = shopping[category][:2]  # First 2 items
        print(f"   {category}:")
        for item in items:
            print(f"     • {item['name']}")

    # Step 8: Check database stats
    print("\n8️⃣  Checking final database statistics...")
    stats = db.get_stats()
    print(f"   ✓ Total meals: {stats['total_meals']}")
    print(f"   ✓ Total ingredients: {stats['total_ingredients']}")
    print(f"   ✓ Meal plans: {stats['total_meal_plans']}")

    db.close()

    print("\n" + "="*60)
    print("✅ Integration test completed successfully!")
    print("="*60)
    print("\n📊 Summary:")
    print("   • Browsed available meals ✓")
    print("   • Filtered by kid-friendly level ✓")
    print("   • Generated randomized meal plans ✓")
    print("   • Added new recipe ✓")
    print("   • Searched recipes ✓")
    print("   • Tested dietary filters ✓")
    print("   • Generated shopping list ✓")
    print("   • All features working! ✓")
    print()

if __name__ == "__main__":
    test_complete_workflow()
