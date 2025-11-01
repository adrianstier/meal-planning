#!/usr/bin/env python3
"""
Flask Web Application for Family Meal Planning
Includes AI-powered recipe parsing and meal randomization
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from meal_planner import MealPlannerDB
from ai_recipe_parser import RecipeParser
from school_menu_vision_parser import SchoolMenuVisionParser
import os
from dotenv import load_dotenv
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import traceback
import base64

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize database
db = MealPlannerDB()

# Initialize AI recipe parser
try:
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if api_key:
        recipe_parser = RecipeParser(api_key)
    else:
        recipe_parser = None
        print("⚠️  No ANTHROPIC_API_KEY found. Recipe parsing will be disabled.")
except Exception as e:
    recipe_parser = None
    print(f"⚠️  Failed to initialize AI parser: {e}")

# Initialize vision parser for school menus
try:
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if api_key:
        vision_parser = SchoolMenuVisionParser(api_key)
    else:
        vision_parser = None
        print("⚠️  No ANTHROPIC_API_KEY found. Menu photo parsing will be disabled.")
except Exception as e:
    vision_parser = None
    print(f"⚠️  Failed to initialize vision parser: {e}")


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'ai_enabled': recipe_parser is not None,
        'database': os.path.exists(db.db_path)
    })


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get database statistics"""
    try:
        stats = db.get_stats()
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals', methods=['GET'])
def get_meals():
    """Get all meals with optional filters"""
    try:
        meal_type = request.args.get('type')  # dinner, lunch, snack, breakfast

        # Get all meals with new schema
        conn = db.connect()
        cursor = conn.cursor()

        if meal_type:
            cursor.execute("""
                SELECT *
                FROM meals
                WHERE meal_type = ?
                ORDER BY name
            """, (meal_type,))
        else:
            cursor.execute("""
                SELECT *
                FROM meals
                ORDER BY name
            """)

        meals = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify({'success': True, 'data': meals})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/search', methods=['GET'])
def search_meals():
    """Search meals by name or ingredient"""
    try:
        query = request.args.get('q', '')
        meal_type = request.args.get('type')

        meals = db.search_meals(query, meal_type)
        return jsonify({'success': True, 'data': meals})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>', methods=['GET'])
def get_meal(meal_id):
    """Get a single meal by ID"""
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
        meal = cursor.fetchone()
        conn.close()

        if not meal:
            return jsonify({'success': False, 'error': 'Meal not found'}), 404

        return jsonify({'success': True, 'data': dict(meal)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals', methods=['POST'])
def create_meal():
    """Create a new meal"""
    try:
        data = request.json
        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO meals (
                name, meal_type, cook_time_minutes, servings, difficulty,
                tags, ingredients, instructions, is_favorite, makes_leftovers,
                leftover_servings, leftover_days
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('name'),
            data.get('meal_type', 'dinner'),
            data.get('cook_time_minutes'),
            data.get('servings'),
            data.get('difficulty', 'medium'),
            data.get('tags'),
            data.get('ingredients'),
            data.get('instructions'),
            data.get('is_favorite', False),
            data.get('makes_leftovers', False),
            data.get('leftover_servings'),
            data.get('leftover_days')
        ))

        meal_id = cursor.lastrowid
        conn.commit()

        # Return the created meal
        cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
        meal = dict(cursor.fetchone())
        conn.close()

        return jsonify({'success': True, 'data': meal}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>', methods=['PUT'])
def update_meal(meal_id):
    """Update an existing meal"""
    try:
        data = request.json
        conn = db.connect()
        cursor = conn.cursor()

        # Build update query dynamically based on provided fields
        update_fields = []
        update_values = []

        for field in ['name', 'meal_type', 'cook_time_minutes', 'servings', 'difficulty',
                      'tags', 'ingredients', 'instructions', 'is_favorite', 'makes_leftovers',
                      'leftover_servings', 'leftover_days']:
            if field in data:
                update_fields.append(f"{field} = ?")
                update_values.append(data[field])

        if not update_fields:
            return jsonify({'success': False, 'error': 'No fields to update'}), 400

        update_values.append(meal_id)
        query = f"UPDATE meals SET {', '.join(update_fields)} WHERE id = ?"

        cursor.execute(query, update_values)
        conn.commit()

        # Return the updated meal
        cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
        meal = cursor.fetchone()
        conn.close()

        if not meal:
            return jsonify({'success': False, 'error': 'Meal not found'}), 404

        return jsonify({'success': True, 'data': dict(meal)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    """Delete a meal"""
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Meal deleted'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>/favorite', methods=['POST'])
def favorite_meal(meal_id):
    """Mark a meal as favorite"""
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("UPDATE meals SET is_favorite = 1 WHERE id = ?", (meal_id,))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Meal marked as favorite'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>/favorite', methods=['DELETE'])
def unfavorite_meal(meal_id):
    """Remove favorite status from a meal"""
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("UPDATE meals SET is_favorite = 0 WHERE id = ?", (meal_id,))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Meal unfavorited'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/parse', methods=['POST'])
def parse_recipe():
    """Parse a recipe using AI"""
    try:
        if not recipe_parser:
            return jsonify({'success': False, 'error': 'AI parser not available'}), 503

        data = request.json
        recipe_text = data.get('recipe_text', '')

        if not recipe_text:
            return jsonify({'success': False, 'error': 'No recipe text provided'}), 400

        parsed = recipe_parser.parse_recipe(recipe_text)

        return jsonify({'success': True, 'data': parsed})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/kid-friendly', methods=['GET'])
def get_kid_friendly_meals():
    """Get kid-friendly meals"""
    try:
        min_level = int(request.args.get('min_level', 7))
        meals = db.get_kid_friendly_meals(min_level)
        return jsonify({'success': True, 'data': meals})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/randomize', methods=['POST'])
def randomize_meals():
    """
    Randomize weekly meal plan with filters:
    - dietary_preference: 'all', 'vegetarian', 'pescatarian'
    - time_constraint: 'all', 'quick' (30 min or less), 'weekend' (longer, fun meals)
    - kid_friendly_min: minimum kid-friendly level
    - days: number of days to plan (default 7)
    """
    try:
        data = request.json
        dietary_pref = data.get('dietary_preference', 'all')
        time_constraint = data.get('time_constraint', 'all')
        kid_friendly_min = int(data.get('kid_friendly_min', 5))
        num_days = int(data.get('days', 7))
        start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))

        # Get filtered meals
        conn = db.connect()
        cursor = conn.cursor()

        # Build query based on filters
        query = """
            SELECT DISTINCT m.*, mt.name as meal_type_name
            FROM meals m
            JOIN meal_types mt ON m.meal_type_id = mt.id
            LEFT JOIN meal_ingredients mi ON m.id = mi.meal_id
            LEFT JOIN ingredients i ON mi.ingredient_id = i.id
            WHERE m.kid_friendly_level >= ?
            AND mt.name = 'dinner'
        """
        params = [kid_friendly_min]

        # Dietary filters
        if dietary_pref == 'vegetarian':
            query += """ AND m.id NOT IN (
                SELECT DISTINCT meal_id FROM meal_ingredients mi2
                JOIN ingredients i2 ON mi2.ingredient_id = i2.id
                WHERE i2.name IN ('Chicken breast', 'Ground beef', 'Turkey slices',
                                  'Trader Joe''s sausages', 'Chicken sausage',
                                  'Ham', 'Fish fillets', 'Salmon', 'Mussels')
            )"""
        elif dietary_pref == 'pescatarian':
            query += """ AND m.id NOT IN (
                SELECT DISTINCT meal_id FROM meal_ingredients mi2
                JOIN ingredients i2 ON mi2.ingredient_id = i2.id
                WHERE i2.name IN ('Chicken breast', 'Ground beef', 'Turkey slices',
                                  'Trader Joe''s sausages', 'Chicken sausage', 'Ham')
            )"""

        # Time constraint filters
        if time_constraint == 'quick':
            query += " AND (m.prep_time_minutes + m.cook_time_minutes) <= 30"
        elif time_constraint == 'weekend':
            query += " AND (m.prep_time_minutes + m.cook_time_minutes) > 30"

        cursor.execute(query, params)
        available_meals = [dict(row) for row in cursor.fetchall()]

        if len(available_meals) < num_days:
            return jsonify({
                'success': False,
                'error': f'Not enough meals match your criteria. Found {len(available_meals)}, need {num_days}'
            }), 400

        # Randomly select meals for each day
        selected_meals = random.sample(available_meals, num_days)

        # Generate schedule
        start = datetime.strptime(start_date, '%Y-%m-%d')
        schedule = []

        days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

        for i, meal in enumerate(selected_meals):
            meal_date = start + timedelta(days=i)
            schedule.append({
                'day': days_of_week[meal_date.weekday()],
                'date': meal_date.strftime('%Y-%m-%d'),
                'meal': meal,
                'ingredients': db.get_meal_ingredients(meal['id'])
            })

        return jsonify({'success': True, 'data': schedule})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/weekly-plan', methods=['GET'])
def get_weekly_plan():
    """Get the current weekly meal plan"""
    try:
        plan_id = int(request.args.get('plan_id', 1))
        meals = db.get_weekly_meal_plan(plan_id)
        return jsonify({'success': True, 'data': meals})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping-list', methods=['GET'])
def get_shopping_list():
    """Generate shopping list for a meal plan"""
    try:
        plan_id = int(request.args.get('plan_id', 1))
        shopping_list = db.generate_shopping_list(plan_id)
        return jsonify({'success': True, 'data': shopping_list})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/init-db', methods=['POST'])
def init_database():
    """Initialize database with schema and seed data"""
    try:
        db.initialize_database()

        # Also load additional meals
        conn = db.connect()
        cursor = conn.cursor()

        if os.path.exists('additional_meals.sql'):
            with open('additional_meals.sql', 'r') as f:
                cursor.executescript(f.read())
            conn.commit()

        return jsonify({
            'success': True,
            'message': 'Database initialized successfully'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# MEAL HISTORY & FAVORITES ENDPOINTS
# ============================================================================

@app.route('/api/meals/<int:meal_id>/mark-cooked', methods=['POST'])
def mark_meal_cooked(meal_id):
    """Mark a meal as cooked"""
    try:
        data = request.get_json() or {}
        cooked_date = data.get('cooked_date')
        rating = data.get('rating')
        notes = data.get('notes')

        history_id = db.mark_meal_as_cooked(meal_id, cooked_date, rating, notes)

        return jsonify({
            'success': True,
            'history_id': history_id,
            'message': 'Meal marked as cooked'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>/toggle-favorite', methods=['POST'])
def toggle_meal_favorite(meal_id):
    """Toggle favorite status for a meal"""
    try:
        is_favorite = db.toggle_favorite(meal_id)

        return jsonify({
            'success': True,
            'is_favorite': is_favorite,
            'message': 'Favorite toggled'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/favorites', methods=['GET'])
def get_favorites():
    """Get all favorite meals"""
    try:
        favorites = db.get_favorites()
        return jsonify({
            'success': True,
            'meals': favorites,
            'count': len(favorites)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recently-cooked', methods=['GET'])
def get_recently_cooked():
    """Get recently cooked meals"""
    try:
        limit = request.args.get('limit', 10, type=int)
        meals = db.get_recently_cooked(limit)

        return jsonify({
            'success': True,
            'meals': meals,
            'count': len(meals)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/havent-made', methods=['GET'])
def get_havent_made():
    """Get meals not made in a while"""
    try:
        days = request.args.get('days', 30, type=int)
        limit = request.args.get('limit', 10, type=int)
        meals = db.get_havent_made_in_while(days, limit)

        return jsonify({
            'success': True,
            'meals': meals,
            'count': len(meals),
            'days_threshold': days
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """Get cooking history"""
    try:
        meal_id = request.args.get('meal_id', type=int)
        limit = request.args.get('limit', 20, type=int)
        history = db.get_meal_history(meal_id, limit)

        return jsonify({
            'success': True,
            'history': history,
            'count': len(history)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# LEFTOVERS MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/api/leftovers', methods=['GET'])
def get_leftovers():
    """Get all active leftovers"""
    try:
        leftovers = db.get_active_leftovers()
        return jsonify({
            'success': True,
            'leftovers': leftovers,
            'count': len(leftovers)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/leftovers', methods=['POST'])
def add_leftover():
    """Add leftovers to inventory"""
    try:
        data = request.json
        meal_id = data.get('meal_id')
        cooked_date = data.get('cooked_date')
        servings = int(data.get('servings', 2))
        days_good = int(data.get('days_good', 3))

        if not meal_id:
            return jsonify({
                'success': False,
                'error': 'meal_id is required'
            }), 400

        leftover_id = db.add_leftovers(meal_id, cooked_date, servings, days_good)

        return jsonify({
            'success': True,
            'leftover_id': leftover_id,
            'message': 'Leftovers added to inventory'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/leftovers/<int:leftover_id>/consume', methods=['POST'])
def consume_leftover(leftover_id):
    """Mark leftovers as consumed"""
    try:
        db.mark_leftovers_consumed(leftover_id)

        return jsonify({
            'success': True,
            'message': 'Leftovers marked as consumed'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/leftovers/<int:leftover_id>/servings', methods=['PUT'])
def update_leftover_servings(leftover_id):
    """Update remaining servings"""
    try:
        data = request.json
        servings = int(data.get('servings', 0))

        if servings < 0:
            return jsonify({
                'success': False,
                'error': 'Servings must be non-negative'
            }), 400

        db.update_leftover_servings(leftover_id, servings)

        return jsonify({
            'success': True,
            'message': 'Servings updated'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/leftovers/suggestions', methods=['GET'])
def get_leftover_suggestions():
    """Get leftover lunch suggestions"""
    try:
        suggestions = db.suggest_leftover_lunches()
        return jsonify({
            'success': True,
            'suggestions': suggestions,
            'count': len(suggestions)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>/leftover-settings', methods=['PUT'])
def update_leftover_settings(meal_id):
    """Update leftover settings for a meal"""
    try:
        data = request.json
        makes_leftovers = data.get('makes_leftovers', False)
        servings = int(data.get('leftover_servings', 0))
        days = int(data.get('leftover_days', 1))

        db.update_meal_leftover_settings(meal_id, makes_leftovers, servings, days)

        return jsonify({
            'success': True,
            'message': 'Leftover settings updated'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# SCHOOL CAFETERIA MENU ENDPOINTS
# ============================================================================

@app.route('/api/school-menu', methods=['GET'])
def get_school_menu():
    """Get school menu for date range or upcoming week"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        days = request.args.get('days', 7, type=int)

        if start_date and end_date:
            menu_items = db.get_school_menu_range(start_date, end_date)
        else:
            menu_items = db.get_upcoming_school_menu(days)

        return jsonify({
            'success': True,
            'menu_items': menu_items,
            'count': len(menu_items)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/date/<date>', methods=['GET'])
def get_school_menu_by_date(date):
    """Get school menu for a specific date"""
    try:
        menu_items = db.get_school_menu_by_date(date)
        return jsonify({
            'success': True,
            'date': date,
            'menu_items': menu_items,
            'count': len(menu_items)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu', methods=['POST'])
def add_school_menu():
    """Add school menu item(s) - single or bulk upload"""
    try:
        data = request.json

        # Check if bulk upload (array of items)
        if isinstance(data, list):
            added_count = db.add_school_menu_bulk(data)
            return jsonify({
                'success': True,
                'message': f'Added {added_count} menu items',
                'added_count': added_count
            })
        else:
            # Single item
            menu_date = data.get('menu_date')
            meal_name = data.get('meal_name')
            meal_type = data.get('meal_type', 'lunch')
            description = data.get('description')

            if not menu_date or not meal_name:
                return jsonify({
                    'success': False,
                    'error': 'menu_date and meal_name are required'
                }), 400

            menu_id = db.add_school_menu_item(menu_date, meal_name, meal_type, description)

            if menu_id:
                return jsonify({
                    'success': True,
                    'menu_id': menu_id,
                    'message': 'Menu item added'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Menu item already exists for this date'
                }), 409

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/<int:menu_id>', methods=['DELETE'])
def delete_school_menu(menu_id):
    """Delete a school menu item"""
    try:
        db.delete_school_menu_item(menu_id)
        return jsonify({
            'success': True,
            'message': 'Menu item deleted'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/feedback', methods=['POST'])
def add_menu_feedback():
    """Add feedback about a school menu item"""
    try:
        data = request.json
        menu_item_id = data.get('menu_item_id')
        feedback_type = data.get('feedback_type')  # disliked, allergic, wont_eat
        notes = data.get('notes')

        if not menu_item_id or not feedback_type:
            return jsonify({
                'success': False,
                'error': 'menu_item_id and feedback_type are required'
            }), 400

        feedback_id = db.add_menu_feedback(menu_item_id, feedback_type, notes)

        return jsonify({
            'success': True,
            'feedback_id': feedback_id,
            'message': 'Feedback recorded'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/lunch-alternatives/<date>', methods=['GET'])
def get_lunch_alternatives(date):
    """Get smart lunch alternatives for a specific date"""
    try:
        alternatives = db.suggest_lunch_alternatives(date)
        return jsonify({
            'success': True,
            'data': alternatives
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/cleanup', methods=['POST'])
def cleanup_old_menus():
    """Clean up old school menu items"""
    try:
        days_ago = request.json.get('days_ago', 30)
        deleted_count = db.clear_old_school_menus(days_ago)
        return jsonify({
            'success': True,
            'deleted_count': deleted_count,
            'message': f'Deleted {deleted_count} old menu items'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/parse-photo', methods=['POST'])
def parse_menu_photo():
    """Parse school menu from uploaded photo using Claude Vision"""
    if not vision_parser:
        return jsonify({
            'success': False,
            'error': 'Vision parser is not configured. Please set ANTHROPIC_API_KEY'
        }), 503

    try:
        data = request.json
        image_data = data.get('image_data')  # Base64 encoded image
        image_type = data.get('image_type', 'image/jpeg')
        auto_add = data.get('auto_add', False)  # Automatically add to database

        if not image_data:
            return jsonify({
                'success': False,
                'error': 'image_data is required (base64 encoded)'
            }), 400

        # Remove data URL prefix if present (data:image/jpeg;base64,)
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        # Parse menu from image
        menu_items = vision_parser.parse_menu_from_base64(image_data, image_type)

        if not menu_items:
            return jsonify({
                'success': False,
                'error': 'No menu items found in image'
            }), 400

        # Optionally add to database automatically
        added_count = 0
        if auto_add:
            added_count = db.add_school_menu_bulk(menu_items)

        return jsonify({
            'success': True,
            'menu_items': menu_items,
            'count': len(menu_items),
            'added_count': added_count if auto_add else None,
            'message': f'Parsed {len(menu_items)} menu items' + (f' and added {added_count} to database' if auto_add else '')
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/calendar', methods=['GET'])
def get_school_menu_calendar():
    """Get school menu in calendar format for table view"""
    try:
        # Get date range (default to current month)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if not start_date:
            # Default to start of current month
            now = datetime.now()
            start_date = now.replace(day=1).strftime('%Y-%m-%d')

        if not end_date:
            # Default to end of next month
            now = datetime.now()
            if now.month == 12:
                next_month = now.replace(year=now.year + 1, month=1, day=1)
            else:
                next_month = now.replace(month=now.month + 1, day=1)

            # Get last day of next month
            if next_month.month == 12:
                last_day = next_month.replace(year=next_month.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                last_day = next_month.replace(month=next_month.month + 1, day=1) - timedelta(days=1)

            end_date = last_day.strftime('%Y-%m-%d')

        menu_items = db.get_school_menu_range(start_date, end_date)

        # Group by date and meal type
        calendar_data = {}
        for item in menu_items:
            date = item['menu_date']
            if date not in calendar_data:
                calendar_data[date] = {
                    'breakfast': [],
                    'lunch': [],
                    'snack': []
                }
            meal_type = item['meal_type']
            calendar_data[date][meal_type].append(item)

        return jsonify({
            'success': True,
            'start_date': start_date,
            'end_date': end_date,
            'calendar_data': calendar_data
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# REACT ROUTING - Catch-all route for client-side routing
# ============================================================================

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """
    Serve React app for all non-API routes.
    This enables React Router to handle client-side routing.
    """
    # If the path starts with 'api/', return 404
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404

    # Otherwise serve React's index.html
    return render_template('index.html')


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == '__main__':
    # Check if database exists, if not create it
    if not os.path.exists(db.db_path):
        print("📊 Initializing database...")
        db.initialize_database()

        # Load additional meals
        if os.path.exists('additional_meals.sql'):
            conn = db.connect()
            cursor = conn.cursor()
            with open('additional_meals.sql', 'r') as f:
                cursor.executescript(f.read())
            conn.commit()
            print("✓ Additional meals loaded")

    # Run migration for history features if needed
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='meal_history'")
        if not cursor.fetchone():
            print("🔄 Running history features migration...")
            if os.path.exists('add_history_features.sql'):
                with open('add_history_features.sql', 'r') as f:
                    cursor.executescript(f.read())
                conn.commit()
                print("✅ History features added!")
    except Exception as e:
        print(f"⚠️  Migration check: {e}")

    # Run migration for leftovers feature if needed
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='leftovers_inventory'")
        if not cursor.fetchone():
            print("🔄 Running leftovers feature migration...")
            if os.path.exists('add_leftovers_feature.sql'):
                with open('add_leftovers_feature.sql', 'r') as f:
                    cursor.executescript(f.read())
                conn.commit()
                print("✅ Leftovers feature added!")
    except Exception as e:
        print(f"⚠️  Leftovers migration check: {e}")

    # Run migration for school menu feature if needed
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='school_menu_items'")
        if not cursor.fetchone():
            print("🔄 Running school menu feature migration...")
            if os.path.exists('add_school_menu_feature.sql'):
                with open('add_school_menu_feature.sql', 'r') as f:
                    cursor.executescript(f.read())
                conn.commit()
                print("✅ School menu feature added!")
    except Exception as e:
        print(f"⚠️  School menu migration check: {e}")

    # Run migration for React schema if needed
    try:
        conn = db.connect()
        cursor = conn.cursor()

        # Check if meal_type column exists
        cursor.execute("PRAGMA table_info(meals)")
        columns = {row[1] for row in cursor.fetchall()}

        if 'meal_type' not in columns:
            print("🔄 Running React schema migration...")

            # Import and run the migration
            import subprocess
            result = subprocess.run(['python3', 'migrate_to_react_schema.py'],
                                  capture_output=True, text=True)

            if result.returncode == 0:
                print("✅ React schema migration completed!")
                print(result.stdout)
            else:
                print(f"⚠️  React schema migration failed: {result.stderr}")
        else:
            print("✅ React schema already migrated")
    except Exception as e:
        print(f"⚠️  React schema migration check: {e}")
        import traceback
        traceback.print_exc()

    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', '1') == '1'

    print(f"\n{'='*60}")
    print(f"🍽️  Family Meal Planner Web App")
    print(f"{'='*60}")
    print(f"🌐 Running on http://localhost:{port}")
    print(f"🤖 AI Recipe Parser: {'Enabled' if recipe_parser else 'Disabled'}")
    print(f"{'='*60}\n")

    app.run(host='0.0.0.0', port=port, debug=debug)
