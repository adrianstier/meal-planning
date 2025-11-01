#!/usr/bin/env python3
"""
Test the complete recipe parser flow locally
Simulates exactly what the React app does
"""

import requests
import json

def test_complete_flow():
    """Test the complete recipe parsing flow"""
    print("\n" + "="*60)
    print("🧪 TESTING COMPLETE RECIPE PARSER FLOW")
    print("="*60)

    # Sample recipe - realistic example
    test_recipe = """
    Chicken Stir Fry

    A quick and healthy dinner recipe perfect for weeknights.

    Ingredients:
    - 1 lb chicken breast, cut into strips
    - 2 cups broccoli florets
    - 1 red bell pepper, sliced
    - 1 cup snap peas
    - 3 cloves garlic, minced
    - 2 tbsp soy sauce
    - 1 tbsp sesame oil
    - 1 tsp ginger, grated
    - 2 cups cooked rice
    - 2 tbsp vegetable oil
    - Salt and pepper to taste

    Instructions:
    1. Heat vegetable oil in a large wok or skillet over high heat
    2. Add chicken and cook until golden brown, about 5-6 minutes
    3. Remove chicken and set aside
    4. Add garlic and ginger, cook for 30 seconds
    5. Add vegetables and stir fry for 3-4 minutes
    6. Return chicken to pan
    7. Add soy sauce and sesame oil
    8. Toss everything together and cook for 2 more minutes
    9. Serve over rice

    Prep time: 15 minutes
    Cook time: 15 minutes
    Serves: 4
    Difficulty: Easy
    """

    print("\n📝 Testing with recipe:")
    print("-" * 60)
    print(test_recipe[:200] + "...")
    print("-" * 60)

    # Step 1: Call the API
    print("\n🔹 STEP 1: Calling /api/meals/parse")
    print("-" * 60)

    try:
        response = requests.post(
            'http://localhost:5001/api/meals/parse',
            json={'recipe_text': test_recipe},
            timeout=30
        )

        print(f"Status Code: {response.status_code}")

        if response.status_code != 200:
            print(f"❌ FAILED: Got status {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False

    # Step 2: Parse the response
    print("\n🔹 STEP 2: Parsing API Response")
    print("-" * 60)

    try:
        api_response = response.json()
        print(f"Response structure: {json.dumps(api_response, indent=2)[:300]}...")

        if not api_response.get('success'):
            print(f"❌ FAILED: success=false")
            print(f"Error: {api_response.get('error')}")
            return False

        parsed_data = api_response.get('data', {})
        print(f"\n✓ Success! Parsed data has keys: {list(parsed_data.keys())}")

    except Exception as e:
        print(f"❌ FAILED to parse JSON: {e}")
        return False

    # Step 3: Simulate axios interceptor unwrapping
    print("\n🔹 STEP 3: Simulating Axios Interceptor")
    print("-" * 60)
    print("Axios interceptor unwraps: { success: true, data: {...} }")
    print("So result.data would be the parsed recipe object")
    print(f"Type of parsed_data: {type(parsed_data)}")
    print(f"Keys in parsed_data: {list(parsed_data.keys())}")

    # Step 4: Extract and format ingredients (like React does)
    print("\n🔹 STEP 4: Formatting Ingredients (React Logic)")
    print("-" * 60)

    ingredients_field = parsed_data.get('ingredients')
    print(f"ingredients field type: {type(ingredients_field)}")
    print(f"ingredients is array: {isinstance(ingredients_field, list)}")

    if ingredients_field:
        print(f"Number of ingredients: {len(ingredients_field) if isinstance(ingredients_field, list) else 'N/A'}")

        if isinstance(ingredients_field, list) and len(ingredients_field) > 0:
            print(f"\nFirst ingredient structure:")
            print(json.dumps(ingredients_field[0], indent=2))

    # Apply the exact React formatting logic
    ingredientsText = ''
    if ingredients_field and isinstance(ingredients_field, list):
        formatted_lines = []
        for ing in ingredients_field:
            quantity = ing.get('quantity', '')
            name = ing.get('name', '')
            line = f"{quantity} {name}".strip() if quantity else name
            formatted_lines.append(line)

        ingredientsText = '\n'.join([line for line in formatted_lines if line])
    elif isinstance(ingredients_field, str):
        ingredientsText = ingredients_field

    print("\n📋 Formatted Ingredients Text:")
    print("=" * 60)
    print(ingredientsText)
    print("=" * 60)

    # Check for the [object Object] bug
    if '[object Object]' in ingredientsText:
        print("\n❌ CRITICAL ERROR: Found '[object Object]' in formatted text!")
        return False

    if not ingredientsText:
        print("\n⚠️  WARNING: No ingredients formatted")
    else:
        print(f"\n✓ Successfully formatted {len(ingredientsText.split(chr(10)))} ingredient lines")

    # Step 5: Extract other fields
    print("\n🔹 STEP 5: Extracting Other Fields")
    print("-" * 60)

    fields_to_check = [
        ('name', 'Recipe Name'),
        ('meal_type', 'Meal Type'),
        ('cook_time_minutes', 'Cook Time'),
        ('prep_time_minutes', 'Prep Time'),
        ('servings', 'Servings'),
        ('difficulty', 'Difficulty'),
    ]

    all_fields_ok = True
    for field, label in fields_to_check:
        value = parsed_data.get(field)
        status = "✓" if value else "✗"
        print(f"{status} {label}: {value}")
        if not value and field in ['name', 'meal_type']:
            all_fields_ok = False

    # Step 6: Test instructions formatting
    print("\n🔹 STEP 6: Formatting Instructions")
    print("-" * 60)

    instructions_field = parsed_data.get('instructions')
    print(f"instructions field type: {type(instructions_field)}")

    instructionsText = ''
    if instructions_field:
        if isinstance(instructions_field, list):
            instructionsText = '\n'.join(instructions_field)
            print(f"✓ Formatted {len(instructions_field)} instruction steps")
        elif isinstance(instructions_field, str):
            instructionsText = instructions_field
            print(f"✓ Instructions is string ({len(instructionsText)} chars)")
    else:
        print("⚠️  No instructions field in response")

    # Step 7: Final validation
    print("\n🔹 STEP 7: Final Validation")
    print("=" * 60)

    validation_results = {
        "API Response": response.status_code == 200,
        "Success Flag": api_response.get('success') == True,
        "Has Data": 'data' in api_response,
        "Has Name": bool(parsed_data.get('name')),
        "Has Ingredients": bool(ingredients_field),
        "Ingredients Formatted": bool(ingredientsText),
        "No [object Object]": '[object Object]' not in ingredientsText,
        "Required Fields": all_fields_ok
    }

    print("\nValidation Results:")
    for check, passed in validation_results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {check}")

    all_passed = all(validation_results.values())

    if all_passed:
        print("\n" + "=" * 60)
        print("✅ ALL CHECKS PASSED!")
        print("=" * 60)
        print("\nThe recipe parser flow is working correctly.")
        print("React should properly display formatted ingredients.")
    else:
        print("\n" + "=" * 60)
        print("❌ SOME CHECKS FAILED")
        print("=" * 60)
        failed_checks = [k for k, v in validation_results.items() if not v]
        print(f"Failed checks: {', '.join(failed_checks)}")

    # Step 8: Show what React would display
    print("\n🔹 STEP 8: What React Would Display")
    print("=" * 60)
    print("\n📝 Form would be pre-filled with:")
    print(f"\nName: {parsed_data.get('name', '')}")
    print(f"Meal Type: {parsed_data.get('meal_type', 'dinner')}")
    print(f"Cook Time: {parsed_data.get('cook_time_minutes', '')} minutes")
    print(f"Prep Time: {parsed_data.get('prep_time_minutes', '')} minutes")
    print(f"Servings: {parsed_data.get('servings', '')}")
    print(f"Difficulty: {parsed_data.get('difficulty', 'medium')}")
    print(f"\nIngredients (textarea):")
    print("-" * 40)
    print(ingredientsText[:300] if ingredientsText else "(empty)")
    if len(ingredientsText) > 300:
        print(f"... ({len(ingredientsText)} total chars)")
    print("-" * 40)

    return all_passed


if __name__ == "__main__":
    success = test_complete_flow()
    exit(0 if success else 1)
