#!/usr/bin/env python3
"""
Test Flask app endpoints
"""

import json
import sys
from app import app
import os

# Disable AI parser for testing if no key
os.environ.pop('ANTHROPIC_API_KEY', None)

def test_endpoint(client, method, endpoint, data=None, expected_status=200):
    """Test an endpoint and return the response"""
    if method == 'GET':
        response = client.get(endpoint)
    elif method == 'POST':
        response = client.post(
            endpoint,
            data=json.dumps(data) if data else None,
            content_type='application/json'
        )

    print(f"\n{'='*60}")
    print(f"{method} {endpoint}")
    print(f"Status: {response.status_code} (expected {expected_status})")

    if response.status_code != expected_status:
        print(f"❌ FAILED - Got {response.status_code}, expected {expected_status}")
        return None

    if response.content_type == 'application/json':
        result = response.get_json()
        print(f"Success: {result.get('success', 'N/A')}")
        if 'data' in result:
            if isinstance(result['data'], list):
                print(f"Data: {len(result['data'])} items")
            elif isinstance(result['data'], dict):
                print(f"Data: {list(result['data'].keys())[:5]}...")
        print("✓ PASSED")
        return result
    else:
        print("✓ PASSED (HTML response)")
        return None


def main():
    print("="*60)
    print("Testing Flask Application Endpoints")
    print("="*60)

    app.config['TESTING'] = True
    client = app.test_client()

    tests_passed = 0
    tests_failed = 0

    # Test health endpoint
    result = test_endpoint(client, 'GET', '/api/health')
    if result:
        tests_passed += 1
    else:
        tests_failed += 1

    # Test stats endpoint
    result = test_endpoint(client, 'GET', '/api/stats')
    if result and result.get('success'):
        tests_passed += 1
    else:
        tests_failed += 1

    # Test get meals
    result = test_endpoint(client, 'GET', '/api/meals')
    if result and result.get('success'):
        tests_passed += 1
        print(f"  Total meals retrieved: {len(result['data'])}")
    else:
        tests_failed += 1

    # Test get meals by type
    result = test_endpoint(client, 'GET', '/api/meals?type=dinner')
    if result and result.get('success'):
        tests_passed += 1
        print(f"  Dinners retrieved: {len(result['data'])}")
    else:
        tests_failed += 1

    # Test search meals
    result = test_endpoint(client, 'GET', '/api/meals/search?q=chicken')
    if result and result.get('success'):
        tests_passed += 1
        print(f"  Search results: {len(result['data'])}")
    else:
        tests_failed += 1

    # Test kid-friendly meals
    result = test_endpoint(client, 'GET', '/api/meals/kid-friendly?min_level=8')
    if result and result.get('success'):
        tests_passed += 1
        print(f"  Kid-friendly meals: {len(result['data'])}")
    else:
        tests_failed += 1

    # Test weekly meal plan
    result = test_endpoint(client, 'GET', '/api/meals/weekly-plan?plan_id=1')
    if result and result.get('success'):
        tests_passed += 1
        print(f"  Scheduled meals: {len(result['data'])}")
    else:
        tests_failed += 1

    # Test shopping list
    result = test_endpoint(client, 'GET', '/api/shopping-list?plan_id=1')
    if result and result.get('success'):
        tests_passed += 1
        print(f"  Shopping categories: {len(result['data'])}")
    else:
        tests_failed += 1

    # Test meal randomizer
    result = test_endpoint(
        client, 'POST', '/api/meals/randomize',
        data={
            'dietary_preference': 'all',
            'time_constraint': 'all',
            'kid_friendly_min': 5,
            'days': 7,
            'start_date': '2025-11-01'
        }
    )
    if result and result.get('success'):
        tests_passed += 1
        print(f"  Random meals generated: {len(result['data'])}")
    else:
        tests_failed += 1

    # Test adding a meal
    result = test_endpoint(
        client, 'POST', '/api/meals',
        data={
            'name': 'Test Meal',
            'meal_type': 'dinner',
            'kid_friendly_level': 8,
            'prep_time_minutes': 10,
            'cook_time_minutes': 20,
            'adult_friendly': True,
            'notes': 'Test meal',
            'ingredients': [
                {
                    'name': 'Test Ingredient',
                    'component_type': 'protein',
                    'quantity': '1 lb',
                    'is_optional': False
                }
            ]
        }
    )
    if result and result.get('success'):
        tests_passed += 1
    else:
        tests_failed += 1

    # Test home page
    response = client.get('/')
    if response.status_code == 200:
        print(f"\n{'='*60}")
        print(f"GET /")
        print(f"Status: {response.status_code}")
        print("✓ PASSED (HTML response)")
        tests_passed += 1
    else:
        print(f"\n❌ FAILED - Home page returned {response.status_code}")
        tests_failed += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"TEST SUMMARY")
    print(f"{'='*60}")
    print(f"✓ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Total: {tests_passed + tests_failed}")
    print(f"{'='*60}")

    if tests_failed == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {tests_failed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
