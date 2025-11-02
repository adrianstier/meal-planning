#!/usr/bin/env python3
"""
Test script for image extraction from recipe URLs
Tests both recipe-scrapers and AI parser with image extraction
"""

import os
import sys
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Test URLs with good images
TEST_URLS = [
    "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/",
    "https://www.simplyrecipes.com/recipes/homemade_pizza/",
    "https://www.bonappetit.com/recipe/bas-best-chocolate-chip-cookies",
]


def test_recipe_scraper():
    """Test recipe-scrapers library (primary method)"""
    print("=" * 70)
    print("TEST 1: Recipe-Scrapers Library (Primary Method)")
    print("=" * 70)

    from recipe_url_scraper import RecipeURLScraper

    scraper = RecipeURLScraper()

    for url in TEST_URLS[:2]:  # Test first 2
        print(f"\n📋 Testing URL: {url}")
        print("-" * 70)

        try:
            result = scraper.scrape_recipe(url)

            print(f"✅ Recipe: {result['name']}")
            print(f"   Cook Time: {result.get('cook_time_minutes', 'N/A')} minutes")
            print(f"   Servings: {result.get('servings', 'N/A')}")
            print(f"   Cuisine: {result.get('cuisine', 'N/A')}")

            if result.get('image_url'):
                print(f"   📸 Image: {result['image_url']}")
                print(f"   ✅ IMAGE EXTRACTED AND SAVED!")
            else:
                print(f"   ⚠️  No image extracted")

        except Exception as e:
            print(f"❌ Error: {e}")


def test_ai_parser():
    """Test AI parser with image extraction (fallback method)"""
    print("\n\n" + "=" * 70)
    print("TEST 2: AI Parser with Image Extraction (Fallback Method)")
    print("=" * 70)

    from ai_recipe_parser import RecipeParser

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("⚠️  Skipping AI parser test - no API key found")
        return

    parser = RecipeParser(api_key)

    # Test with a URL
    test_url = TEST_URLS[0]
    print(f"\n📋 Testing URL: {test_url}")
    print("-" * 70)

    try:
        result = parser.parse_recipe(test_url)

        print(f"✅ Recipe: {result['name']}")
        print(f"   Meal Type: {result.get('meal_type', 'N/A')}")
        print(f"   Cook Time: {result.get('cook_time_minutes', 'N/A')} minutes")
        print(f"   Kid Friendly: {result.get('kid_friendly_level', 'N/A')}/10")
        print(f"   Cuisine: {result.get('cuisine', 'N/A')}")

        if result.get('image_url'):
            print(f"   📸 Image: {result['image_url']}")
            print(f"   ✅ IMAGE EXTRACTED BY AI PARSER!")
        else:
            print(f"   ⚠️  No image extracted")

    except Exception as e:
        print(f"❌ Error: {e}")


def test_image_methods():
    """Test different image extraction methods"""
    print("\n\n" + "=" * 70)
    print("TEST 3: Image Extraction Methods Comparison")
    print("=" * 70)

    from ai_recipe_parser import RecipeParser

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("⚠️  Skipping - no API key found")
        return

    parser = RecipeParser(api_key)

    test_url = "https://www.simplyrecipes.com/recipes/homemade_pizza/"
    print(f"\n📋 Testing: {test_url}")
    print("-" * 70)

    print("\n🔍 Method 1: og:image meta tag")
    print("🔍 Method 2: schema.org JSON-LD")
    print("🔍 Method 3: First large image in recipe content")

    try:
        image_path = parser._extract_image_from_url(test_url)

        if image_path:
            print(f"\n✅ SUCCESS! Image extracted and saved")
            print(f"   📸 Path: {image_path}")
            print(f"   🌐 Will be accessible at: http://localhost:5001{image_path}")
        else:
            print(f"\n⚠️  No image found using any method")

    except Exception as e:
        print(f"\n❌ Error: {e}")


def main():
    """Run all tests"""
    print("\n🍽️  RECIPE IMAGE EXTRACTION TEST SUITE")
    print("=" * 70)
    print("Testing image extraction from recipe URLs")
    print("Images will be saved to: static/recipe_images/")
    print("=" * 70)

    # Test 1: Recipe scrapers (primary)
    try:
        test_recipe_scraper()
    except Exception as e:
        print(f"\n❌ Recipe scraper test failed: {e}")

    # Test 2: AI parser (fallback)
    try:
        test_ai_parser()
    except Exception as e:
        print(f"\n❌ AI parser test failed: {e}")

    # Test 3: Image methods
    try:
        test_image_methods()
    except Exception as e:
        print(f"\n❌ Image methods test failed: {e}")

    print("\n\n" + "=" * 70)
    print("✅ TESTING COMPLETE")
    print("=" * 70)
    print("\n📁 Check static/recipe_images/ folder for downloaded images")
    print("🌐 Start the server and visit the recipes page to see images")


if __name__ == "__main__":
    main()
