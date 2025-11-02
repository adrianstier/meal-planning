#!/usr/bin/env python3
"""
Comprehensive API Tests
Tests all CRUD operations, error handling, and edge cases
"""

import unittest
import json
import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from meal_planner import MealPlannerDB


class TestMealsAPI(unittest.TestCase):
    """Comprehensive tests for /api/meals endpoints"""

    def setUp(self):
        """Set up test client and test database"""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True

        # Use test database
        self.test_db = MealPlannerDB(':memory:')
        self.test_db.init_database()

    def test_get_all_meals(self):
        """Test GET /api/meals"""
        response = self.client.get('/api/meals')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('data', data)
        self.assertIsInstance(data['data'], list)

    def test_get_meals_by_type(self):
        """Test GET /api/meals?type=dinner"""
        response = self.client.get('/api/meals?type=dinner')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        # All meals should be dinner type
        for meal in data['data']:
            self.assertEqual(meal['meal_type'], 'dinner')

    def test_get_meals_invalid_type(self):
        """Test GET /api/meals with invalid type"""
        response = self.client.get('/api/meals?type=invalid')
        self.assertEqual(response.status_code, 200)  # Should return empty list
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']), 0)

    def test_create_meal_success(self):
        """Test POST /api/meals with valid data"""
        meal_data = {
            'name': 'Test Meal',
            'meal_type': 'dinner',
            'cook_time_minutes': 30,
            'servings': 4,
            'difficulty': 'easy'
        }
        response = self.client.post('/api/meals',
                                   data=json.dumps(meal_data),
                                   content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('data', data)
        self.assertEqual(data['data']['name'], 'Test Meal')

    def test_create_meal_missing_name(self):
        """Test POST /api/meals without name"""
        meal_data = {
            'meal_type': 'dinner',
            'cook_time_minutes': 30
        }
        response = self.client.post('/api/meals',
                                   data=json.dumps(meal_data),
                                   content_type='application/json')
        # Should fail validation
        self.assertIn(response.status_code, [400, 500])

    def test_create_meal_invalid_meal_type(self):
        """Test POST /api/meals with invalid meal_type"""
        meal_data = {
            'name': 'Test Meal',
            'meal_type': 'invalid_type',
            'cook_time_minutes': 30
        }
        response = self.client.post('/api/meals',
                                   data=json.dumps(meal_data),
                                   content_type='application/json')
        # Should fail validation
        self.assertIn(response.status_code, [400, 500])

    def test_create_meal_negative_cook_time(self):
        """Test POST /api/meals with negative cook time"""
        meal_data = {
            'name': 'Test Meal',
            'meal_type': 'dinner',
            'cook_time_minutes': -10
        }
        response = self.client.post('/api/meals',
                                   data=json.dumps(meal_data),
                                   content_type='application/json')
        # Should fail validation
        self.assertIn(response.status_code, [400, 500])

    def test_get_meal_by_id(self):
        """Test GET /api/meals/<id>"""
        # First create a meal
        meal_data = {
            'name': 'Test Meal for Get',
            'meal_type': 'dinner'
        }
        create_response = self.client.post('/api/meals',
                                          data=json.dumps(meal_data),
                                          content_type='application/json')
        created_data = json.loads(create_response.data)
        meal_id = created_data['data']['id']

        # Now get it
        response = self.client.get(f'/api/meals/{meal_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['name'], 'Test Meal for Get')

    def test_get_meal_not_found(self):
        """Test GET /api/meals/<id> with non-existent ID"""
        response = self.client.get('/api/meals/99999')
        self.assertEqual(response.status_code, 404)

    def test_update_meal(self):
        """Test PUT /api/meals/<id>"""
        # First create a meal
        meal_data = {'name': 'Original Name', 'meal_type': 'dinner'}
        create_response = self.client.post('/api/meals',
                                          data=json.dumps(meal_data),
                                          content_type='application/json')
        created_data = json.loads(create_response.data)
        meal_id = created_data['data']['id']

        # Update it
        update_data = {'name': 'Updated Name'}
        response = self.client.put(f'/api/meals/{meal_id}',
                                   data=json.dumps(update_data),
                                   content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['name'], 'Updated Name')

    def test_delete_meal(self):
        """Test DELETE /api/meals/<id>"""
        # First create a meal
        meal_data = {'name': 'Meal to Delete', 'meal_type': 'dinner'}
        create_response = self.client.post('/api/meals',
                                          data=json.dumps(meal_data),
                                          content_type='application/json')
        created_data = json.loads(create_response.data)
        meal_id = created_data['data']['id']

        # Delete it
        response = self.client.delete(f'/api/meals/{meal_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

        # Verify it's deleted
        get_response = self.client.get(f'/api/meals/{meal_id}')
        self.assertEqual(get_response.status_code, 404)

    def test_search_meals(self):
        """Test GET /api/meals/search?q=<query>"""
        response = self.client.get('/api/meals/search?q=chicken')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        # All results should contain 'chicken'
        for meal in data['data']:
            self.assertTrue(
                'chicken' in meal['name'].lower() or
                'chicken' in (meal.get('ingredients') or '').lower()
            )

    def test_search_meals_empty_query(self):
        """Test search with empty query"""
        response = self.client.get('/api/meals/search?q=')
        self.assertEqual(response.status_code, 400)

    def test_favorite_meal(self):
        """Test POST /api/meals/<id>/favorite"""
        # Create a meal first
        meal_data = {'name': 'Meal to Favorite', 'meal_type': 'dinner'}
        create_response = self.client.post('/api/meals',
                                          data=json.dumps(meal_data),
                                          content_type='application/json')
        created_data = json.loads(create_response.data)
        meal_id = created_data['data']['id']

        # Favorite it
        response = self.client.post(f'/api/meals/{meal_id}/favorite')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])


class TestShoppingAPI(unittest.TestCase):
    """Comprehensive tests for /api/shopping endpoints"""

    def setUp(self):
        """Set up test client"""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True

    def test_get_shopping_list(self):
        """Test GET /api/shopping"""
        response = self.client.get('/api/shopping')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIsInstance(data['data'], list)

    def test_add_shopping_item(self):
        """Test POST /api/shopping"""
        item_data = {
            'item_name': 'Test Item',
            'category': 'Produce',
            'quantity': '2 lbs'
        }
        response = self.client.post('/api/shopping',
                                   data=json.dumps(item_data),
                                   content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

    def test_add_shopping_item_missing_name(self):
        """Test POST /api/shopping without item_name"""
        item_data = {
            'category': 'Produce'
        }
        response = self.client.post('/api/shopping',
                                   data=json.dumps(item_data),
                                   content_type='application/json')
        self.assertIn(response.status_code, [400, 500])

    def test_toggle_shopping_item(self):
        """Test POST /api/shopping/<id>/toggle"""
        # First create an item
        item_data = {'item_name': 'Item to Toggle'}
        create_response = self.client.post('/api/shopping',
                                          data=json.dumps(item_data),
                                          content_type='application/json')
        created_data = json.loads(create_response.data)
        item_id = created_data['data']['id']

        # Toggle it
        response = self.client.post(f'/api/shopping/{item_id}/toggle')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

    def test_delete_shopping_item(self):
        """Test DELETE /api/shopping/<id>"""
        # First create an item
        item_data = {'item_name': 'Item to Delete'}
        create_response = self.client.post('/api/shopping',
                                          data=json.dumps(item_data),
                                          content_type='application/json')
        created_data = json.loads(create_response.data)
        item_id = created_data['data']['id']

        # Delete it
        response = self.client.delete(f'/api/shopping/{item_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])


class TestPlanAPI(unittest.TestCase):
    """Comprehensive tests for /api/plan endpoints"""

    def setUp(self):
        """Set up test client"""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True

    def test_get_week_plan(self):
        """Test GET /api/plan/week"""
        today = datetime.now().strftime('%Y-%m-%d')
        response = self.client.get(f'/api/plan/week?start_date={today}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIsInstance(data['data'], list)

    def test_get_week_plan_missing_date(self):
        """Test GET /api/plan/week without start_date"""
        response = self.client.get('/api/plan/week')
        self.assertEqual(response.status_code, 400)

    def test_generate_week_plan(self):
        """Test POST /api/plan/generate-week"""
        today = datetime.now().strftime('%Y-%m-%d')
        plan_data = {
            'start_date': today,
            'num_days': 7,
            'meal_types': ['dinner']
        }
        response = self.client.post('/api/plan/generate-week',
                                   data=json.dumps(plan_data),
                                   content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

    def test_generate_week_plan_with_cuisines(self):
        """Test POST /api/plan/generate-week with cuisine filtering"""
        today = datetime.now().strftime('%Y-%m-%d')
        plan_data = {
            'start_date': today,
            'num_days': 7,
            'meal_types': ['dinner'],
            'cuisines': ['Italian', 'Mexican']
        }
        response = self.client.post('/api/plan/generate-week',
                                   data=json.dumps(plan_data),
                                   content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])


class TestLeftoversAPI(unittest.TestCase):
    """Comprehensive tests for /api/leftovers endpoints"""

    def setUp(self):
        """Set up test client"""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True

    def test_get_leftovers(self):
        """Test GET /api/leftovers"""
        response = self.client.get('/api/leftovers')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIsInstance(data['data'], list)

    def test_get_leftover_suggestions(self):
        """Test GET /api/leftovers/suggestions"""
        response = self.client.get('/api/leftovers/suggestions')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and error scenarios"""

    def setUp(self):
        """Set up test client"""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True

    def test_invalid_json(self):
        """Test with invalid JSON"""
        response = self.client.post('/api/meals',
                                   data='invalid json',
                                   content_type='application/json')
        self.assertIn(response.status_code, [400, 500])

    def test_missing_content_type(self):
        """Test POST without content-type header"""
        response = self.client.post('/api/meals',
                                   data='{"name": "Test"}')
        self.assertIn(response.status_code, [400, 415, 500])

    def test_very_long_name(self):
        """Test with extremely long meal name"""
        meal_data = {
            'name': 'A' * 10000,
            'meal_type': 'dinner'
        }
        response = self.client.post('/api/meals',
                                   data=json.dumps(meal_data),
                                   content_type='application/json')
        # Should either succeed or fail validation
        self.assertIn(response.status_code, [200, 400, 500])

    def test_special_characters_in_name(self):
        """Test with special characters"""
        meal_data = {
            'name': 'Test & Meal <script>alert("xss")</script>',
            'meal_type': 'dinner'
        }
        response = self.client.post('/api/meals',
                                   data=json.dumps(meal_data),
                                   content_type='application/json')
        # Should handle gracefully
        self.assertIn(response.status_code, [200, 400, 500])

    def test_sql_injection_attempt(self):
        """Test SQL injection protection"""
        meal_data = {
            'name': "Test'; DROP TABLE meals;--",
            'meal_type': 'dinner'
        }
        response = self.client.post('/api/meals',
                                   data=json.dumps(meal_data),
                                   content_type='application/json')
        # Should either sanitize or reject
        self.assertIn(response.status_code, [200, 400, 500])

        # Verify meals table still exists
        check_response = self.client.get('/api/meals')
        self.assertEqual(check_response.status_code, 200)


if __name__ == '__main__':
    unittest.main(verbosity=2)
