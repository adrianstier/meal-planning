#!/usr/bin/env python3
"""
Comprehensive Edge Case Testing for Multi-User Features
Tests data isolation, profile management, and security boundaries
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5001"

class TestSession:
    """Wrapper for managing test user sessions"""
    def __init__(self, username):
        self.username = username
        self.session = requests.Session()
        self.user_id = None

    def register(self, email, password, display_name):
        """Register a new user"""
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "username": self.username,
            "email": email,
            "password": password,
            "display_name": display_name
        })
        if response.ok:
            data = response.json()
            if data.get('success'):
                self.user_id = data['user']['id']
        return response

    def login(self, password):
        """Login as user"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": self.username,
            "password": password
        })
        if response.ok:
            data = response.json()
            if data.get('success'):
                self.user_id = data['user']['id']
        return response

    def create_meal(self, meal_data):
        """Create a meal"""
        return self.session.post(f"{BASE_URL}/api/meals", json=meal_data)

    def get_meals(self):
        """Get all meals"""
        return self.session.get(f"{BASE_URL}/api/meals")

    def create_restaurant(self, restaurant_data):
        """Create a restaurant"""
        return self.session.post(f"{BASE_URL}/api/restaurants", json=restaurant_data)

    def get_restaurants(self):
        """Get all restaurants"""
        return self.session.get(f"{BASE_URL}/api/restaurants")

    def add_leftover(self, leftover_data):
        """Add leftover"""
        return self.session.post(f"{BASE_URL}/api/leftovers", json=leftover_data)

    def get_leftovers(self):
        """Get all leftovers"""
        return self.session.get(f"{BASE_URL}/api/leftovers")

    def update_profile(self, profile_data):
        """Update user profile"""
        return self.session.put(f"{BASE_URL}/api/auth/profile", json=profile_data)

    def get_meal_by_id(self, meal_id):
        """Get specific meal by ID"""
        return self.session.get(f"{BASE_URL}/api/meals/{meal_id}")

    def get_restaurant_by_id(self, restaurant_id):
        """Get specific restaurant by ID"""
        return self.session.get(f"{BASE_URL}/api/restaurants/{restaurant_id}")


def print_test(test_name):
    """Print test header"""
    print(f"\n{'='*70}")
    print(f"TEST: {test_name}")
    print('='*70)


def print_result(passed, message):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")


def main():
    print("\n" + "="*70)
    print("MULTI-USER EDGE CASE TESTING")
    print("="*70)

    # Create two test users
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    user1 = TestSession(f"testuser1_{timestamp}")
    user2 = TestSession(f"testuser2_{timestamp}")

    # Test 1: User Registration and Login
    print_test("User Registration and Authentication")

    resp1 = user1.register(
        f"user1_{timestamp}@test.com",
        "password123",
        "Test User One"
    )
    print_result(resp1.ok and resp1.json().get('success'),
                 f"User 1 registration: {resp1.status_code}")

    resp2 = user2.register(
        f"user2_{timestamp}@test.com",
        "password456",
        "Test User Two"
    )
    print_result(resp2.ok and resp2.json().get('success'),
                 f"User 2 registration: {resp2.status_code}")

    # Test 2: Duplicate Email Rejection
    print_test("Edge Case: Duplicate Email Registration")

    resp_dup = TestSession(f"duplicate_{timestamp}").register(
        f"user1_{timestamp}@test.com",  # Same email as user1
        "password789",
        "Duplicate User"
    )
    print_result(not resp_dup.ok or not resp_dup.json().get('success'),
                 f"Duplicate email blocked: {resp_dup.status_code}")

    # Test 3: Profile Update with Duplicate Email
    print_test("Edge Case: Profile Update with Existing Email")

    resp_profile = user1.update_profile({
        "email": f"user2_{timestamp}@test.com",  # Try to use user2's email
        "display_name": "Updated Name"
    })
    data = resp_profile.json() if resp_profile.ok else {}
    print_result(not data.get('success'),
                 f"Email conflict detected: {data.get('error', 'Unknown')}")

    # Test 4: Data Isolation - Meals
    print_test("Data Isolation: Meals Between Users")

    # User 1 creates a meal
    meal1_resp = user1.create_meal({
        "name": "User 1 Pasta",
        "meal_type": "dinner",
        "kid_friendly_level": 8,
        "prep_time_minutes": 20,
        "cook_time_minutes": 30
    })
    meal1_data = meal1_resp.json()
    meal1_id = meal1_data.get('data', {}).get('id') if meal1_resp.ok else None
    print_result(meal1_resp.ok and meal1_id,
                 f"User 1 created meal ID: {meal1_id}")

    # User 2 creates a meal
    meal2_resp = user2.create_meal({
        "name": "User 2 Tacos",
        "meal_type": "dinner",
        "kid_friendly_level": 9,
        "prep_time_minutes": 15,
        "cook_time_minutes": 20
    })
    meal2_data = meal2_resp.json()
    meal2_id = meal2_data.get('data', {}).get('id') if meal2_resp.ok else None
    print_result(meal2_resp.ok and meal2_id,
                 f"User 2 created meal ID: {meal2_id}")

    # User 1 gets their meals
    user1_meals = user1.get_meals().json()
    user1_meal_ids = [m['id'] for m in user1_meals.get('data', [])]
    print_result(meal1_id in user1_meal_ids and meal2_id not in user1_meal_ids,
                 f"User 1 sees only their meal (ID {meal1_id}), not User 2's meal (ID {meal2_id})")

    # User 2 gets their meals
    user2_meals = user2.get_meals().json()
    user2_meal_ids = [m['id'] for m in user2_meals.get('data', [])]
    print_result(meal2_id in user2_meal_ids and meal1_id not in user2_meal_ids,
                 f"User 2 sees only their meal (ID {meal2_id}), not User 1's meal (ID {meal1_id})")

    # Test 5: Cross-User Access Attempt
    print_test("Security: Cross-User Meal Access Prevention")

    # User 2 tries to access User 1's meal
    cross_access = user2.get_meal_by_id(meal1_id)
    cross_data = cross_access.json() if cross_access.ok else {}

    # Should either return 404, 403, or empty data
    is_blocked = (not cross_access.ok or
                  not cross_data.get('success') or
                  cross_data.get('data') is None)
    print_result(is_blocked,
                 f"User 2 blocked from accessing User 1's meal: {cross_access.status_code}")

    # Test 6: Data Isolation - Restaurants
    print_test("Data Isolation: Restaurants Between Users")

    # User 1 creates a restaurant
    rest1_resp = user1.create_restaurant({
        "name": "User 1 Pizza Place",
        "cuisine": "Italian",
        "address": "123 Main St"
    })
    rest1_data = rest1_resp.json()
    rest1_id = rest1_data.get('data', {}).get('id') if rest1_resp.ok else None
    print_result(rest1_resp.ok and rest1_id,
                 f"User 1 created restaurant ID: {rest1_id}")

    # User 2 creates a restaurant
    rest2_resp = user2.create_restaurant({
        "name": "User 2 Burger Joint",
        "cuisine": "American",
        "address": "456 Oak Ave"
    })
    rest2_data = rest2_resp.json()
    rest2_id = rest2_data.get('data', {}).get('id') if rest2_resp.ok else None
    print_result(rest2_resp.ok and rest2_id,
                 f"User 2 created restaurant ID: {rest2_id}")

    # User 1 gets their restaurants
    user1_rests = user1.get_restaurants().json()
    user1_rest_ids = [r['id'] for r in user1_rests.get('data', [])]
    print_result(rest1_id in user1_rest_ids and rest2_id not in user1_rest_ids,
                 f"User 1 sees only their restaurant")

    # User 2 gets their restaurants
    user2_rests = user2.get_restaurants().json()
    user2_rest_ids = [r['id'] for r in user2_rests.get('data', [])]
    print_result(rest2_id in user2_rest_ids and rest1_id not in user2_rest_ids,
                 f"User 2 sees only their restaurant")

    # Test 7: Leftovers Data Isolation
    print_test("Data Isolation: Leftovers Between Users")

    if meal1_id:
        # User 1 adds leftover
        leftover1_resp = user1.add_leftover({
            "meal_id": meal1_id,
            "cooked_date": "2025-01-01",
            "servings": 4
        })
        leftover1_data = leftover1_resp.json()
        print_result(leftover1_resp.ok and leftover1_data.get('success'),
                     f"User 1 added leftover: {leftover1_resp.status_code}")

        # User 1 gets leftovers
        user1_leftovers = user1.get_leftovers().json()
        print_result(len(user1_leftovers.get('data', [])) > 0,
                     f"User 1 sees their leftover")

        # User 2 gets leftovers (should be empty or not include user1's)
        user2_leftovers = user2.get_leftovers().json()
        user2_leftover_count = len(user2_leftovers.get('data', []))
        print_result(user2_leftover_count == 0,
                     f"User 2 has no leftovers (isolated from User 1)")

    # Test 8: Profile Update Validation
    print_test("Edge Case: Profile Update Validation")

    # Update with same email (should succeed)
    same_email_resp = user1.update_profile({
        "email": f"user1_{timestamp}@test.com",
        "display_name": "Updated Display Name"
    })
    same_email_data = same_email_resp.json()
    print_result(same_email_resp.ok and same_email_data.get('success'),
                 f"User can update profile with same email: {same_email_data.get('success')}")

    # Update with empty fields
    empty_resp = user1.update_profile({})
    empty_data = empty_resp.json()
    print_result(not empty_data.get('success'),
                 f"Empty update rejected: {empty_data.get('error', 'Unknown')}")

    # Test 9: Unauthenticated Access
    print_test("Security: Unauthenticated Access Prevention")

    unauth_session = requests.Session()
    unauth_meals = unauth_session.get(f"{BASE_URL}/api/meals")
    print_result(unauth_meals.status_code == 401,
                 f"Unauthenticated meal access blocked: {unauth_meals.status_code}")

    unauth_profile = unauth_session.put(f"{BASE_URL}/api/auth/profile", json={
        "display_name": "Hacker"
    })
    print_result(unauth_profile.status_code == 401,
                 f"Unauthenticated profile update blocked: {unauth_profile.status_code}")

    # Summary
    print("\n" + "="*70)
    print("TESTING COMPLETE")
    print("="*70)
    print("\nReview the results above to verify:")
    print("1. Data isolation between users")
    print("2. Security boundary enforcement")
    print("3. Profile update validation")
    print("4. Cross-user access prevention")
    print("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()
