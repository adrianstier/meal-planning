#!/usr/bin/env python3
"""
End-to-end tests for Recipe Parser
Tests the complete flow from API to data formatting
"""

import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:5001"


def test_recipe_parser_api():
    """Test 1: Recipe Parser API Endpoint"""
    print("\n" + "=" * 60)
    print("TEST 1: Recipe Parser API Endpoint")
    print("=" * 60)

    test_recipes = [
        {
            "name": "Simple Pasta",
            "text": """
            Simple Pasta Recipe

            Ingredients:
            - 1 lb spaghetti
            - 2 cups marinara sauce
            - 1/2 cup parmesan cheese
            - 2 tbsp olive oil
            - 2 cloves garlic, minced

            Instructions:
            1. Boil water and cook pasta according to package directions
            2. Heat olive oil in a pan and sauté garlic
            3. Add marinara sauce and simmer
            4. Drain pasta and toss with sauce
            5. Top with parmesan cheese

            Prep time: 5 minutes
            Cook time: 20 minutes
            Serves: 4
            """
        },
        {
            "name": "Chicken Tacos",
            "text": """
            Chicken Tacos

            Ingredients:
            - 1 lb chicken breast, diced
            - 8 taco shells
            - 1 cup shredded cheese
            - 1 cup lettuce, shredded
            - 2 tomatoes, diced
            - 1/2 cup sour cream
            - Taco seasoning

            Instructions:
            1. Cook chicken with taco seasoning until done
            2. Warm taco shells in oven
            3. Assemble tacos with chicken, cheese, lettuce, and tomatoes
            4. Top with sour cream

            Prep: 10 min, Cook: 15 min
            """
        },
        {
            "name": "Minimal Recipe",
            "text": "Grilled Cheese. Ingredients: 2 slices bread, 2 slices cheese, 1 tbsp butter. Cook in pan until golden."
        }
    ]

    all_passed = True

    for test in test_recipes:
        print(f"\nTesting: {test['name']}")
        print("-" * 40)

        try:
            response = requests.post(
                f"{BASE_URL}/api/meals/parse",
                json={"recipe_text": test["text"]},
                timeout=30
            )

            if response.status_code != 200:
                print(f"  ✗ FAILED: Status code {response.status_code}")
                print(f"    Response: {response.text[:200]}")
                all_passed = False
                continue

            data = response.json()

            if not data.get("success"):
                print(f"  ✗ FAILED: success=false")
                print(f"    Error: {data.get('error', 'Unknown')}")
                all_passed = False
                continue

            parsed = data.get("data", {})

            # Check required fields
            required_fields = ["name", "meal_type", "cook_time_minutes", "prep_time_minutes"]
            missing_fields = [f for f in required_fields if f not in parsed]

            if missing_fields:
                print(f"  ✗ FAILED: Missing fields: {missing_fields}")
                all_passed = False
                continue

            # Check ingredients structure
            if "ingredients" not in parsed:
                print(f"  ✗ FAILED: No ingredients field")
                all_passed = False
                continue

            ingredients = parsed["ingredients"]
            if not isinstance(ingredients, list):
                print(f"  ✗ FAILED: Ingredients is not a list: {type(ingredients)}")
                all_passed = False
                continue

            if len(ingredients) == 0:
                print(f"  ⚠  WARNING: No ingredients parsed")

            # Validate ingredient structure
            for i, ing in enumerate(ingredients):
                if not isinstance(ing, dict):
                    print(f"  ✗ FAILED: Ingredient {i} is not a dict: {type(ing)}")
                    all_passed = False
                    continue

                if "name" not in ing:
                    print(f"  ✗ FAILED: Ingredient {i} missing 'name' field")
                    all_passed = False
                    continue

                required_ing_fields = ["component_type", "is_optional"]
                for field in required_ing_fields:
                    if field not in ing:
                        print(f"  ⚠  WARNING: Ingredient {i} missing '{field}' field")

            # Print summary
            print(f"  ✓ PASSED")
            print(f"    Name: {parsed['name']}")
            print(f"    Type: {parsed['meal_type']}")
            print(f"    Ingredients: {len(ingredients)}")
            print(f"    Cook time: {parsed['cook_time_minutes']} min")

            # Print first few ingredients
            if len(ingredients) > 0:
                print(f"    Sample ingredients:")
                for ing in ingredients[:3]:
                    qty = ing.get('quantity', '')
                    name = ing.get('name', '')
                    print(f"      - {qty} {name}".strip())

        except requests.exceptions.Timeout:
            print(f"  ✗ FAILED: Request timeout (>30s)")
            all_passed = False
        except Exception as e:
            print(f"  ✗ FAILED: {e}")
            all_passed = False

    return all_passed


def test_ingredient_formatting():
    """Test 2: Ingredient Formatting for React"""
    print("\n" + "=" * 60)
    print("TEST 2: Ingredient Formatting for React Form")
    print("=" * 60)

    # Test recipe
    recipe_text = """
    Test Recipe

    Ingredients:
    - 1 cup flour
    - 2 eggs
    - 1/2 cup milk
    - Pinch of salt

    Mix and cook.
    """

    try:
        response = requests.post(
            f"{BASE_URL}/api/meals/parse",
            json={"recipe_text": recipe_text},
            timeout=30
        )

        if response.status_code != 200:
            print(f"✗ FAILED: Status {response.status_code}")
            return False

        data = response.json()
        if not data.get("success"):
            print(f"✗ FAILED: {data.get('error')}")
            return False

        ingredients = data["data"]["ingredients"]

        # Format ingredients like React should
        formatted_lines = []
        for ing in ingredients:
            quantity = ing.get("quantity", "")
            name = ing.get("name", "")
            line = f"{quantity} {name}".strip() if quantity else name
            formatted_lines.append(line)

        formatted_text = "\n".join(formatted_lines)

        print(f"Parsed {len(ingredients)} ingredients:")
        print("\nFormatted output:")
        print("-" * 40)
        print(formatted_text)
        print("-" * 40)

        # Validate formatting
        if "[object Object]" in formatted_text:
            print("\n✗ FAILED: Contains '[object Object]'!")
            return False

        if len(formatted_lines) == 0:
            print("\n⚠  WARNING: No ingredients formatted")

        print("\n✓ PASSED: Ingredients properly formatted")
        return True

    except Exception as e:
        print(f"✗ FAILED: {e}")
        return False


def test_edge_cases():
    """Test 3: Edge Cases"""
    print("\n" + "=" * 60)
    print("TEST 3: Edge Cases")
    print("=" * 60)

    edge_cases = [
        {
            "name": "Empty recipe",
            "text": "",
            "should_fail": True
        },
        {
            "name": "Recipe with no ingredients",
            "text": "Cook something. Instructions: 1. Cook it. 2. Serve it.",
            "should_fail": False  # Should parse but with empty ingredients
        },
        {
            "name": "Recipe with special characters",
            "text": "Taco's & Burritos! Ingredients: 1/2 cup \"special\" sauce, 3-4 tortillas. Cook @ 350°F for 10 min.",
            "should_fail": False
        }
    ]

    all_passed = True

    for test in edge_cases:
        print(f"\nTesting: {test['name']}")
        print("-" * 40)

        try:
            response = requests.post(
                f"{BASE_URL}/api/meals/parse",
                json={"recipe_text": test["text"]},
                timeout=30
            )

            if test["should_fail"]:
                if response.status_code != 200:
                    print(f"  ✓ PASSED: Failed as expected (status {response.status_code})")
                else:
                    data = response.json()
                    if not data.get("success"):
                        print(f"  ✓ PASSED: Failed as expected")
                    else:
                        print(f"  ✗ FAILED: Should have failed but succeeded")
                        all_passed = False
            else:
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        print(f"  ✓ PASSED: Succeeded as expected")
                    else:
                        print(f"  ✗ FAILED: Returned success=false")
                        all_passed = False
                else:
                    print(f"  ✗ FAILED: Status {response.status_code}")
                    all_passed = False

        except Exception as e:
            if test["should_fail"]:
                print(f"  ✓ PASSED: Failed with exception as expected")
            else:
                print(f"  ✗ FAILED: {e}")
                all_passed = False

    return all_passed


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("🧪 RECIPE PARSER END-TO-END TESTS")
    print("=" * 60)

    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code != 200:
            print("\n❌ Server not responding properly")
            return
    except Exception as e:
        print(f"\n❌ Cannot connect to server at {BASE_URL}")
        print(f"   Make sure Flask is running: python app.py")
        print(f"   Error: {e}")
        return

    # Run tests
    results = {
        "API Endpoint": test_recipe_parser_api(),
        "Ingredient Formatting": test_ingredient_formatting(),
        "Edge Cases": test_edge_cases()
    }

    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)

    all_passed = all(results.values())

    for test_name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name}: {status}")

    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 60)


if __name__ == "__main__":
    main()
