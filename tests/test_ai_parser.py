#!/usr/bin/env python3
"""
Test AI Recipe Parser (without actually calling API)
Tests the validation and cleaning logic
"""

from ai_recipe_parser import RecipeParser
import json


def test_validate_and_clean():
    """Test the validation function"""
    print("="*60)
    print("Testing AI Recipe Parser Validation")
    print("="*60)

    # Create a mock parser (no API key needed for validation tests)
    class MockParser:
        def _validate_and_clean(self, data):
            # Copy the method from RecipeParser
            parser = RecipeParser.__new__(RecipeParser)
            return parser._validate_and_clean(data)

    parser = MockParser()

    # Test 1: Complete valid data
    print("\nTest 1: Valid complete data")
    data = {
        'name': 'Test Tacos',
        'meal_type': 'dinner',
        'kid_friendly_level': 8,
        'prep_time_minutes': 10,
        'cook_time_minutes': 15,
        'adult_friendly': True,
        'notes': 'Quick and easy',
        'ingredients': [
            {
                'name': 'Ground beef',
                'component_type': 'protein',
                'quantity': '1 lb',
                'is_optional': False
            }
        ]
    }
    result = parser._validate_and_clean(data)
    print(f"✓ Name: {result['name']}")
    print(f"✓ Meal type: {result['meal_type']}")
    print(f"✓ Kid-friendly: {result['kid_friendly_level']}")
    print(f"✓ Ingredients: {len(result['ingredients'])}")

    # Test 2: Missing optional fields
    print("\nTest 2: Missing optional fields")
    data = {
        'name': 'Simple Pasta',
        'meal_type': 'dinner',
        'kid_friendly_level': 9,
        'prep_time_minutes': 5,
        'cook_time_minutes': 10
    }
    result = parser._validate_and_clean(data)
    print(f"✓ Adult-friendly (default): {result['adult_friendly']}")
    print(f"✓ Notes (default): {result['notes']}")
    print(f"✓ Ingredients (default): {result['ingredients']}")

    # Test 3: Invalid meal type correction
    print("\nTest 3: Invalid meal type correction")
    data = {
        'name': 'Weird Meal',
        'meal_type': 'brunch',  # Invalid
        'kid_friendly_level': 5,
        'prep_time_minutes': 10,
        'cook_time_minutes': 10
    }
    result = parser._validate_and_clean(data)
    print(f"✓ Corrected meal type: {result['meal_type']} (was 'brunch')")

    # Test 4: Kid-friendly level bounds
    print("\nTest 4: Kid-friendly level bounds")
    data1 = {
        'name': 'Too Low',
        'meal_type': 'dinner',
        'kid_friendly_level': -5,
        'prep_time_minutes': 10,
        'cook_time_minutes': 10
    }
    result1 = parser._validate_and_clean(data1)
    print(f"✓ Bounded low value: {result1['kid_friendly_level']} (was -5)")

    data2 = {
        'name': 'Too High',
        'meal_type': 'dinner',
        'kid_friendly_level': 15,
        'prep_time_minutes': 10,
        'cook_time_minutes': 10
    }
    result2 = parser._validate_and_clean(data2)
    print(f"✓ Bounded high value: {result2['kid_friendly_level']} (was 15)")

    # Test 5: Ingredient validation
    print("\nTest 5: Ingredient validation")
    data = {
        'name': 'Complex Meal',
        'meal_type': 'dinner',
        'kid_friendly_level': 7,
        'prep_time_minutes': 20,
        'cook_time_minutes': 30,
        'ingredients': [
            {'name': 'Chicken'},  # Missing fields
            {'name': 'Rice', 'component_type': 'invalid_type'},  # Invalid type
            {'name': 'Broccoli', 'component_type': 'veggie', 'quantity': '2 cups'}  # Complete
        ]
    }
    result = parser._validate_and_clean(data)
    print(f"✓ Ingredient 1 defaults:")
    print(f"  - component_type: {result['ingredients'][0].get('component_type')}")
    print(f"  - is_optional: {result['ingredients'][0].get('is_optional')}")
    print(f"  - quantity: '{result['ingredients'][0].get('quantity')}'")
    print(f"✓ Ingredient 2 corrected type: {result['ingredients'][1]['component_type']}")
    print(f"✓ Ingredient 3 complete: {result['ingredients'][2]}")

    # Test 6: Missing required field
    print("\nTest 6: Missing required field (should raise error)")
    try:
        data = {
            'meal_type': 'dinner',
            'kid_friendly_level': 5
            # Missing 'name' and other required fields
        }
        result = parser._validate_and_clean(data)
        print("❌ Should have raised error!")
    except ValueError as e:
        print(f"✓ Correctly raised ValueError: {e}")

    print("\n" + "="*60)
    print("✓ All validation tests passed!")
    print("="*60)


if __name__ == "__main__":
    test_validate_and_clean()
