#!/usr/bin/env python3
"""
Comprehensive Test Suite for Recipe Image Feature
Tests the entire pipeline from URL parsing to display
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://web-production-09493.up.railway.app"
TEST_RECIPE_URL = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}")
    print(f"{text}")
    print(f"{'='*70}{Colors.RESET}\n")

def print_test(name: str):
    print(f"{Colors.BOLD}Test: {name}{Colors.RESET}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✅ PASS:{Colors.RESET} {message}")

def print_fail(message: str, details: str = ""):
    print(f"{Colors.RED}❌ FAIL:{Colors.RESET} {message}")
    if details:
        print(f"  {Colors.YELLOW}Details:{Colors.RESET} {details}")

def print_warn(message: str):
    print(f"{Colors.YELLOW}⚠️  WARN:{Colors.RESET} {message}")

def print_info(message: str):
    print(f"  ℹ️  {message}")

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.errors = []
    
    def add_pass(self):
        self.passed += 1
    
    def add_fail(self, error: str):
        self.failed += 1
        self.errors.append(error)
    
    def add_warn(self):
        self.warnings += 1
    
    def summary(self):
        total = self.passed + self.failed
        print_header("TEST SUMMARY")
        print(f"Total Tests: {total}")
        print(f"{Colors.GREEN}Passed: {self.passed}{Colors.RESET}")
        print(f"{Colors.RED}Failed: {self.failed}{Colors.RESET}")
        print(f"{Colors.YELLOW}Warnings: {self.warnings}{Colors.RESET}")
        
        if self.errors:
            print(f"\n{Colors.RED}Errors:{Colors.RESET}")
            for i, error in enumerate(self.errors, 1):
                print(f"  {i}. {error}")
        
        return self.failed == 0

results = TestResult()

def test_api_health() -> bool:
    """Test 1: API Health Check"""
    print_test("API Health Check")
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and data.get('status') == 'ok':
            print_pass(f"API is healthy")
            print_info(f"Database: {data.get('database', False)}")
            print_info(f"AI Enabled: {data.get('ai_enabled', False)}")
            results.add_pass()
            return True
        else:
            print_fail("API health check failed", f"Status: {data.get('status')}")
            results.add_fail("API health check failed")
            return False
    except Exception as e:
        print_fail("Could not reach API", str(e))
        results.add_fail(f"API unreachable: {e}")
        return False

def test_parse_recipe() -> Optional[Dict[str, Any]]:
    """Test 2: Parse Recipe from URL"""
    print_test("Parse Recipe from URL")
    try:
        response = requests.post(
            f"{BASE_URL}/api/meals/parse",
            json={"recipe_text": TEST_RECIPE_URL},
            timeout=30
        )
        
        if response.status_code != 200:
            print_fail(f"Parse request failed with status {response.status_code}")
            results.add_fail(f"Parse failed: HTTP {response.status_code}")
            return None
        
        data = response.json()
        
        if not data.get('success'):
            print_fail("Parse unsuccessful", data.get('error', 'Unknown error'))
            results.add_fail(f"Parse error: {data.get('error')}")
            return None
        
        parsed_data = data.get('data', {})
        
        # Check required fields
        required_fields = ['name', 'ingredients', 'instructions']
        missing = [f for f in required_fields if not parsed_data.get(f)]
        
        if missing:
            print_fail(f"Missing required fields: {', '.join(missing)}")
            results.add_fail(f"Missing fields: {missing}")
            return None
        
        # Check image metadata
        has_image = bool(parsed_data.get('image_url'))
        has_source = bool(parsed_data.get('source_url'))
        has_cuisine = bool(parsed_data.get('cuisine'))
        
        print_pass(f"Recipe parsed: {parsed_data.get('name')}")
        print_info(f"Image URL: {parsed_data.get('image_url', 'MISSING')}")
        print_info(f"Source URL: {parsed_data.get('source_url', 'MISSING')}")
        print_info(f"Cuisine: {parsed_data.get('cuisine', 'MISSING')}")
        
        if has_image and has_source:
            results.add_pass()
        else:
            print_warn("Some metadata missing")
            results.add_warn()
            results.add_pass()  # Still passes, just with warning
        
        return parsed_data
        
    except Exception as e:
        print_fail("Parse request exception", str(e))
        results.add_fail(f"Parse exception: {e}")
        return None

def test_image_accessible(image_url: str) -> bool:
    """Test 3: Check if Image is Accessible"""
    print_test("Image Accessibility")
    try:
        response = requests.head(f"{BASE_URL}{image_url}", timeout=10)
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            content_length = response.headers.get('content-length', 0)
            
            if 'image' not in content_type:
                print_fail(f"Wrong content type: {content_type}")
                results.add_fail(f"Invalid content-type: {content_type}")
                return False
            
            print_pass(f"Image accessible")
            print_info(f"Type: {content_type}")
            print_info(f"Size: {int(content_length)/1024:.1f} KB")
            results.add_pass()
            return True
        else:
            print_fail(f"Image not accessible: HTTP {response.status_code}")
            results.add_fail(f"Image HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print_fail("Image request exception", str(e))
        results.add_fail(f"Image exception: {e}")
        return False

def test_create_meal(parsed_data: Dict[str, Any]) -> Optional[int]:
    """Test 4: Create Meal with All Metadata"""
    print_test("Create Meal via API")
    try:
        meal_data = {
            'name': f"Test - {parsed_data.get('name')} - {int(time.time())}",
            'meal_type': 'snack',
            'cook_time_minutes': parsed_data.get('cook_time_minutes'),
            'servings': parsed_data.get('servings'),
            'difficulty': 'easy',
            'tags': parsed_data.get('tags'),
            'ingredients': parsed_data.get('ingredients'),
            'instructions': parsed_data.get('instructions'),
            'image_url': parsed_data.get('image_url'),
            'source_url': parsed_data.get('source_url'),
            'cuisine': parsed_data.get('cuisine'),
        }
        
        response = requests.post(
            f"{BASE_URL}/api/meals",
            json=meal_data,
            timeout=10
        )
        
        if response.status_code not in [200, 201]:
            print_fail(f"Create failed with status {response.status_code}")
            try:
                error_data = response.json()
                print_fail("API Error", error_data.get('error', response.text))
            except:
                print_fail("Response", response.text[:200])
            results.add_fail(f"Create HTTP {response.status_code}")
            return None
        
        data = response.json()
        
        if not data.get('success'):
            print_fail("Create unsuccessful", data.get('error', 'Unknown'))
            results.add_fail(f"Create error: {data.get('error')}")
            return None
        
        saved_meal = data.get('data', {})
        meal_id = saved_meal.get('id')
        
        if not meal_id:
            print_fail("No meal ID returned")
            results.add_fail("No meal ID")
            return None
        
        print_pass(f"Meal created with ID: {meal_id}")
        results.add_pass()
        return meal_id
        
    except Exception as e:
        print_fail("Create request exception", str(e))
        results.add_fail(f"Create exception: {e}")
        return None

def test_retrieve_meal(meal_id: int, expected_image: str, expected_source: str) -> bool:
    """Test 5: Retrieve Meal and Verify Metadata"""
    print_test("Retrieve Meal and Verify Metadata")
    try:
        response = requests.get(f"{BASE_URL}/api/meals/{meal_id}", timeout=10)
        
        if response.status_code != 200:
            print_fail(f"Retrieve failed: HTTP {response.status_code}")
            results.add_fail(f"Retrieve HTTP {response.status_code}")
            return False
        
        data = response.json()
        meal = data.get('data', data)
        
        # Check metadata preservation
        saved_image = meal.get('image_url')
        saved_source = meal.get('source_url')
        saved_cuisine = meal.get('cuisine')
        
        print_info(f"Retrieved meal: {meal.get('name')}")
        print_info(f"Image URL: {saved_image}")
        print_info(f"Source URL: {saved_source}")
        print_info(f"Cuisine: {saved_cuisine}")
        
        issues = []
        
        if saved_image != expected_image:
            issues.append(f"image_url mismatch (expected: {expected_image}, got: {saved_image})")
        
        if saved_source != expected_source:
            issues.append(f"source_url mismatch (expected: {expected_source}, got: {saved_source})")
        
        if not saved_image:
            issues.append("image_url is NULL")
        
        if not saved_source:
            issues.append("source_url is NULL")
        
        if issues:
            for issue in issues:
                print_fail(issue)
            results.add_fail(f"Metadata issues: {len(issues)}")
            return False
        
        print_pass("All metadata preserved correctly")
        results.add_pass()
        return True
        
    except Exception as e:
        print_fail("Retrieve exception", str(e))
        results.add_fail(f"Retrieve exception: {e}")
        return False

def test_list_meals(meal_id: int) -> bool:
    """Test 6: Verify Meal Appears in List with Metadata"""
    print_test("Meal in List with Metadata")
    try:
        response = requests.get(f"{BASE_URL}/api/meals", timeout=10)
        
        if response.status_code != 200:
            print_fail(f"List failed: HTTP {response.status_code}")
            results.add_fail(f"List HTTP {response.status_code}")
            return False
        
        data = response.json()
        meals = data.get('data', data) if isinstance(data, dict) else data
        
        found_meal = None
        for meal in meals:
            if meal.get('id') == meal_id:
                found_meal = meal
                break
        
        if not found_meal:
            print_fail(f"Meal {meal_id} not in list")
            results.add_fail("Meal not in list")
            return False
        
        has_image = bool(found_meal.get('image_url'))
        has_source = bool(found_meal.get('source_url'))
        
        if has_image and has_source:
            print_pass("Meal in list with complete metadata")
            results.add_pass()
            return True
        else:
            missing = []
            if not has_image:
                missing.append('image_url')
            if not has_source:
                missing.append('source_url')
            print_fail(f"Meal in list but missing: {', '.join(missing)}")
            results.add_fail(f"List missing: {missing}")
            return False
        
    except Exception as e:
        print_fail("List exception", str(e))
        results.add_fail(f"List exception: {e}")
        return False

def cleanup_test_meal(meal_id: int):
    """Cleanup: Delete Test Meal"""
    print_test("Cleanup: Delete Test Meal")
    try:
        response = requests.delete(f"{BASE_URL}/api/meals/{meal_id}", timeout=10)
        if response.status_code == 200:
            print_pass(f"Test meal {meal_id} deleted")
        else:
            print_warn(f"Could not delete test meal {meal_id}")
    except Exception as e:
        print_warn(f"Cleanup failed: {e}")

def main():
    print_header("COMPREHENSIVE RECIPE IMAGE FEATURE TEST SUITE")
    
    # Test 1: Health check
    if not test_api_health():
        print("\n❌ API is not healthy, stopping tests")
        return 1
    
    # Test 2: Parse recipe
    parsed_data = test_parse_recipe()
    if not parsed_data:
        print("\n❌ Parse failed, stopping tests")
        results.summary()
        return 1
    
    image_url = parsed_data.get('image_url')
    source_url = parsed_data.get('source_url')
    
    # Test 3: Check image
    if image_url:
        test_image_accessible(image_url)
    else:
        print_warn("Skipping image test - no image URL")
        results.add_warn()
    
    # Test 4: Create meal
    meal_id = test_create_meal(parsed_data)
    if not meal_id:
        print("\n❌ Create failed, stopping tests")
        results.summary()
        return 1
    
    # Test 5: Retrieve and verify
    test_retrieve_meal(meal_id, image_url, source_url)
    
    # Test 6: List verification
    test_list_meals(meal_id)
    
    # Cleanup
    cleanup_test_meal(meal_id)
    
    # Summary
    success = results.summary()
    
    if success:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED!{Colors.RESET}")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.RESET}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
