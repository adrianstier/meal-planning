#!/usr/bin/env python3
"""
Flask Web Application for Family Meal Planning
Includes AI-powered recipe parsing and meal randomization
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from meal_planner import MealPlannerDB
from ai_recipe_parser import RecipeParser
import os
from dotenv import load_dotenv
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import traceback

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


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/')
def index():
    """Serve the main web interface"""
    return render_template('index.html')


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
        min_kid_friendly = int(request.args.get('min_kid_friendly', 1))

        if meal_type:
            meals = db.get_meals_by_type(meal_type, min_kid_friendly)
        else:
            # Get all meals
            conn = db.connect()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT m.*, mt.name as meal_type_name
                FROM meals m
                JOIN meal_types mt ON m.meal_type_id = mt.id
                WHERE m.kid_friendly_level >= ?
                ORDER BY m.name
            """, (min_kid_friendly,))
            meals = [dict(row) for row in cursor.fetchall()]

            for meal in meals:
                meal['ingredients'] = db.get_meal_ingredients(meal['id'])

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


@app.route('/api/parse-recipe', methods=['POST'])
def parse_recipe():
    """
    Parse a recipe URL or text using AI
    Returns structured meal data to add to database
    """
    if not recipe_parser:
        return jsonify({
            'success': False,
            'error': 'AI recipe parser is not configured. Please set ANTHROPIC_API_KEY'
        }), 503

    try:
        data = request.json
        recipe_text = data.get('recipe_text', '')
        recipe_url = data.get('recipe_url', '')

        if not recipe_text and not recipe_url:
            return jsonify({
                'success': False,
                'error': 'Please provide either recipe_text or recipe_url'
            }), 400

        # Parse the recipe using AI
        parsed_meal = recipe_parser.parse_recipe(recipe_text or recipe_url)

        return jsonify({'success': True, 'data': parsed_meal})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals', methods=['POST'])
def add_meal():
    """Add a new meal to the database"""
    try:
        data = request.json

        # Required fields
        name = data.get('name')
        meal_type = data.get('meal_type', 'dinner')
        kid_friendly_level = int(data.get('kid_friendly_level', 5))
        prep_time = int(data.get('prep_time_minutes', 15))
        cook_time = int(data.get('cook_time_minutes', 30))
        adult_friendly = data.get('adult_friendly', True)
        notes = data.get('notes')

        if not name:
            return jsonify({
                'success': False,
                'error': 'Meal name is required'
            }), 400

        # Add meal
        meal_id = db.add_meal(
            name, meal_type, kid_friendly_level,
            prep_time, cook_time, adult_friendly, notes
        )

        # Add ingredients
        ingredients = data.get('ingredients', [])
        for ing in ingredients:
            db.add_ingredient_to_meal(
                meal_id,
                ing.get('name'),
                ing.get('component_type', 'side'),
                ing.get('quantity', ''),
                ing.get('is_optional', False)
            )

        return jsonify({
            'success': True,
            'data': {'meal_id': meal_id, 'message': f'Added meal: {name}'}
        })

    except Exception as e:
        traceback.print_exc()
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

    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', '1') == '1'

    print(f"\n{'='*60}")
    print(f"🍽️  Family Meal Planner Web App")
    print(f"{'='*60}")
    print(f"🌐 Running on http://localhost:{port}")
    print(f"🤖 AI Recipe Parser: {'Enabled' if recipe_parser else 'Disabled'}")
    print(f"{'='*60}\n")

    app.run(host='0.0.0.0', port=port, debug=debug)
