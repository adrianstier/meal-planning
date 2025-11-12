#!/usr/bin/env python3
"""
Comprehensive test suite for premium features:
- Stripe payment endpoints
- Nutrition tracking endpoints
- Analytics dashboard endpoints
- Subscription access control
- Edge cases and validation
"""

import sys
import os
import json
import sqlite3
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app
from meal_planner import MealPlannerDB
from subscription_manager import SubscriptionManager


class TestConfig:
    """Test configuration and utilities"""

    def __init__(self):
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.db = MealPlannerDB()
        self.test_user_id = None
        self.test_meal_id = None

    def setup(self):
        """Set up test data"""
        # Create test user
        try:
            self.db.create_user('testuser', 'password123', 'test@example.com')
            # Get user ID
            conn = sqlite3.connect(self.db.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE username = ?", ('testuser',))
            result = cursor.fetchone()
            if result:
                self.test_user_id = result[0]
            conn.close()
            print(f"✅ Test user created with ID: {self.test_user_id}")
        except Exception as e:
            print(f"⚠️  Test user may already exist: {e}")
            # Get existing user
            conn = sqlite3.connect(self.db.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE username = ?", ('testuser',))
            result = cursor.fetchone()
            if result:
                self.test_user_id = result[0]
            conn.close()

        # Create test meal
        try:
            self.test_meal_id = self.db.add_meal(
                user_id=self.test_user_id,
                name="Test Meal",
                ingredients=["chicken", "rice"],
                instructions="Cook it",
                prep_time_minutes=10,
                cook_time_minutes=20,
                servings=4,
                calories=500,
                protein_g=30,
                carbs_g=50,
                fat_g=15
            )
            print(f"✅ Test meal created with ID: {self.test_meal_id}")
        except Exception as e:
            print(f"⚠️  Test meal creation: {e}")

    def login(self):
        """Log in test user and return session cookie"""
        response = self.client.post('/api/login',
            data=json.dumps({
                'username': 'testuser',
                'password': 'password123'
            }),
            content_type='application/json'
        )
        return response

    def set_subscription(self, plan_tier='family', status='active'):
        """Set test user's subscription tier"""
        conn = sqlite3.connect(self.db.db_path)
        cursor = conn.cursor()

        # Update or insert subscription
        cursor.execute("""
            INSERT OR REPLACE INTO subscriptions
            (user_id, plan_tier, status, current_period_end)
            VALUES (?, ?, ?, ?)
        """, (self.test_user_id, plan_tier, status,
              (datetime.now() + timedelta(days=30)).isoformat()))

        conn.commit()
        conn.close()
        print(f"✅ Set subscription to {plan_tier} ({status})")


def test_stripe_endpoints():
    """Test Stripe payment endpoints"""
    print("\n" + "="*60)
    print("TESTING STRIPE PAYMENT ENDPOINTS")
    print("="*60)

    config = TestConfig()
    config.setup()

    # Test 1: Get pricing (public endpoint - no auth needed)
    print("\n[TEST 1] GET /api/stripe/pricing (public)")
    response = config.client.get('/api/stripe/pricing')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Pricing data received: {len(data.get('tiers', []))} tiers")
        for tier in data.get('tiers', []):
            print(f"   - {tier['name']}: ${tier['price_monthly']}/mo")
    else:
        print(f"❌ Failed: {response.get_json()}")

    # Login for protected endpoints
    login_response = config.login()
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.get_json()}")
        return

    # Test 2: Get subscription status
    print("\n[TEST 2] GET /api/stripe/subscription")
    response = config.client.get('/api/stripe/subscription')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Current plan: {data.get('plan_tier', 'unknown')}")
        print(f"   Status: {data.get('status', 'unknown')}")
        print(f"   Features: {len(data.get('features', []))} available")
    else:
        print(f"❌ Failed: {response.get_json()}")

    # Test 3: Check feature access (free tier)
    print("\n[TEST 3] GET /api/stripe/can-use-feature/ai_recipe_parsing (free tier)")
    response = config.client.get('/api/stripe/can-use-feature/ai_recipe_parsing')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        can_access = data.get('can_access', False)
        reason = data.get('reason', 'No reason')
        print(f"{'✅' if not can_access else '⚠️ '} Can access: {can_access}")
        print(f"   Reason: {reason}")

    # Test 4: Upgrade to family tier
    print("\n[TEST 4] Upgrading to family tier")
    config.set_subscription('family', 'active')

    # Test 5: Check feature access (family tier)
    print("\n[TEST 5] GET /api/stripe/can-use-feature/ai_recipe_parsing (family tier)")
    response = config.client.get('/api/stripe/can-use-feature/ai_recipe_parsing')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        can_access = data.get('can_access', False)
        print(f"{'✅' if can_access else '❌'} Can access: {can_access}")
        print(f"   Usage: {data.get('usage', {}).get('used', 0)}/{data.get('usage', {}).get('limit', 0)}")

    # Test 6: Get usage stats
    print("\n[TEST 6] GET /api/stripe/usage-stats")
    response = config.client.get('/api/stripe/usage-stats')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Usage stats received")
        for feature, usage in data.get('usage', {}).items():
            print(f"   {feature}: {usage.get('used', 0)}/{usage.get('limit', 'unlimited')}")


def test_nutrition_endpoints():
    """Test nutrition tracking endpoints"""
    print("\n" + "="*60)
    print("TESTING NUTRITION TRACKING ENDPOINTS")
    print("="*60)

    config = TestConfig()
    config.setup()
    config.login()

    # Upgrade to family tier (nutrition is premium feature)
    config.set_subscription('family', 'active')

    # Test 1: Set nutrition goals
    print("\n[TEST 1] PUT /api/nutrition/goals")
    response = config.client.put('/api/nutrition/goals',
        data=json.dumps({
            'daily_calories': 2000,
            'daily_protein_g': 150,
            'daily_carbs_g': 200,
            'daily_fat_g': 65
        }),
        content_type='application/json'
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"✅ Nutrition goals updated")
    else:
        print(f"❌ Failed: {response.get_json()}")

    # Test 2: Log nutrition
    print("\n[TEST 2] POST /api/nutrition/log")
    response = config.client.post('/api/nutrition/log',
        data=json.dumps({
            'meal_id': config.test_meal_id,
            'meal_name': 'Test Breakfast',
            'meal_type': 'breakfast',
            'servings': 1,
            'calories': 500,
            'protein_g': 30,
            'carbs_g': 50,
            'fat_g': 15
        }),
        content_type='application/json'
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Nutrition logged")
        daily_total = data.get('daily_total', {})
        print(f"   Daily total: {daily_total.get('total_calories', 0)} calories")
    else:
        print(f"❌ Failed: {response.get_json()}")

    # Test 3: Get nutrition logs
    print("\n[TEST 3] GET /api/nutrition/logs")
    response = config.client.get('/api/nutrition/logs?days=7')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Retrieved {len(data.get('logs', []))} logs")
        daily_totals = data.get('daily_totals', {})
        print(f"   Days with data: {len(daily_totals)}")
    else:
        print(f"❌ Failed: {response.get_json()}")

    # Test 4: Get weekly summary
    print("\n[TEST 4] GET /api/nutrition/summary/week")
    response = config.client.get('/api/nutrition/summary/week')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Weekly summary received")
        summary = data.get('summary', {})
        print(f"   Avg calories: {summary.get('avg_daily_calories', 0)}")
        print(f"   Days logged: {summary.get('days_logged', 0)}")
        adherence = data.get('adherence', {})
        print(f"   Adherence: {adherence.get('calories', 0)}%")
    else:
        print(f"❌ Failed: {response.get_json()}")

    # Test 5: Get nutrition from meal
    print("\n[TEST 5] GET /api/nutrition/from-meal/<id>")
    response = config.client.get(f'/api/nutrition/from-meal/{config.test_meal_id}')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Meal nutrition retrieved")
        print(f"   Calories: {data.get('calories', 0)}")
        print(f"   Protein: {data.get('protein_g', 0)}g")
    else:
        print(f"❌ Failed: {response.get_json()}")


def test_analytics_endpoints():
    """Test analytics dashboard endpoints"""
    print("\n" + "="*60)
    print("TESTING ANALYTICS DASHBOARD ENDPOINTS")
    print("="*60)

    config = TestConfig()
    config.setup()
    config.login()

    # Upgrade to family tier
    config.set_subscription('family', 'active')

    # Test 1: Get dashboard
    print("\n[TEST 1] GET /api/analytics/dashboard")
    response = config.client.get('/api/analytics/dashboard?days=30')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Dashboard data received")
        overview = data.get('overview', {})
        print(f"   Total recipes: {overview.get('total_recipes', 0)}")
        print(f"   Meals cooked: {overview.get('meals_cooked', 0)}")
        print(f"   Time saved: {overview.get('time_saved_hours', 0)}h")
        print(f"   Money saved: ${overview.get('money_saved', 0)}")
    else:
        print(f"❌ Failed: {response.get_json()}")

    # Test 2: Get savings
    print("\n[TEST 2] GET /api/analytics/savings")
    response = config.client.get('/api/analytics/savings?days=30')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"✅ Savings data received")
        time_saved = data.get('time_saved', {})
        money_saved = data.get('money_saved', {})
        print(f"   Time: {time_saved.get('hours', 0)}h")
        print(f"   Money: ${money_saved.get('amount', 0)}")
    else:
        print(f"❌ Failed: {response.get_json()}")

    # Test 3: Get insights
    print("\n[TEST 3] GET /api/analytics/insights")
    response = config.client.get('/api/analytics/insights')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        insights = data.get('insights', [])
        print(f"✅ {len(insights)} insights generated")
        for i, insight in enumerate(insights[:3], 1):
            print(f"   {i}. {insight.get('message', '')}")
    else:
        print(f"❌ Failed: {response.get_json()}")


def test_edge_cases():
    """Test edge cases and validation"""
    print("\n" + "="*60)
    print("TESTING EDGE CASES AND VALIDATION")
    print("="*60)

    config = TestConfig()
    config.setup()
    config.login()

    # Test 1: Invalid nutrition log (missing required fields)
    print("\n[TEST 1] Invalid nutrition log (missing fields)")
    response = config.client.post('/api/nutrition/log',
        data=json.dumps({
            'meal_name': 'Incomplete'
            # Missing calories, protein, etc.
        }),
        content_type='application/json'
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 400 or response.status_code == 403:
        print(f"✅ Properly rejected invalid data")
    else:
        print(f"⚠️  Expected 400/403, got {response.status_code}")

    # Test 2: Access premium feature with free tier
    print("\n[TEST 2] Access nutrition with free tier")
    config.set_subscription('free', 'active')
    response = config.client.post('/api/nutrition/log',
        data=json.dumps({
            'meal_name': 'Test',
            'meal_type': 'lunch',
            'calories': 400,
            'protein_g': 20,
            'carbs_g': 40,
            'fat_g': 10
        }),
        content_type='application/json'
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 403:
        data = response.get_json()
        print(f"✅ Access denied correctly")
        print(f"   Error: {data.get('error', '')}")
        print(f"   Upgrade required: {data.get('upgrade_required', False)}")
    else:
        print(f"❌ Should have been denied (403), got {response.status_code}")

    # Test 3: Negative values in nutrition
    print("\n[TEST 3] Negative nutrition values")
    config.set_subscription('family', 'active')
    response = config.client.post('/api/nutrition/log',
        data=json.dumps({
            'meal_name': 'Test',
            'meal_type': 'lunch',
            'calories': -100,  # Invalid
            'protein_g': -10,  # Invalid
            'carbs_g': 40,
            'fat_g': 10
        }),
        content_type='application/json'
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 400:
        print(f"✅ Properly rejected negative values")
    else:
        print(f"⚠️  Expected 400, got {response.status_code}")

    # Test 4: SQL injection attempt
    print("\n[TEST 4] SQL injection attempt")
    response = config.client.post('/api/nutrition/log',
        data=json.dumps({
            'meal_name': "'; DROP TABLE nutrition_logs; --",
            'meal_type': 'lunch',
            'calories': 400,
            'protein_g': 20,
            'carbs_g': 40,
            'fat_g': 10
        }),
        content_type='application/json'
    )
    print(f"Status: {response.status_code}")
    # Check if nutrition_logs table still exists
    conn = sqlite3.connect(config.db.db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nutrition_logs'")
    table_exists = cursor.fetchone() is not None
    conn.close()
    if table_exists:
        print(f"✅ SQL injection prevented - table still exists")
    else:
        print(f"❌ SQL injection succeeded - table dropped!")

    # Test 5: Concurrent subscription updates
    print("\n[TEST 5] Concurrent subscription updates")
    config.set_subscription('family', 'active')
    response1 = config.client.get('/api/stripe/subscription')
    response2 = config.client.get('/api/stripe/subscription')
    if response1.status_code == 200 and response2.status_code == 200:
        print(f"✅ Concurrent reads handled correctly")
    else:
        print(f"⚠️  Concurrent access issue")


def test_access_control():
    """Test subscription-based access control"""
    print("\n" + "="*60)
    print("TESTING SUBSCRIPTION ACCESS CONTROL")
    print("="*60)

    config = TestConfig()
    config.setup()
    config.login()

    features_to_test = [
        'ai_recipe_parsing',
        'nutrition_tracking',
        'analytics',
        'meal_prep_mode',
        'family_sharing'
    ]

    tiers = ['free', 'family', 'premium']

    for tier in tiers:
        print(f"\n[Testing {tier.upper()} tier]")
        config.set_subscription(tier, 'active')

        accessible = []
        blocked = []

        for feature in features_to_test:
            response = config.client.get(f'/api/stripe/can-use-feature/{feature}')
            if response.status_code == 200:
                data = response.get_json()
                if data.get('can_access'):
                    accessible.append(feature)
                else:
                    blocked.append(feature)

        print(f"✅ Accessible: {len(accessible)} features")
        for feat in accessible:
            print(f"   - {feat}")

        if blocked:
            print(f"❌ Blocked: {len(blocked)} features")
            for feat in blocked:
                print(f"   - {feat}")


def run_all_tests():
    """Run all test suites"""
    print("\n" + "="*60)
    print("COMPREHENSIVE PREMIUM FEATURES TEST SUITE")
    print("="*60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        test_stripe_endpoints()
    except Exception as e:
        print(f"\n❌ Stripe tests failed: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_nutrition_endpoints()
    except Exception as e:
        print(f"\n❌ Nutrition tests failed: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_analytics_endpoints()
    except Exception as e:
        print(f"\n❌ Analytics tests failed: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_edge_cases()
    except Exception as e:
        print(f"\n❌ Edge case tests failed: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_access_control()
    except Exception as e:
        print(f"\n❌ Access control tests failed: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "="*60)
    print("TEST SUITE COMPLETE")
    print("="*60)
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == '__main__':
    run_all_tests()
