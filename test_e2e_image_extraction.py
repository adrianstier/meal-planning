#!/usr/bin/env python3
"""
End-to-End Test for Image Extraction via API
Tests the complete flow: URL → Parse → Save → Display
"""

import requests
import json
import sys
import time
from datetime import datetime


BASE_URL = "http://localhost:5000"


def test_api_health():
    """Test API is running"""
    print("=" * 70)
    print("TEST 1: API Health Check")
    print("=" * 70)

    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ API is running")
            return True
        else:
            print(f"❌ API returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API")
        print("   Please start the server: python3 app.py")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_parse_recipe_with_image():
    """Test parsing a recipe URL and extracting image"""
    print("\n" + "=" * 70)
    print("TEST 2: Parse Recipe URL with Image Extraction")
    print("=" * 70)

    test_url = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"
    print(f"\n📋 Testing URL: {test_url}")
    print("-" * 70)

    try:
        # Call the parse endpoint
        print("⏳ Calling /api/meals/parse...")
        response = requests.post(
            f"{BASE_URL}/api/meals/parse",
            json={"recipe_text": test_url},
            headers={"Content-Type": "application/json"},
            timeout=60  # Long timeout for AI processing
        )

        if response.status_code != 200:
            print(f"❌ API returned status {response.status_code}")
            print(f"   Response: {response.text}")
            return False

        data = response.json()

        if not data.get('success'):
            print(f"❌ Parse failed: {data.get('error')}")
            return False

        meal_data = data['data']
        print(f"\n✅ Recipe parsed successfully!")
        print(f"   Name: {meal_data.get('name')}")
        print(f"   Meal Type: {meal_data.get('meal_type')}")
        print(f"   Cook Time: {meal_data.get('cook_time_minutes')} minutes")
        print(f"   Cuisine: {meal_data.get('cuisine')}")
        print(f"   Source: {data.get('source')}")

        if meal_data.get('image_url'):
            print(f"\n   📸 Image URL: {meal_data['image_url']}")
            print(f"   ✅ IMAGE EXTRACTED SUCCESSFULLY!")
            print(f"   🌐 Full URL: {BASE_URL}{meal_data['image_url']}")
            return True
        else:
            print(f"\n   ⚠️  No image extracted")
            return False

    except requests.exceptions.Timeout:
        print("❌ Request timed out (>60s)")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_create_meal_with_image():
    """Test creating a meal with the parsed image"""
    print("\n" + "=" * 70)
    print("TEST 3: Create Meal with Extracted Image")
    print("=" * 70)

    # First parse a recipe
    test_url = "https://www.simplyrecipes.com/recipes/homemade_pizza/"
    print(f"\n📋 Parsing: {test_url}")

    try:
        # Parse the recipe
        parse_response = requests.post(
            f"{BASE_URL}/api/meals/parse",
            json={"recipe_text": test_url},
            timeout=60
        )

        if parse_response.status_code != 200:
            print(f"❌ Parse failed: {parse_response.status_code}")
            return False

        parse_data = parse_response.json()['data']

        # Create the meal
        print("⏳ Creating meal in database...")
        meal_payload = {
            "name": parse_data.get('name'),
            "meal_type": parse_data.get('meal_type', 'dinner'),
            "cook_time_minutes": parse_data.get('cook_time_minutes'),
            "servings": parse_data.get('servings'),
            "ingredients": parse_data.get('ingredients'),
            "instructions": parse_data.get('instructions'),
            "cuisine": parse_data.get('cuisine'),
            "image_url": parse_data.get('image_url')  # Include image!
        }

        create_response = requests.post(
            f"{BASE_URL}/api/meals",
            json=meal_payload,
            timeout=10
        )

        if create_response.status_code != 200:
            print(f"❌ Create failed: {create_response.status_code}")
            print(f"   Response: {create_response.text}")
            return False

        created_meal = create_response.json()['data']

        print(f"\n✅ Meal created successfully!")
        print(f"   ID: {created_meal['id']}")
        print(f"   Name: {created_meal['name']}")

        if created_meal.get('image_url'):
            print(f"   📸 Image saved with meal!")
            print(f"   ✅ IMAGE PERSISTED IN DATABASE!")
            return True
        else:
            print(f"   ⚠️  No image in created meal")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_retrieve_meal_with_image():
    """Test retrieving a meal and verifying image is returned"""
    print("\n" + "=" * 70)
    print("TEST 4: Retrieve Meal and Verify Image")
    print("=" * 70)

    try:
        # Get all meals
        print("⏳ Fetching all meals...")
        response = requests.get(f"{BASE_URL}/api/meals", timeout=10)

        if response.status_code != 200:
            print(f"❌ Failed to fetch meals: {response.status_code}")
            return False

        meals = response.json()['data']

        # Find meals with images
        meals_with_images = [m for m in meals if m.get('image_url')]

        if not meals_with_images:
            print("⚠️  No meals with images found in database")
            return False

        print(f"\n✅ Found {len(meals_with_images)} meals with images")

        for i, meal in enumerate(meals_with_images[:3], 1):  # Show first 3
            print(f"\n   {i}. {meal['name']}")
            print(f"      Cuisine: {meal.get('cuisine', 'N/A')}")
            print(f"      📸 Image: {meal['image_url']}")

        print(f"\n   ✅ IMAGES SUCCESSFULLY RETRIEVED FROM DATABASE!")
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_image_file_exists():
    """Test that image files actually exist on disk"""
    print("\n" + "=" * 70)
    print("TEST 5: Verify Image Files Exist on Disk")
    print("=" * 70)

    import os
    import glob

    image_folder = "static/recipe_images"

    if not os.path.exists(image_folder):
        print(f"❌ Image folder doesn't exist: {image_folder}")
        return False

    image_files = glob.glob(f"{image_folder}/*.jpg")

    if not image_files:
        print(f"⚠️  No image files found in {image_folder}")
        return False

    print(f"\n✅ Found {len(image_files)} image files")

    for img_path in image_files[-5:]:  # Show last 5
        size_kb = os.path.getsize(img_path) / 1024
        filename = os.path.basename(img_path)
        print(f"   📸 {filename} ({size_kb:.1f} KB)")

    print(f"\n   ✅ IMAGE FILES EXIST ON DISK!")
    return True


def main():
    """Run all E2E tests"""
    print("\n🍽️  END-TO-END IMAGE EXTRACTION TEST SUITE")
    print("=" * 70)
    print("Testing complete image extraction workflow")
    print("=" * 70)

    results = []

    # Test 1: API Health
    print("\n")
    result1 = test_api_health()
    results.append(("API Health Check", result1))

    if not result1:
        print("\n❌ Cannot proceed - API is not running")
        print("   Start the server with: python3 app.py")
        sys.exit(1)

    # Test 2: Parse with image
    result2 = test_parse_recipe_with_image()
    results.append(("Parse Recipe with Image", result2))

    # Test 3: Create meal with image
    result3 = test_create_meal_with_image()
    results.append(("Create Meal with Image", result3))

    # Test 4: Retrieve meal with image
    result4 = test_retrieve_meal_with_image()
    results.append(("Retrieve Meal with Image", result4))

    # Test 5: Verify files exist
    result5 = test_image_file_exists()
    results.append(("Image Files on Disk", result5))

    # Summary
    print("\n\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")

    print("-" * 70)
    print(f"Total: {passed}/{total} tests passed")

    if passed == total:
        print("\n✅ ALL TESTS PASSED!")
        print("🎉 Image extraction is working end-to-end!")
        print("🚀 Ready to deploy!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        print("   Fix issues before deploying")
        sys.exit(1)


if __name__ == "__main__":
    main()
