#!/usr/bin/env python3
"""
Test Recipe Instructions Feature
Tests AI parser, API endpoints, and database storage of instructions
"""

import json
import sys
from app import app
from meal_planner import MealPlannerDB


def test_ai_parser_includes_instructions():
    """Test that AI parser validation includes instructions field"""
    print("="*60)
    print("Test 1: AI Parser Instructions Support")
    print("="*60)

    from ai_recipe_parser import RecipeParser

    # Create a mock parser to test validation
    class MockParser:
        def _validate_and_clean(self, data):
            parser = RecipeParser.__new__(RecipeParser)
            return parser._validate_and_clean(data)

    parser = MockParser()

    # Test with instructions provided
    print("\n✓ Testing with instructions provided...")
    data = {
        'name': 'Test Meal',
        'meal_type': 'dinner',
        'kid_friendly_level': 8,
        'prep_time_minutes': 10,
        'cook_time_minutes': 20,
        'instructions': '1. Heat pan\n2. Cook food\n3. Serve'
    }
    result = parser._validate_and_clean(data)
    assert 'instructions' in result, "Instructions field missing!"
    assert result['instructions'] == '1. Heat pan\n2. Cook food\n3. Serve'
    print(f"   ✓ Instructions preserved: {result['instructions'][:30]}...")

    # Test without instructions (should still work)
    print("\n✓ Testing without instructions (optional field)...")
    data = {
        'name': 'Test Meal 2',
        'meal_type': 'lunch',
        'kid_friendly_level': 7,
        'prep_time_minutes': 5,
        'cook_time_minutes': 10
    }
    result = parser._validate_and_clean(data)
    # Instructions should be optional - no error should occur
    print(f"   ✓ Validation passes without instructions")

    print("\n" + "="*60)
    print("✅ AI Parser Instructions Test Passed")
    print("="*60)


def test_api_meal_creation_with_instructions():
    """Test creating a meal with instructions via API"""
    print("\n" + "="*60)
    print("Test 2: Create Meal with Instructions via API")
    print("="*60)

    app.config['TESTING'] = True
    client = app.test_client()

    # Create a meal with instructions
    print("\n✓ Creating meal with instructions...")
    meal_data = {
        'name': 'Test Instructions Meal',
        'meal_type': 'dinner',
        'cook_time_minutes': 25,
        'servings': 4,
        'difficulty': 'medium',
        'tags': 'test,instructions',
        'instructions': '1. Preheat oven to 350°F\n2. Mix ingredients\n3. Bake for 25 minutes\n4. Let cool and serve',
        'ingredients': '1 lb Test Ingredient\n2 cups vegetables\n1 tbsp olive oil'
    }

    response = client.post(
        '/api/meals',
        data=json.dumps(meal_data),
        content_type='application/json'
    )

    result = response.get_json()
    assert response.status_code in [200, 201], f"API returned {response.status_code}"
    assert result['success'], f"API failed: {result.get('error', 'Unknown error')}"
    meal_id = result['data']['id']
    print(f"   ✓ Meal created with ID: {meal_id}")

    # Retrieve the meal to verify instructions were saved
    print("\n✓ Retrieving meal to verify instructions...")
    response = client.get(f'/api/meals')
    result = response.get_json()
    assert result['success'], "Failed to retrieve meals"

    # Find our test meal
    test_meal = None
    for meal in result['data']:
        if meal['id'] == meal_id:
            test_meal = meal
            break

    assert test_meal is not None, "Newly created meal not found!"
    assert 'instructions' in test_meal, "Instructions field missing from response!"
    assert test_meal['instructions'] == meal_data['instructions'], "Instructions don't match!"
    print(f"   ✓ Instructions verified: {test_meal['instructions'][:50]}...")

    print("\n" + "="*60)
    print("✅ API Meal Creation with Instructions Test Passed")
    print("="*60)

    return meal_id


def test_weekly_plan_includes_instructions():
    """Test that weekly plan endpoint includes instructions"""
    print("\n" + "="*60)
    print("Test 3: Weekly Plan Includes Instructions")
    print("="*60)

    import sqlite3

    app.config['TESTING'] = True
    client = app.test_client()

    # First create a meal with instructions via API
    print("\n✓ Creating test meal with instructions...")
    meal_data = {
        'name': 'Plan Test Meal',
        'meal_type': 'dinner',
        'cook_time_minutes': 30,
        'servings': 4,
        'difficulty': 'medium',
        'tags': 'test',
        'ingredients': '2 cups vegetables\n1 lb protein',
        'instructions': '1. Chop vegetables\n2. Sauté in pan\n3. Add protein\n4. Season and serve'
    }

    response = client.post(
        '/api/meals',
        data=json.dumps(meal_data),
        content_type='application/json'
    )

    result = response.get_json()
    assert result['success'], f"Failed to create meal: {result.get('error')}"
    meal_id = result['data']['id']
    print(f"   ✓ Test meal created (ID: {meal_id})")

    # Schedule this meal via database
    print("\n✓ Scheduling meal for 2025-11-05...")
    conn = sqlite3.connect('meal_planner.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO scheduled_meals (meal_plan_id, meal_id, day_of_week, meal_date, meal_type_id)
        VALUES (1, ?, 'Tuesday', '2025-11-05', 1)
    """, (meal_id,))
    conn.commit()
    conn.close()
    print("   ✓ Meal scheduled")

    # Fetch weekly plan
    print("\n✓ Fetching weekly plan...")
    response = client.get('/api/plan/week?start_date=2025-11-03&end_date=2025-11-09')
    result = response.get_json()

    assert response.status_code == 200, f"API returned {response.status_code}"
    assert result['success'], f"API failed: {result.get('error', 'Unknown error')}"

    # Find our scheduled meal
    found_meal = None
    for meal_plan in result['data']:
        if meal_plan['meal_id'] == meal_id:
            found_meal = meal_plan
            break

    assert found_meal is not None, "Scheduled meal not found in weekly plan!"
    print(f"   ✓ Found scheduled meal: {found_meal['meal_name']}")

    # Verify instructions are included
    assert 'instructions' in found_meal, "Instructions field missing from meal plan response!"
    assert found_meal['instructions'] == meal_data['instructions'], "Instructions don't match!"
    print(f"   ✓ Instructions included: {found_meal['instructions'][:50]}...")

    # Verify other fields are included too
    assert 'ingredients' in found_meal, "Ingredients field missing!"
    assert 'cook_time_minutes' in found_meal, "cook_time_minutes field missing!"
    assert 'servings' in found_meal, "servings field missing!"
    print("   ✓ All expected fields present (ingredients, cook_time, servings, etc.)")

    print("\n" + "="*60)
    print("✅ Weekly Plan Instructions Test Passed")
    print("="*60)


def test_instructions_formatting():
    """Test that instructions with various formats are handled correctly"""
    print("\n" + "="*60)
    print("Test 4: Instructions Formatting")
    print("="*60)

    app.config['TESTING'] = True
    client = app.test_client()

    test_cases = [
        {
            'name': 'Numbered Instructions',
            'instructions': '1. Step one\n2. Step two\n3. Step three'
        },
        {
            'name': 'Bulleted Instructions',
            'instructions': '• First step\n• Second step\n• Third step'
        },
        {
            'name': 'Plain Text Instructions',
            'instructions': 'Mix everything together. Cook until done. Serve hot.'
        },
        {
            'name': 'Multi-paragraph Instructions',
            'instructions': 'Preparation:\nChop all vegetables into bite-sized pieces.\n\nCooking:\nHeat oil in a large pan. Add vegetables and cook for 10 minutes.\n\nServing:\nGarnish with fresh herbs and serve immediately.'
        }
    ]

    for test_case in test_cases:
        print(f"\n✓ Testing format: {test_case['name']}")

        meal_data = {
            'name': f"Format Test - {test_case['name']}",
            'meal_type': 'dinner',
            'cook_time_minutes': 15,
            'servings': 4,
            'difficulty': 'easy',
            'tags': 'test',
            'ingredients': '1 cup test ingredient',
            'instructions': test_case['instructions']
        }

        response = client.post(
            '/api/meals',
            data=json.dumps(meal_data),
            content_type='application/json'
        )

        result = response.get_json()
        assert result['success'], f"Failed to create meal: {result.get('error')}"

        meal_id = result['data']['id']

        # Retrieve and verify
        response = client.get('/api/meals')
        result = response.get_json()

        test_meal = next((m for m in result['data'] if m['id'] == meal_id), None)
        assert test_meal is not None, "Created meal not found"
        assert test_meal['instructions'] == test_case['instructions'], "Instructions corrupted!"

        print(f"   ✓ Format preserved correctly")
        print(f"   Preview: {test_meal['instructions'][:60]}...")

    print("\n" + "="*60)
    print("✅ Instructions Formatting Test Passed")
    print("="*60)


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🧪 RECIPE INSTRUCTIONS FEATURE TEST SUITE")
    print("="*60)

    tests_passed = 0
    tests_failed = 0

    # Test 1: AI Parser
    try:
        test_ai_parser_includes_instructions()
        tests_passed += 1
    except Exception as e:
        print(f"\n❌ Test 1 FAILED: {e}")
        tests_failed += 1

    # Test 2: API Creation
    try:
        test_api_meal_creation_with_instructions()
        tests_passed += 1
    except Exception as e:
        print(f"\n❌ Test 2 FAILED: {e}")
        tests_failed += 1

    # Test 3: Weekly Plan
    try:
        test_weekly_plan_includes_instructions()
        tests_passed += 1
    except Exception as e:
        print(f"\n❌ Test 3 FAILED: {e}")
        tests_failed += 1

    # Test 4: Formatting
    try:
        test_instructions_formatting()
        tests_passed += 1
    except Exception as e:
        print(f"\n❌ Test 4 FAILED: {e}")
        tests_failed += 1

    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"✅ Passed: {tests_passed}/4")
    print(f"❌ Failed: {tests_failed}/4")
    print("="*60)

    if tests_failed == 0:
        print("\n🎉 All tests passed! Recipe instructions feature working correctly!")
        print("\n✓ Features verified:")
        print("  • AI parser extracts and validates instructions")
        print("  • API accepts and stores instructions")
        print("  • Weekly plan endpoint includes instructions")
        print("  • Multiple instruction formats preserved correctly")
        return 0
    else:
        print(f"\n⚠️  {tests_failed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
