#!/usr/bin/env python3
"""
Flask Web Application for Family Meal Planning
Includes AI-powered recipe parsing and meal randomization
"""

from flask import Flask, request, jsonify, render_template, send_from_directory, session
from flask_cors import CORS
from meal_planner import MealPlannerDB
from ai_recipe_parser import RecipeParser
from school_menu_vision_parser import SchoolMenuVisionParser
from recipe_url_scraper import RecipeURLScraper
from validation import db_connection, sanitize_ai_input, ValidationError, error_response
from auth import (
    authenticate_user, create_user, get_current_user,
    get_current_user_id, login_required
)
from stripe_routes import stripe_bp
from nutrition_routes import nutrition_bp
from analytics_routes import analytics_bp
import os
from dotenv import load_dotenv
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import traceback
import base64
import sqlite3
import json
import anthropic
import secrets

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='templates/static', static_url_path='/static')

# Configure session for authentication
app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.getenv('RAILWAY_ENVIRONMENT') is not None  # HTTPS only in production

CORS(app, supports_credentials=True)

# Register all blueprint routes
app.register_blueprint(stripe_bp)
print("✅ Stripe payment routes registered at /api/stripe/*")

app.register_blueprint(nutrition_bp)
print("✅ Nutrition tracking routes registered at /api/nutrition/*")

app.register_blueprint(analytics_bp)
print("✅ Analytics dashboard routes registered at /api/analytics/*")

# Initialize database
db = MealPlannerDB()

# Track initialization errors for diagnostics
recipe_parser_error = None
vision_parser_error = None
url_scraper_error = None

# Initialize AI recipe parser
try:
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if api_key:
        # Save images to templates/static/recipe_images so they're served by Flask
        recipe_parser = RecipeParser(api_key, image_folder='templates/static/recipe_images')
        print("✅ Recipe parser initialized with image folder: templates/static/recipe_images")
    else:
        recipe_parser = None
        recipe_parser_error = "No ANTHROPIC_API_KEY found"
        print("⚠️  No ANTHROPIC_API_KEY found. Recipe parsing will be disabled.")
except Exception as e:
    recipe_parser = None
    recipe_parser_error = str(e)
    print(f"⚠️  Failed to initialize AI parser: {e}")

# Initialize vision parser for school menus
try:
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if api_key:
        vision_parser = SchoolMenuVisionParser(api_key)
    else:
        vision_parser = None
        vision_parser_error = "No ANTHROPIC_API_KEY found"
        print("⚠️  No ANTHROPIC_API_KEY found. Menu photo parsing will be disabled.")
except Exception as e:
    vision_parser = None
    vision_parser_error = str(e)
    print(f"⚠️  Failed to initialize vision parser: {e}")

# Initialize URL scraper (always available)
try:
    url_scraper = RecipeURLScraper()
    print("✅ Recipe URL scraper initialized (supports 100+ sites)")
except Exception as e:
    url_scraper = None
    url_scraper_error = str(e)
    print(f"⚠️  Failed to initialize URL scraper: {e}")


# ============================================================================
# SECURITY HEADERS
# ============================================================================

@app.after_request
def add_security_headers(response):
    """
    Add security headers to all responses
    Protects against XSS, clickjacking, and other attacks
    """
    # Security: Prevent clickjacking attacks
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'

    # Security: Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # Security: Enable XSS protection in older browsers
    response.headers['X-XSS-Protection'] = '1; mode=block'

    # Security: Content Security Policy
    # Allow self and inline styles/scripts for React app
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self'"
    )

    # Security: Referrer policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

    # Security: Strict Transport Security (HSTS) - only in production
    if not app.debug:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    return response


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    api_key_present = os.getenv('ANTHROPIC_API_KEY') is not None
    api_key_length = len(os.getenv('ANTHROPIC_API_KEY', ''))

    response = {
        'status': 'ok',
        'ai_enabled': recipe_parser is not None,
        'vision_enabled': vision_parser is not None,
        'database': os.path.exists(db.db_path),
        'env_key_present': api_key_present,
        'env_key_length': api_key_length
    }

    # Add error messages if parsers failed to initialize
    if recipe_parser_error:
        response['recipe_parser_error'] = recipe_parser_error
    if vision_parser_error:
        response['vision_parser_error'] = vision_parser_error

    return jsonify(response)


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    display_name = data.get('display_name')

    if not username or not email or not password:
        return jsonify({
            'success': False,
            'error': 'Username, email, and password are required'
        }), 400

    user_id, error = create_user(username, email, password, display_name, db.db_path)

    if error:
        return jsonify({
            'success': False,
            'error': error
        }), 400

    # Auto-login after registration
    session['user_id'] = user_id

    # Get user data to return
    user = get_current_user(db.db_path)

    return jsonify({
        'success': True,
        'message': 'Registration successful',
        'user': user
    })


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user"""
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({
            'success': False,
            'error': 'Username and password are required'
        }), 400

    user, error = authenticate_user(username, password, db.db_path)

    if error:
        return jsonify({
            'success': False,
            'error': error
        }), 401

    # Set session
    session['user_id'] = user['id']

    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'display_name': user.get('display_name')
        }
    })


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logout user"""
    session.pop('user_id', None)
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    })


@app.route('/api/auth/me', methods=['GET'])
def get_me():
    """Get current user info"""
    user = get_current_user(db.db_path)

    if not user:
        return jsonify({
            'success': False,
            'error': 'Not authenticated'
        }), 401

    return jsonify({
        'success': True,
        'user': user
    })


@app.route('/api/auth/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update user profile"""
    try:
        user_id = get_current_user_id()
        data = request.json

        display_name = data.get('display_name')
        email = data.get('email')

        if not display_name and not email:
            return jsonify({
                'success': False,
                'error': 'No fields to update'
            }), 400

        conn = sqlite3.connect(db.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Build update query dynamically based on provided fields
        updates = []
        params = []

        if display_name:
            updates.append('display_name = ?')
            params.append(display_name)

        if email:
            # Check if email already exists for another user
            cursor.execute('SELECT id FROM users WHERE email = ? AND id != ?', (email, user_id))
            if cursor.fetchone():
                conn.close()
                return jsonify({
                    'success': False,
                    'error': 'Email already in use'
                }), 400
            updates.append('email = ?')
            params.append(email)

        # Add user_id for WHERE clause
        params.append(user_id)

        # Execute update
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()

        # Get updated user
        cursor.execute("""
            SELECT id, username, email, display_name, created_at, last_login
            FROM users
            WHERE id = ?
        """, (user_id,))
        updated_user = dict(cursor.fetchone())
        conn.close()

        return jsonify({
            'success': True,
            'user': updated_user,
            'message': 'Profile updated successfully'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/migrate', methods=['POST'])
def run_migrations():
    """Manually run database migrations"""
    try:
        results = {}

        # Run cuisine migration
        try:
            from database.migrations.add_cuisine import migrate as cuisine_migrate
            cuisine_migrate(db.db_path)
            results['cuisine'] = 'success'
        except Exception as e:
            results['cuisine'] = f'error: {str(e)}'

        # Run image_url migration (MUST run before recipe_metadata)
        try:
            from database.migrations.add_image_url import migrate as image_url_migrate
            image_url_migrate(db.db_path)
            results['image_url'] = 'success'
        except Exception as e:
            results['image_url'] = f'error: {str(e)}'

        # Run recipe metadata migration
        try:
            from database.migrations.add_recipe_metadata import migrate as metadata_migrate
            metadata_migrate(db.db_path)
            results['recipe_metadata'] = 'success'
        except Exception as e:
            results['recipe_metadata'] = f'error: {str(e)}'

        # Run image URL fix migration
        try:
            from database.migrations.fix_image_urls import migrate as image_migrate
            image_migrate(db.db_path)
            results['image_urls_fix'] = 'success'
        except Exception as e:
            results['image_urls_fix'] = f'error: {str(e)}'

        return jsonify({'success': True, 'migrations': results})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get database statistics"""
    try:
        stats = db.get_stats()
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals', methods=['GET'])
@login_required
def get_meals():
    """Get all meals with optional filters and pagination"""
    try:
        user_id = get_current_user_id()
        meal_type = request.args.get('type')  # dinner, lunch, snack, breakfast

        # Performance: Add pagination support
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        # Security: Limit per_page to prevent abuse
        per_page = min(per_page, 100)
        page = max(page, 1)

        offset = (page - 1) * per_page

        # Security: Use context manager to ensure connection is closed
        with db_connection(db) as conn:
            cursor = conn.cursor()

            # Get total count for pagination metadata
            if meal_type:
                cursor.execute("SELECT COUNT(*) as total FROM meals WHERE user_id = ? AND meal_type = ?", (user_id, meal_type))
            else:
                cursor.execute("SELECT COUNT(*) as total FROM meals WHERE user_id = ?", (user_id,))

            total_count = cursor.fetchone()['total']

            # Get paginated results
            if meal_type:
                cursor.execute("""
                    SELECT *
                    FROM meals
                    WHERE user_id = ? AND meal_type = ?
                    ORDER BY name
                    LIMIT ? OFFSET ?
                """, (user_id, meal_type, per_page, offset))
            else:
                cursor.execute("""
                    SELECT *
                    FROM meals
                    WHERE user_id = ?
                    ORDER BY name
                    LIMIT ? OFFSET ?
                """, (user_id, per_page, offset))

            meals = [dict(row) for row in cursor.fetchall()]

        # Calculate pagination metadata
        total_pages = (total_count + per_page - 1) // per_page  # Ceiling division

        return jsonify({
            'success': True,
            'data': meals,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_count': total_count,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/search', methods=['GET'])
@login_required
def search_meals():
    """Search meals by name or ingredient"""
    try:
        user_id = get_current_user_id()
        query = request.args.get('q', '')
        meal_type = request.args.get('type')

        meals = db.search_meals(query, meal_type, user_id)
        return jsonify({'success': True, 'data': meals})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>', methods=['GET'])
@login_required
def get_meal(meal_id):
    """Get a single meal by ID"""
    try:
        user_id = get_current_user_id()

        # Security: Use context manager to ensure connection is closed
        with db_connection(db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
            meal = cursor.fetchone()

            if not meal:
                return error_response('Meal not found', 404)

            return jsonify({'success': True, 'data': dict(meal)})
    except Exception as e:
        # Security: Use standardized error response (hides internal details in production)
        return error_response('Failed to retrieve meal', 500, {'exception': str(e)})


@app.route('/api/meals', methods=['POST'])
@login_required
def create_meal():
    """Create a new meal"""
    try:
        user_id = get_current_user_id()
        data = request.json

        # Security: Use context manager to ensure connection is closed
        with db_connection(db) as conn:
            cursor = conn.cursor()

            # Map meal_type to meal_type_id
            meal_type = data.get('meal_type', 'dinner')
            meal_type_map = {'dinner': 1, 'lunch': 2, 'snack': 3, 'breakfast': 4}
            meal_type_id = meal_type_map.get(meal_type, 1)

            cursor.execute("""
                INSERT INTO meals (
                    name, meal_type, meal_type_id, cook_time_minutes, servings, difficulty,
                    tags, ingredients, instructions, is_favorite, makes_leftovers,
                    leftover_servings, leftover_days, image_url, source_url, cuisine, top_comments, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('name'),
                meal_type,
                meal_type_id,
                data.get('cook_time_minutes'),
                data.get('servings'),
                data.get('difficulty', 'medium'),
                data.get('tags'),
                data.get('ingredients'),
                data.get('instructions'),
                data.get('is_favorite', False),
                data.get('makes_leftovers', False),
                data.get('leftover_servings'),
                data.get('leftover_days'),
                data.get('image_url'),
                data.get('source_url'),
                data.get('cuisine'),
                data.get('top_comments'),
                user_id
            ))

            meal_id = cursor.lastrowid

            # Return the created meal
            cursor.execute("SELECT * FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
            meal = dict(cursor.fetchone())

        return jsonify({'success': True, 'data': meal}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>', methods=['PUT'])
@login_required
def update_meal(meal_id):
    """Update an existing meal"""
    try:
        user_id = get_current_user_id()
        data = request.json

        # Security: Whitelist allowed fields to prevent SQL injection
        ALLOWED_FIELDS = {
            'name', 'meal_type', 'cook_time_minutes', 'servings', 'difficulty',
            'tags', 'ingredients', 'instructions', 'is_favorite', 'makes_leftovers',
            'leftover_servings', 'leftover_days', 'kid_rating', 'image_url', 'cuisine',
            'source_url', 'top_comments'
        }

        # Security: Use context manager to ensure connection is closed
        with db_connection(db) as conn:
            cursor = conn.cursor()

            # Verify meal ownership
            cursor.execute("SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
            if not cursor.fetchone():
                return jsonify({'success': False, 'error': 'Meal not found'}), 404

            # Build update query dynamically based on provided fields
            update_fields = []
            update_values = []

            for field in data.keys():
                # Security: Only allow whitelisted fields
                if field in ALLOWED_FIELDS:
                    update_fields.append(f"{field} = ?")
                    update_values.append(data[field])

            # If meal_type is being updated, also update meal_type_id
            if 'meal_type' in data:
                meal_type_map = {'dinner': 1, 'lunch': 2, 'snack': 3, 'breakfast': 4}
                meal_type_id = meal_type_map.get(data['meal_type'], 1)
                update_fields.append("meal_type_id = ?")
                update_values.append(meal_type_id)

            if not update_fields:
                return jsonify({'success': False, 'error': 'No fields to update'}), 400

            update_values.append(meal_id)
            update_values.append(user_id)
            query = f"UPDATE meals SET {', '.join(update_fields)} WHERE id = ? AND user_id = ?"

            cursor.execute(query, update_values)

            # Return the updated meal
            cursor.execute("SELECT * FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
            meal = cursor.fetchone()

            if not meal:
                return jsonify({'success': False, 'error': 'Meal not found'}), 404

            return jsonify({'success': True, 'data': dict(meal)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>', methods=['DELETE'])
@login_required
def delete_meal(meal_id):
    """Delete a meal"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership before deleting
        cursor.execute("SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Meal not found'}), 404

        cursor.execute("DELETE FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Meal deleted'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>/favorite', methods=['POST'])
@login_required
def favorite_meal(meal_id):
    """Mark a meal as favorite"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Meal not found'}), 404

        cursor.execute("UPDATE meals SET is_favorite = 1 WHERE id = ? AND user_id = ?", (meal_id, user_id))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Meal marked as favorite'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>/favorite', methods=['DELETE'])
@login_required
def unfavorite_meal(meal_id):
    """Remove favorite status from a meal"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Meal not found'}), 404

        cursor.execute("UPDATE meals SET is_favorite = 0 WHERE id = ? AND user_id = ?", (meal_id, user_id))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Meal unfavorited'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/parse', methods=['POST'])
@login_required
def parse_recipe():
    """Parse a recipe using AI or URL scraper"""
    try:
        data = request.json
        recipe_text = data.get('recipe_text', '')

        if not recipe_text:
            return jsonify({'success': False, 'error': 'No recipe text provided'}), 400

        # Check if it's a URL
        if recipe_text.strip().startswith(('http://', 'https://')):
            # Try URL scraper first (supports 100+ sites)
            if url_scraper:
                try:
                    parsed = url_scraper.scrape_recipe(recipe_text.strip())
                    return jsonify({'success': True, 'data': parsed, 'source': 'url_scraper'})
                except Exception as url_error:
                    print(f"URL scraper failed: {url_error}")

                    # Check error type and provide appropriate messaging
                    error_str = str(url_error).lower()

                    # Categorize the error
                    if '403' in error_str or 'forbidden' in error_str:
                        error_type = 'blocked'
                        user_message = 'This recipe site is blocking automated access. Please copy and paste the recipe text instead, or try using "Parse from Text".'
                    elif '401' in error_str or 'unauthorized' in error_str:
                        error_type = 'paywall'
                        user_message = 'This recipe site requires a subscription or login. Please copy and paste the recipe text instead.'
                    elif '404' in error_str or 'not found' in error_str:
                        error_type = 'not_found'
                        user_message = 'Recipe URL not found. Please check the URL and try again.'
                    elif 'ssl' in error_str or 'certificate' in error_str:
                        error_type = 'ssl'
                        user_message = 'SSL certificate error. Please try copying and pasting the recipe text instead.'
                    else:
                        error_type = 'unknown'
                        user_message = f'Failed to parse recipe from URL: {str(url_error)}'

                    # For blocking/paywall errors, provide clear user message
                    # Don't try AI parser fallback since it needs the actual recipe content
                    if error_type in ['blocked', 'paywall', 'not_found']:
                        print(f"⚠️  URL scraper failed ({error_type}): {user_message}")
                        return jsonify({'success': False, 'error': user_message}), 500

                    # For other errors, fall back to AI parser if available
                    if recipe_parser:
                        print(f"⚠️  URL scraper failed ({error_type}). Falling back to AI parser...")
                        # Continue to AI parser below
                        pass
                    else:
                        return jsonify({'success': False, 'error': user_message}), 500
            elif not recipe_parser:
                return jsonify({'success': False, 'error': 'Neither URL scraper nor AI parser available'}), 503

        # Use AI parser for text or as fallback
        if not recipe_parser:
            return jsonify({'success': False, 'error': 'AI parser not available'}), 503

        parsed = recipe_parser.parse_recipe(recipe_text)

        return jsonify({'success': True, 'data': parsed, 'source': 'ai_parser'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/kid-friendly', methods=['GET'])
@login_required
def get_kid_friendly_meals():
    """Get kid-friendly meals"""
    try:
        user_id = get_current_user_id()
        min_level = int(request.args.get('min_level', 7))
        meals = db.get_kid_friendly_meals(min_level, user_id)
        return jsonify({'success': True, 'data': meals})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/randomize', methods=['POST'])
@login_required
def randomize_meals():
    """
    Randomize weekly meal plan with filters:
    - dietary_preference: 'all', 'vegetarian', 'pescatarian'
    - time_constraint: 'all', 'quick' (30 min or less), 'weekend' (longer, fun meals)
    - kid_friendly_min: minimum kid-friendly level
    - cuisines: list of cuisines to include (e.g., ['Italian', 'Mexican']) or 'all'
    - days: number of days to plan (default 7)
    """
    try:
        user_id = get_current_user_id()
        data = request.json
        dietary_pref = data.get('dietary_preference', 'all')
        time_constraint = data.get('time_constraint', 'all')
        kid_friendly_min = int(data.get('kid_friendly_min', 5))
        cuisines = data.get('cuisines', 'all')  # Can be 'all' or list like ['Italian', 'Mexican']
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
            WHERE m.user_id = ?
            AND m.kid_friendly_level >= ?
            AND mt.name = 'dinner'
        """
        params = [user_id, kid_friendly_min]

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

        # Cuisine filters
        if cuisines != 'all' and cuisines and len(cuisines) > 0:
            # Build OR condition for multiple cuisines
            cuisine_placeholders = ','.join(['?' for _ in cuisines])
            query += f" AND m.cuisine IN ({cuisine_placeholders})"
            params.extend(cuisines)

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
@login_required
def get_weekly_plan():
    """Get the current weekly meal plan"""
    try:
        plan_id = int(request.args.get('plan_id', 1))
        meals = db.get_weekly_meal_plan(plan_id)
        return jsonify({'success': True, 'data': meals})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping-list', methods=['GET'])
@login_required
def get_shopping_list():
    """Generate shopping list for a meal plan"""
    try:
        user_id = get_current_user_id()
        plan_id = int(request.args.get('plan_id', 1))
        shopping_list = db.generate_shopping_list(plan_id)
        return jsonify({'success': True, 'data': shopping_list})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# SHOPPING LIST ENDPOINTS
# ============================================================================

@app.route('/api/shopping', methods=['GET'])
@login_required
def get_shopping_items():
    """Get all shopping list items"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, item_name, category, quantity, is_purchased, created_at
            FROM shopping_items
            WHERE user_id = ?
            ORDER BY is_purchased ASC, category ASC, item_name ASC
        """, (user_id,))
        items = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'data': items})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping', methods=['POST'])
@login_required
def add_shopping_item():
    """Add a new shopping list item"""
    try:
        user_id = get_current_user_id()
        data = request.json
        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO shopping_items (item_name, category, quantity, is_purchased, user_id)
            VALUES (?, ?, ?, ?, ?)
        """, (
            data.get('item_name'),
            data.get('category'),
            data.get('quantity'),
            data.get('is_purchased', False),
            user_id
        ))

        item_id = cursor.lastrowid
        conn.commit()

        # Fetch the created item
        cursor.execute("SELECT * FROM shopping_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        item = dict(cursor.fetchone())
        conn.close()

        return jsonify({'success': True, 'data': item}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping/<int:item_id>', methods=['PUT'])
@login_required
def update_shopping_item(item_id):
    """Update a shopping list item"""
    try:
        user_id = get_current_user_id()
        data = request.json
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM shopping_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Item not found'}), 404

        cursor.execute("""
            UPDATE shopping_items
            SET item_name = ?, category = ?, quantity = ?, is_purchased = ?
            WHERE id = ? AND user_id = ?
        """, (
            data.get('item_name'),
            data.get('category'),
            data.get('quantity'),
            data.get('is_purchased'),
            item_id,
            user_id
        ))

        conn.commit()

        # Fetch the updated item
        cursor.execute("SELECT * FROM shopping_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        item = dict(cursor.fetchone())
        conn.close()

        return jsonify({'success': True, 'data': item})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping/<int:item_id>', methods=['DELETE'])
@login_required
def delete_shopping_item(item_id):
    """Delete a shopping list item"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM shopping_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Item not found'}), 404

        cursor.execute("DELETE FROM shopping_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Item deleted'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping/<int:item_id>/toggle', methods=['POST'])
@login_required
def toggle_shopping_item(item_id):
    """Toggle the purchased status of a shopping item"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM shopping_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Item not found'}), 404

        cursor.execute("""
            UPDATE shopping_items
            SET is_purchased = NOT is_purchased
            WHERE id = ? AND user_id = ?
        """, (item_id, user_id))
        conn.commit()

        # Fetch the updated item
        cursor.execute("SELECT * FROM shopping_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        item = dict(cursor.fetchone())
        conn.close()

        return jsonify({'success': True, 'data': item})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping/purchased', methods=['DELETE'])
@login_required
def clear_purchased_items():
    """Delete all purchased items"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM shopping_items WHERE is_purchased = 1 AND user_id = ?", (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Purchased items cleared'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping/generate', methods=['POST'])
@login_required
def generate_shopping_from_plan():
    """Generate smart shopping list from meal plan with AI categorization"""
    try:
        user_id = get_current_user_id()
        data = request.json
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        combine_similar = data.get('combine_similar', True)

        conn = db.connect()
        cursor = conn.cursor()

        # Get all meals in the date range with their names
        cursor.execute("""
            SELECT DISTINCT m.name, m.ingredients
            FROM scheduled_meals sm
            JOIN meals m ON sm.meal_id = m.id
            WHERE sm.meal_date BETWEEN ? AND ?
            AND sm.user_id = ?
            AND m.ingredients IS NOT NULL
        """, (start_date, end_date, user_id))

        meals = cursor.fetchall()

        if not meals:
            conn.close()
            return jsonify({'success': True, 'data': [], 'message': 'No meals found in date range'})

        # Collect all ingredients
        all_ingredients = []
        for meal in meals:
            ingredients_text = meal['ingredients']
            if ingredients_text:
                # Security: Sanitize each ingredient line
                try:
                    sanitized_ingredients = sanitize_ai_input(ingredients_text, max_length=5000)
                    for line in sanitized_ingredients.split('\n'):
                        line = line.strip()
                        if line and len(line) < 200:  # Security: Limit individual line length
                            all_ingredients.append(line)
                except ValidationError as e:
                    # Skip ingredients with suspicious content
                    print(f"Skipping suspicious ingredients: {e.message}")
                    continue

        if not all_ingredients:
            conn.close()
            return jsonify({'success': True, 'data': [], 'message': 'No valid ingredients found'})

        # Security: Limit total ingredients to prevent abuse
        if len(all_ingredients) > 200:
            all_ingredients = all_ingredients[:200]

        # Use AI to parse, combine, and categorize ingredients
        ai_prompt = f"""You are a smart grocery list assistant. Parse and organize these ingredients from multiple recipes:

{chr(10).join(all_ingredients)}

Please:
1. Parse each ingredient to extract quantity and item name
2. Combine duplicate items (e.g., "2 cups flour" + "1 cup flour" = "3 cups flour")
3. Categorize each item into grocery store sections: Produce, Meat & Seafood, Dairy & Eggs, Bakery, Pantry, Frozen, Beverages, Other
4. Sort items by category

Return a JSON array with this structure:
[
  {{
    "item_name": "combined item with quantity",
    "category": "store section",
    "quantity": "amount",
    "base_item": "item without quantity"
  }}
]

IMPORTANT: Return ONLY the JSON array, no other text."""

        try:
            client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=4096,
                messages=[{"role": "user", "content": ai_prompt}]
            )

            response_text = message.content[0].text.strip()

            # Parse JSON response
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            parsed_items = json.loads(response_text)

            # Add items to shopping list
            items_added = []
            for item in parsed_items:
                cursor.execute("""
                    INSERT INTO shopping_items (item_name, category, quantity, is_purchased, user_id)
                    VALUES (?, ?, ?, 0, ?)
                """, (
                    item.get('item_name'),
                    item.get('category'),
                    item.get('quantity'),
                    user_id
                ))
                items_added.append({
                    'id': cursor.lastrowid,
                    'item_name': item.get('item_name'),
                    'category': item.get('category'),
                    'quantity': item.get('quantity')
                })

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'data': items_added,
                'message': f'Added {len(items_added)} items organized by category'
            })

        except Exception as ai_error:
            # Fallback to simple parsing if AI fails
            print(f"AI parsing failed: {ai_error}, falling back to simple mode")
            items_added = []
            for line in all_ingredients:
                cursor.execute("""
                    INSERT INTO shopping_items (item_name, is_purchased, user_id)
                    VALUES (?, 0, ?)
                """, (line, user_id))
                items_added.append({'id': cursor.lastrowid, 'item_name': line})

            conn.commit()
            conn.close()
            return jsonify({'success': True, 'data': items_added})

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
# RESTAURANT ENDPOINTS
# ============================================================================

@app.route('/api/restaurants', methods=['GET'])
@login_required
def get_restaurants():
    """Get all restaurants with optional filters"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Build query with optional filters
        query = "SELECT * FROM restaurants WHERE user_id = ?"
        params = [user_id]

        # Filter by cuisine type
        cuisine = request.args.get('cuisine')
        if cuisine:
            query += " AND cuisine_type = ?"
            params.append(cuisine)

        # Filter by outdoor seating
        outdoor = request.args.get('outdoor_seating')
        if outdoor is not None:
            query += " AND outdoor_seating = ?"
            params.append(1 if outdoor == 'true' else 0)

        # Filter by has bar
        has_bar = request.args.get('has_bar')
        if has_bar is not None:
            query += " AND has_bar = ?"
            params.append(1 if has_bar == 'true' else 0)

        query += " ORDER BY name ASC"

        cursor.execute(query, params)
        restaurants = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'data': restaurants})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/restaurants', methods=['POST'])
@login_required
def create_restaurant():
    """Add a new restaurant"""
    try:
        user_id = get_current_user_id()
        data = request.json
        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO restaurants (
                name, address, latitude, longitude, phone, website,
                cuisine_type, price_range, outdoor_seating, has_bar,
                takes_reservations, good_for_groups, kid_friendly,
                rating, notes, tags, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('name'),
            data.get('address'),
            data.get('latitude'),
            data.get('longitude'),
            data.get('phone'),
            data.get('website'),
            data.get('cuisine_type'),
            data.get('price_range'),
            data.get('outdoor_seating', False),
            data.get('has_bar', False),
            data.get('takes_reservations', False),
            data.get('good_for_groups', False),
            data.get('kid_friendly', False),
            data.get('rating'),
            data.get('notes'),
            data.get('tags'),
            user_id
        ))

        restaurant_id = cursor.lastrowid
        conn.commit()

        # Fetch the created restaurant
        cursor.execute("SELECT * FROM restaurants WHERE id = ? AND user_id = ?", (restaurant_id, user_id))
        restaurant = dict(cursor.fetchone())
        conn.close()

        return jsonify({'success': True, 'data': restaurant}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/restaurants/<int:restaurant_id>', methods=['GET'])
@login_required
def get_restaurant(restaurant_id):
    """Get a single restaurant by ID"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM restaurants WHERE id = ? AND user_id = ?", (restaurant_id, user_id))
        restaurant = cursor.fetchone()
        conn.close()

        if not restaurant:
            return jsonify({'success': False, 'error': 'Restaurant not found'}), 404

        return jsonify({'success': True, 'data': dict(restaurant)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/restaurants/<int:restaurant_id>', methods=['PUT'])
@login_required
def update_restaurant(restaurant_id):
    """Update an existing restaurant"""
    try:
        user_id = get_current_user_id()
        data = request.json
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM restaurants WHERE id = ? AND user_id = ?", (restaurant_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Restaurant not found'}), 404

        cursor.execute("""
            UPDATE restaurants SET
                name = ?, address = ?, latitude = ?, longitude = ?,
                phone = ?, website = ?, cuisine_type = ?, price_range = ?,
                outdoor_seating = ?, has_bar = ?, takes_reservations = ?,
                good_for_groups = ?, kid_friendly = ?, rating = ?,
                notes = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        """, (
            data.get('name'),
            data.get('address'),
            data.get('latitude'),
            data.get('longitude'),
            data.get('phone'),
            data.get('website'),
            data.get('cuisine_type'),
            data.get('price_range'),
            data.get('outdoor_seating'),
            data.get('has_bar'),
            data.get('takes_reservations'),
            data.get('good_for_groups'),
            data.get('kid_friendly'),
            data.get('rating'),
            data.get('notes'),
            data.get('tags'),
            restaurant_id,
            user_id
        ))

        conn.commit()

        # Fetch the updated restaurant
        cursor.execute("SELECT * FROM restaurants WHERE id = ? AND user_id = ?", (restaurant_id, user_id))
        restaurant = dict(cursor.fetchone())
        conn.close()

        return jsonify({'success': True, 'data': restaurant})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/restaurants/<int:restaurant_id>', methods=['DELETE'])
@login_required
def delete_restaurant(restaurant_id):
    """Delete a restaurant"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM restaurants WHERE id = ? AND user_id = ?", (restaurant_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Restaurant not found'}), 404

        cursor.execute("DELETE FROM restaurants WHERE id = ? AND user_id = ?", (restaurant_id, user_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Restaurant deleted'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/restaurants/suggest', methods=['POST'])
@login_required
def suggest_restaurants():
    """Suggest 3 random restaurants based on filters"""
    try:
        user_id = get_current_user_id()
        data = request.json or {}
        conn = db.connect()
        cursor = conn.cursor()

        # Build query with optional filters
        query = "SELECT * FROM restaurants WHERE user_id = ?"
        params = [user_id]

        # Apply filters
        if data.get('cuisine_type'):
            query += " AND cuisine_type = ?"
            params.append(data['cuisine_type'])

        if data.get('outdoor_seating'):
            query += " AND outdoor_seating = 1"

        if data.get('has_bar'):
            query += " AND has_bar = 1"

        if data.get('kid_friendly'):
            query += " AND kid_friendly = 1"

        if data.get('price_range'):
            query += " AND price_range = ?"
            params.append(data['price_range'])

        # Get all matching restaurants and randomly select up to 3
        query += " ORDER BY RANDOM() LIMIT 3"

        cursor.execute(query, params)
        suggestions = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify({'success': True, 'data': suggestions})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/restaurants/geocode', methods=['POST'])
@login_required
def geocode_address():
    """Geocode an address to get latitude/longitude using Nominatim (OpenStreetMap)"""
    try:
        data = request.json
        address = data.get('address')

        if not address:
            return jsonify({'success': False, 'error': 'Address is required'}), 400

        # Use Nominatim (OpenStreetMap) - free geocoding service
        import urllib.parse
        import urllib.request

        # Encode address for URL
        encoded_address = urllib.parse.quote(address)
        url = f"https://nominatim.openstreetmap.org/search?q={encoded_address}&format=json&limit=1"

        # Add user agent as required by Nominatim
        req = urllib.request.Request(url, headers={'User-Agent': 'FamilyMealPlanner/1.0'})

        with urllib.request.urlopen(req, timeout=10) as response:
            results = json.loads(response.read().decode())

        if not results:
            return jsonify({
                'success': False,
                'error': 'Address not found. Please check the address and try again.'
            }), 404

        result = results[0]
        return jsonify({
            'success': True,
            'data': {
                'latitude': float(result['lat']),
                'longitude': float(result['lon']),
                'display_name': result.get('display_name', address)
            }
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Geocoding failed: {str(e)}'}), 500


@app.route('/api/restaurants/scrape-url', methods=['POST'])
@login_required
def scrape_restaurant_from_url():
    """Scrape restaurant info from any URL (restaurant website, Google Maps, etc.) using AI"""
    try:
        data = request.json
        url = data.get('url')

        if not url:
            return jsonify({'success': False, 'error': 'URL is required'}), 400

        # Check if AI is available
        if not recipe_parser:
            return jsonify({
                'success': False,
                'error': 'AI parser not available. Please set ANTHROPIC_API_KEY.'
            }), 503

        try:
            import urllib.request

            # Fetch the webpage content
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })

            with urllib.request.urlopen(req, timeout=15) as response:
                html_content = response.read().decode('utf-8', errors='ignore')

            # Use Claude to extract restaurant information from the HTML
            client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

            prompt = f"""Extract all restaurant information from this webpage HTML. Return ONLY a JSON object with this exact structure:
{{
  "name": "Restaurant Name",
  "address": "Full Address",
  "phone": "Phone Number",
  "website": "Website URL",
  "cuisine_type": "Type of Cuisine",
  "price_range": "$", "$$", "$$$", or "$$$$",
  "rating": 4.5,
  "image_url": "URL to main restaurant image (find the primary/hero image)",
  "hours_data": {{"Monday": "11:00 AM - 10:00 PM", ...}},
  "happy_hour_info": {{"days": [...], "time": "...", "details": "..."}},
  "outdoor_seating": true/false,
  "has_bar": true/false,
  "takes_reservations": true/false,
  "good_for_groups": true/false,
  "kid_friendly": true/false,
  "notes": "Any notable features, specialties, or interesting facts"
}}

Extract as much information as possible from the HTML below. If a field is not available, use null or appropriate default.
For image_url, find the main restaurant photo - look for og:image meta tags, large images in the content, or hero images.

HTML Content (truncated to first 10000 chars):
{html_content[:10000]}

Return ONLY valid JSON, no other text."""

            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}]
            )

            response_text = message.content[0].text.strip()

            # Remove markdown code blocks if present
            if response_text.startswith('```'):
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            scraped_data = json.loads(response_text)

            # Convert boolean fields to proper format
            for bool_field in ['outdoor_seating', 'has_bar', 'takes_reservations', 'good_for_groups', 'kid_friendly']:
                if bool_field in scraped_data and scraped_data[bool_field] is not None:
                    scraped_data[bool_field] = bool(scraped_data[bool_field])

            # Convert JSON objects to strings for storage
            if 'hours_data' in scraped_data and scraped_data['hours_data']:
                scraped_data['hours_data'] = json.dumps(scraped_data['hours_data'])
            if 'happy_hour_info' in scraped_data and scraped_data['happy_hour_info']:
                scraped_data['happy_hour_info'] = json.dumps(scraped_data['happy_hour_info'])

            return jsonify({
                'success': True,
                'data': scraped_data,
                'message': 'Restaurant information extracted successfully'
            })

        except urllib.error.URLError as e:
            return jsonify({
                'success': False,
                'error': f'Failed to fetch URL: {str(e)}. Note: Some sites like Yelp block automated access. Try using the restaurant\'s own website instead.'
            }), 400
        except json.JSONDecodeError as e:
            return jsonify({
                'success': False,
                'error': 'AI returned invalid JSON. Please try again.',
                'raw_response': response_text[:500]
            }), 500
        except Exception as e:
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Scraping failed: {str(e)}'
            }), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/restaurants/search', methods=['POST'])
@login_required
def search_restaurant():
    """Search for restaurant info using Claude's web search"""
    try:
        data = request.json
        query = data.get('query')  # e.g., "Chez Panisse, Berkeley"

        if not query:
            return jsonify({'success': False, 'error': 'Search query is required'}), 400

        # Check if AI is available
        if not recipe_parser:
            return jsonify({
                'success': False,
                'error': 'AI search not available. Please set ANTHROPIC_API_KEY.'
            }), 503

        try:
            client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

            # Use Claude with web search to find the restaurant
            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=4096,
                tools=[{
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": 3
                }],
                messages=[{
                    "role": "user",
                    "content": f"""Find comprehensive information about this restaurant: {query}

Search the web and extract ALL available details. Return ONLY a JSON object with this exact structure:
{{
  "name": "Restaurant Name",
  "address": "Full Street Address with City, State, ZIP",
  "phone": "Phone Number",
  "website": "Official Website URL",
  "cuisine_type": "Type of Cuisine",
  "price_range": "$", "$$", "$$$", or "$$$$",
  "rating": 4.5,
  "image_url": "URL to main restaurant image",
  "hours_data": {{"Monday": "11:00 AM - 10:00 PM", "Tuesday": "11:00 AM - 10:00 PM", ...}},
  "happy_hour_info": {{"days": ["Monday", "Friday"], "time": "4:00 PM - 6:00 PM", "details": "Half off appetizers"}},
  "outdoor_seating": true/false,
  "has_bar": true/false,
  "takes_reservations": true/false,
  "good_for_groups": true/false,
  "kid_friendly": true/false,
  "notes": "Any notable features, specialties, awards, or interesting facts"
}}

For the image_url, try to find a high-quality photo from the restaurant's website, Google Maps, or review sites.
If a field is not available, use null or appropriate default. Return ONLY valid JSON, no other text."""
                }]
            )

            # Extract response text
            response_text = ""
            for block in message.content:
                if hasattr(block, 'text'):
                    response_text += block.text

            # Clean up response - remove markdown code blocks if present
            response_text = response_text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            # Parse JSON response
            restaurant_data = json.loads(response_text)

            # Convert nested JSON objects to strings for storage
            if isinstance(restaurant_data.get('hours_data'), dict):
                restaurant_data['hours_data'] = json.dumps(restaurant_data['hours_data'])
            if isinstance(restaurant_data.get('happy_hour_info'), dict):
                restaurant_data['happy_hour_info'] = json.dumps(restaurant_data['happy_hour_info'])

            return jsonify({
                'success': True,
                'data': restaurant_data,
                'message': 'Restaurant information found successfully'
            })

        except json.JSONDecodeError as e:
            return jsonify({
                'success': False,
                'error': 'AI returned invalid JSON. Please try a more specific search (e.g., "Restaurant Name, City").',
                'raw_response': response_text[:500] if 'response_text' in locals() else 'No response'
            }), 500
        except Exception as e:
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Search failed: {str(e)}'
            }), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/restaurants/<int:restaurant_id>/scrape', methods=['POST'])
@login_required
def scrape_restaurant_info(restaurant_id):
    """Scrape restaurant info using AI (hours, happy hours, etc.)"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership and get restaurant
        cursor.execute("SELECT * FROM restaurants WHERE id = ? AND user_id = ?", (restaurant_id, user_id))
        restaurant = cursor.fetchone()
        if not restaurant:
            conn.close()
            return jsonify({'success': False, 'error': 'Restaurant not found'}), 404

        restaurant_dict = dict(restaurant)

        # Check if AI is available
        if not recipe_parser:
            return jsonify({
                'success': False,
                'error': 'AI parser not available. Please set ANTHROPIC_API_KEY.'
            }), 503

        # Use Claude to generate realistic restaurant hours/happy hour info
        # Note: This generates plausible data. For real scraping, you'd need to integrate with Google Places API
        try:
            client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

            prompt = f"""Generate realistic operating hours and happy hour information for this restaurant. Return ONLY a JSON object with this exact structure:
{{
  "hours_data": {{"Monday": "11:00 AM - 10:00 PM", "Tuesday": "11:00 AM - 10:00 PM", "Wednesday": "11:00 AM - 10:00 PM", "Thursday": "11:00 AM - 10:00 PM", "Friday": "11:00 AM - 11:00 PM", "Saturday": "10:00 AM - 11:00 PM", "Sunday": "10:00 AM - 9:00 PM"}},
  "happy_hour_info": {{"days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "time": "4:00 PM - 6:00 PM", "details": "Half off appetizers and $2 off draft beers"}}
}}

Restaurant: {restaurant_dict.get('name')}
Cuisine: {restaurant_dict.get('cuisine_type', 'Restaurant')}
{f"Website: {restaurant_dict.get('website')}" if restaurant_dict.get('website') else ""}

Generate typical hours for this type of establishment. Return ONLY valid JSON, no other text."""

            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )

            response_text = message.content[0].text.strip()

            # Try to extract JSON from response
            try:
                # Remove markdown code blocks if present
                if response_text.startswith('```'):
                    response_text = response_text.split('```')[1]
                    if response_text.startswith('json'):
                        response_text = response_text[4:]
                    response_text = response_text.strip()

                scraped_data = json.loads(response_text)

                # Update restaurant with scraped data
                cursor.execute("""
                    UPDATE restaurants
                    SET hours_data = ?, happy_hour_info = ?, last_scraped = CURRENT_TIMESTAMP
                    WHERE id = ? AND user_id = ?
                """, (
                    json.dumps(scraped_data.get('hours_data')) if scraped_data.get('hours_data') else None,
                    json.dumps(scraped_data.get('happy_hour_info')) if scraped_data.get('happy_hour_info') else None,
                    restaurant_id,
                    user_id
                ))
                conn.commit()

                # Fetch updated restaurant
                cursor.execute("SELECT * FROM restaurants WHERE id = ? AND user_id = ?", (restaurant_id, user_id))
                updated_restaurant = dict(cursor.fetchone())
                conn.close()

                return jsonify({
                    'success': True,
                    'data': updated_restaurant,
                    'message': 'Restaurant information generated successfully'
                })

            except json.JSONDecodeError:
                conn.close()
                return jsonify({
                    'success': False,
                    'error': 'AI returned invalid JSON. Please try again.',
                    'raw_response': response_text[:500]
                }), 500

        except Exception as e:
            conn.close()
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'AI processing failed: {str(e)}'
            }), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# MEAL PLAN API ENDPOINTS
# ============================================================================

@app.route('/api/plan/week', methods=['GET'])
@login_required
def get_week_plan():
    """Get week's meal plan starting from specified date"""
    try:
        user_id = get_current_user_id()
        start_date = request.args.get('start_date')

        if not start_date:
            return jsonify({'success': False, 'error': 'start_date is required'}), 400

        # Calculate end date (6 days after start)
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = start + timedelta(days=6)
        end_date = end.strftime('%Y-%m-%d')

        conn = db.connect()
        cursor = conn.cursor()

        # TODO: Re-enable user_id filter once migration adds the column
        cursor.execute("""
            SELECT
                sm.id,
                sm.meal_date as plan_date,
                mt.name as meal_type,
                sm.meal_id,
                m.name as meal_name,
                sm.notes,
                m.cook_time_minutes,
                m.difficulty,
                m.servings,
                m.tags,
                m.ingredients,
                m.instructions,
                m.cuisine,
                m.image_url
            FROM scheduled_meals sm
            JOIN meals m ON sm.meal_id = m.id
            JOIN meal_types mt ON sm.meal_type_id = mt.id
            WHERE sm.meal_date BETWEEN ? AND ?
            ORDER BY sm.meal_date,
                CASE mt.name
                    WHEN 'breakfast' THEN 1
                    WHEN 'lunch' THEN 2
                    WHEN 'snack' THEN 3
                    WHEN 'dinner' THEN 4
                END
        """, (start_date, end_date))

        plan_items = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify({'success': True, 'data': plan_items})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/plan', methods=['POST'])
@login_required
def add_plan_entry():
    """Add meal to plan"""
    try:
        user_id = get_current_user_id()
        data = request.json
        plan_date = data.get('plan_date')
        meal_type = data.get('meal_type')
        meal_id = data.get('meal_id')
        notes = data.get('notes', '')

        if not plan_date or not meal_type or not meal_id:
            return jsonify({
                'success': False,
                'error': 'plan_date, meal_type, and meal_id are required'
            }), 400

        conn = db.connect()
        cursor = conn.cursor()

        # Get meal_type_id
        cursor.execute("SELECT id FROM meal_types WHERE name = ?", (meal_type,))
        meal_type_row = cursor.fetchone()

        if not meal_type_row:
            conn.close()
            return jsonify({'success': False, 'error': f'Invalid meal_type: {meal_type}'}), 400

        meal_type_id = meal_type_row['id']

        # Get day of week
        date_obj = datetime.strptime(plan_date, '%Y-%m-%d')
        day_of_week = date_obj.strftime('%A')

        # Get or create meal plan for this week
        week_start = date_obj - timedelta(days=date_obj.weekday())
        week_end = week_start + timedelta(days=6)

        cursor.execute("""
            SELECT id FROM meal_plans
            WHERE week_start_date = ? AND user_id = ?
        """, (week_start.strftime('%Y-%m-%d'), user_id))

        plan = cursor.fetchone()
        if plan:
            meal_plan_id = plan['id']
        else:
            cursor.execute("""
                INSERT INTO meal_plans (name, week_start_date, week_end_date, user_id)
                VALUES (?, ?, ?, ?)
            """, (f"Week of {week_start.strftime('%Y-%m-%d')}",
                  week_start.strftime('%Y-%m-%d'),
                  week_end.strftime('%Y-%m-%d'),
                  user_id))
            meal_plan_id = cursor.lastrowid

        # Add scheduled meal
        cursor.execute("""
            INSERT INTO scheduled_meals (
                meal_plan_id, meal_id, day_of_week, meal_date, meal_type_id, notes, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (meal_plan_id, meal_id, day_of_week, plan_date, meal_type_id, notes, user_id))

        plan_entry_id = cursor.lastrowid
        conn.commit()

        # Return the created entry
        cursor.execute("""
            SELECT
                sm.id,
                sm.meal_date as plan_date,
                mt.name as meal_type,
                sm.meal_id,
                m.name as meal_name,
                sm.notes
            FROM scheduled_meals sm
            JOIN meals m ON sm.meal_id = m.id
            JOIN meal_types mt ON sm.meal_type_id = mt.id
            WHERE sm.id = ?
        """, (plan_entry_id,))

        plan_entry = dict(cursor.fetchone())
        conn.close()

        return jsonify({'success': True, 'data': plan_entry}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/plan/<int:plan_id>', methods=['PUT'])
@login_required
def update_plan_entry(plan_id):
    """Update plan entry"""
    try:
        user_id = get_current_user_id()
        data = request.json
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM scheduled_meals WHERE id = ? AND user_id = ?", (plan_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Plan entry not found'}), 404

        # Security: Whitelist allowed fields
        ALLOWED_FIELDS = {'meal_id', 'meal_type', 'plan_date', 'notes'}

        # Build update query
        update_fields = []
        update_values = []

        if 'meal_id' in data and 'meal_id' in ALLOWED_FIELDS:
            update_fields.append('meal_id = ?')
            update_values.append(data['meal_id'])

        if 'meal_type' in data and 'meal_type' in ALLOWED_FIELDS:
            # Convert meal_type name to meal_type_id
            cursor.execute("SELECT id FROM meal_types WHERE name = ?", (data['meal_type'],))
            meal_type_row = cursor.fetchone()
            if meal_type_row:
                update_fields.append('meal_type_id = ?')
                update_values.append(meal_type_row['id'])

        if 'plan_date' in data and 'plan_date' in ALLOWED_FIELDS:
            update_fields.append('meal_date = ?')
            update_values.append(data['plan_date'])
            # Update day_of_week too
            date_obj = datetime.strptime(data['plan_date'], '%Y-%m-%d')
            update_fields.append('day_of_week = ?')
            update_values.append(date_obj.strftime('%A'))

        if 'notes' in data and 'notes' in ALLOWED_FIELDS:
            update_fields.append('notes = ?')
            update_values.append(data['notes'])

        if not update_fields:
            conn.close()
            return jsonify({'success': False, 'error': 'No fields to update'}), 400

        update_values.append(plan_id)
        update_values.append(user_id)
        query = f"UPDATE scheduled_meals SET {', '.join(update_fields)} WHERE id = ? AND user_id = ?"

        cursor.execute(query, update_values)
        conn.commit()

        # Return updated entry
        cursor.execute("""
            SELECT
                sm.id,
                sm.meal_date as plan_date,
                mt.name as meal_type,
                sm.meal_id,
                m.name as meal_name,
                sm.notes
            FROM scheduled_meals sm
            JOIN meals m ON sm.meal_id = m.id
            JOIN meal_types mt ON sm.meal_type_id = mt.id
            WHERE sm.id = ? AND sm.user_id = ?
        """, (plan_id, user_id))

        plan_entry = cursor.fetchone()
        conn.close()

        if not plan_entry:
            return jsonify({'success': False, 'error': 'Plan entry not found'}), 404

        return jsonify({'success': True, 'data': dict(plan_entry)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/plan/<int:plan_id>', methods=['DELETE'])
@login_required
def delete_plan_entry(plan_id):
    """Delete plan entry"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership before deleting
        cursor.execute("SELECT id FROM scheduled_meals WHERE id = ? AND user_id = ?", (plan_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Plan entry not found'}), 404

        cursor.execute("DELETE FROM scheduled_meals WHERE id = ? AND user_id = ?", (plan_id, user_id))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Plan entry deleted'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/plan/clear-week', methods=['POST'])
@login_required
def clear_week_plan():
    """Clear all meals for a specific week"""
    try:
        user_id = get_current_user_id()
        data = request.json
        start_date = data.get('start_date')

        if not start_date:
            return jsonify({'success': False, 'error': 'start_date is required'}), 400

        # Calculate end date (6 days after start)
        from datetime import datetime, timedelta
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = start + timedelta(days=6)
        end_date = end.strftime('%Y-%m-%d')

        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        # Delete all scheduled meals for this week for this user
        cursor.execute("""
            DELETE FROM scheduled_meals
            WHERE meal_date BETWEEN ? AND ?
            AND user_id = ?
        """, (start_date, end_date, user_id))

        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Cleared {deleted_count} meals from week',
            'deleted_count': deleted_count
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/plan/suggest', methods=['POST'])
@login_required
def suggest_meals():
    """AI meal suggestions based on criteria"""
    try:
        user_id = get_current_user_id()
        data = request.json
        date = data.get('date')
        meal_type = data.get('meal_type', 'dinner')
        max_cook_time = data.get('max_cook_time')
        difficulty = data.get('difficulty')
        avoid_recent_days = data.get('avoid_recent_days', 7)

        conn = db.connect()
        cursor = conn.cursor()

        # Build query to find suitable meals
        query = """
            SELECT DISTINCT m.*
            FROM meals m
            LEFT JOIN meal_types mt ON m.meal_type_id = mt.id
            WHERE (m.meal_type = ? OR mt.name = ?)
            AND m.user_id = ?
        """
        params = [meal_type, meal_type, user_id]

        # Filter by cook time
        if max_cook_time:
            query += " AND m.cook_time_minutes <= ?"
            params.append(max_cook_time)

        # Filter by difficulty
        if difficulty:
            query += " AND m.difficulty = ?"
            params.append(difficulty)

        # Exclude recently cooked meals (if meal_history table exists)
        if avoid_recent_days and date:
            cutoff_date = (datetime.strptime(date, '%Y-%m-%d') - timedelta(days=avoid_recent_days)).strftime('%Y-%m-%d')

            # Check if meal_history table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='meal_history'")
            if cursor.fetchone():
                # Check which column name is used (cooked_date or date_eaten)
                cursor.execute("PRAGMA table_info(meal_history)")
                columns = {row[1] for row in cursor.fetchall()}
                date_column = 'cooked_date' if 'cooked_date' in columns else 'date_eaten'

                query += f""" AND m.id NOT IN (
                    SELECT DISTINCT meal_id FROM meal_history
                    WHERE {date_column} >= ? AND user_id = ?
                )"""
                params.extend([cutoff_date, user_id])

            # Also exclude recently scheduled meals
            query += """ AND m.id NOT IN (
                SELECT DISTINCT meal_id FROM scheduled_meals
                WHERE meal_date >= ? AND meal_date < ? AND user_id = ?
            )"""
            params.append(cutoff_date)
            params.append(date)
            params.append(user_id)

        query += " ORDER BY RANDOM() LIMIT 5"

        cursor.execute(query, params)
        suggestions = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify({'success': True, 'data': suggestions})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/plan/generate-week', methods=['POST'])
@login_required
def generate_week_plan():
    """Generate a weekly meal plan with smart scheduling and cuisine filtering"""
    try:
        user_id = get_current_user_id()
        data = request.json
        start_date = data.get('start_date')
        num_days = data.get('num_days', 7)
        meal_types = data.get('meal_types', ['dinner'])  # Default to dinners only
        avoid_school_duplicates = data.get('avoid_school_duplicates', True)
        cuisines = data.get('cuisines', 'all')  # Can be 'all' or list like ['Italian', 'Mexican']

        if not start_date:
            return jsonify({'success': False, 'error': 'start_date is required'}), 400

        conn = db.connect()
        cursor = conn.cursor()

        # Get all available meals with optional cuisine filtering
        query = """
            SELECT id, name, meal_type, tags, kid_friendly_level, cuisine
            FROM meals
            WHERE meal_type IN ({})
            AND user_id = ?
        """.format(','.join('?' * len(meal_types)))
        params = list(meal_types)
        params.append(user_id)

        # Add cuisine filter if specified
        if cuisines != 'all' and cuisines and len(cuisines) > 0:
            cuisine_placeholders = ','.join(['?' for _ in cuisines])
            query += f" AND cuisine IN ({cuisine_placeholders})"
            params.extend(cuisines)

        query += " ORDER BY RANDOM()"

        cursor.execute(query, params)
        available_meals = [dict(row) for row in cursor.fetchall()]

        if not available_meals:
            return jsonify({'success': False, 'error': 'No meals available'}), 400

        # Get school menu for the date range if we need to avoid duplicates
        school_menu = {}
        if avoid_school_duplicates:
            end_date = (datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=num_days-1)).strftime('%Y-%m-%d')
            try:
                menu_items = db.get_school_menu_range(start_date, end_date)
                for item in menu_items:
                    date = item['menu_date']
                    if date not in school_menu:
                        school_menu[date] = []
                    school_menu[date].append(item['meal_name'].lower())
            except (AttributeError, KeyError, TypeError) as e:
                # AttributeError: db doesn't have get_school_menu_range method
                # KeyError: item missing menu_date or meal_name
                # TypeError: unexpected data type
                pass  # If school menu doesn't exist, just skip

        # Generate meal plan with cuisine balancing
        generated_plan = []
        used_meals = set()
        used_cuisines_count = {}  # Track cuisine usage for variety

        # If multiple cuisines selected, try to balance them
        balance_cuisines = cuisines != 'all' and isinstance(cuisines, list) and len(cuisines) > 1

        for day_offset in range(num_days):
            current_date = (datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=day_offset)).strftime('%Y-%m-%d')
            school_meals_today = school_menu.get(current_date, [])

            for meal_type in meal_types:
                # Find a suitable meal
                suitable_meal = None

                # If balancing cuisines, find the least-used cuisine
                target_cuisine = None
                if balance_cuisines:
                    # Find cuisine with lowest count
                    min_count = min([used_cuisines_count.get(c, 0) for c in cuisines], default=0)
                    available_cuisines = [c for c in cuisines if used_cuisines_count.get(c, 0) == min_count]
                    if available_cuisines:
                        # Randomly pick from least-used cuisines for variety
                        import random
                        target_cuisine = random.choice(available_cuisines)

                # First pass: try to find meal matching target cuisine (if balancing)
                if target_cuisine:
                    for meal in available_meals:
                        if meal['id'] in used_meals or meal['meal_type'] != meal_type:
                            continue

                        # Check if this meal matches our target cuisine
                        if meal.get('cuisine') != target_cuisine:
                            continue

                        # Check for school menu similarity
                        is_similar = False
                        if avoid_school_duplicates and school_meals_today:
                            meal_name_lower = meal['name'].lower()
                            for school_meal in school_meals_today:
                                meal_words = set(meal_name_lower.split())
                                school_words = set(school_meal.split())
                                common_words = meal_words.intersection(school_words)
                                significant_words = common_words - {'with', 'and', 'or', 'the', 'a', 'an'}
                                if len(significant_words) >= 1:
                                    is_similar = True
                                    break

                        if not is_similar:
                            suitable_meal = meal
                            break

                # Second pass: if no target cuisine meal found, take any suitable meal
                if not suitable_meal:
                    for meal in available_meals:
                        if meal['id'] in used_meals or meal['meal_type'] != meal_type:
                            continue

                        # Check for school menu similarity
                        is_similar = False
                        if avoid_school_duplicates and school_meals_today:
                            meal_name_lower = meal['name'].lower()
                            for school_meal in school_meals_today:
                                meal_words = set(meal_name_lower.split())
                                school_words = set(school_meal.split())
                                common_words = meal_words.intersection(school_words)
                                significant_words = common_words - {'with', 'and', 'or', 'the', 'a', 'an'}
                                if len(significant_words) >= 1:
                                    is_similar = True
                                    break

                        if not is_similar:
                            suitable_meal = meal
                            break

                if suitable_meal:
                    generated_plan.append({
                        'date': current_date,
                        'meal_type': meal_type,
                        'meal_id': suitable_meal['id'],
                        'meal_name': suitable_meal['name'],
                        'cuisine': suitable_meal.get('cuisine')
                    })
                    used_meals.add(suitable_meal['id'])

                    # Track cuisine usage for balancing
                    meal_cuisine = suitable_meal.get('cuisine')
                    if meal_cuisine:
                        used_cuisines_count[meal_cuisine] = used_cuisines_count.get(meal_cuisine, 0) + 1

        conn.close()

        # Generate bento boxes if requested
        bento_message = None
        if data.get('generateBentos'):
            try:
                child_name = data.get('bentoChildName', '')

                # Use the existing bento generation logic
                bento_conn = db.connect()
                bento_cursor = bento_conn.cursor()

                # Get all available bento items
                bento_cursor.execute("""
                    SELECT id, name, category
                    FROM bento_items
                    WHERE user_id = ?
                    ORDER BY is_favorite DESC, RANDOM()
                """, (user_id,))

                items_by_category = {}
                total_items = 0
                for row in bento_cursor.fetchall():
                    total_items += 1
                    category = row[2]
                    if category not in items_by_category:
                        items_by_category[category] = []
                    items_by_category[category].append({'id': row[0], 'name': row[1]})

                if total_items >= 4 and len(items_by_category) >= 2:
                    # Generate 5 days of bento boxes
                    plans_created = []
                    used_items = set()

                    for day_offset in range(5):
                        current_date = (datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=day_offset)).strftime('%Y-%m-%d')

                        # Select 4 different items from different categories
                        compartments = [None, None, None, None]
                        categories_used = set()

                        for i in range(4):
                            available_categories = [c for c in items_by_category.keys() if c not in categories_used]

                            if available_categories:
                                category = random.choice(available_categories)
                                categories_used.add(category)

                                available_items = [item for item in items_by_category[category] if item['id'] not in used_items]
                                if not available_items:
                                    available_items = items_by_category[category]

                                if available_items:
                                    item = random.choice(available_items)
                                    compartments[i] = item['id']
                                    used_items.add(item['id'])

                                    if len(used_items) > 10:
                                        used_items = set()

                        # Create the bento plan
                        bento_cursor.execute("""
                            INSERT INTO bento_plans (date, child_name, compartment1_item_id, compartment2_item_id,
                                                   compartment3_item_id, compartment4_item_id, user_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (current_date, child_name, compartments[0], compartments[1], compartments[2], compartments[3], user_id))

                        plans_created.append({'id': bento_cursor.lastrowid, 'date': current_date})

                    bento_conn.commit()
                    bento_message = f'Successfully created {len(plans_created)} bento box plans for the week!'
                else:
                    bento_message = f'Need at least 4 bento items from 2 categories to generate bentos. You have {total_items} items.'

                bento_conn.close()
            except Exception as bento_error:
                print(f"Bento generation error: {bento_error}")
                bento_message = f'Meal plan created, but bento generation failed: {str(bento_error)}'

        response = {'success': True, 'data': generated_plan}
        if bento_message:
            response['bentoMessage'] = bento_message

        return jsonify(response)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/plan/apply-generated', methods=['POST'])
@login_required
def apply_generated_plan():
    """Apply a generated meal plan to the schedule"""
    try:
        user_id = get_current_user_id()
        data = request.json
        plan = data.get('plan', [])

        if not plan:
            return jsonify({'success': False, 'error': 'No plan provided'}), 400

        conn = db.connect()
        cursor = conn.cursor()

        # Get or create current meal plan
        cursor.execute("SELECT id FROM meal_plans WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
        result = cursor.fetchone()
        if result:
            meal_plan_id = result[0]
        else:
            cursor.execute("INSERT INTO meal_plans (name, user_id) VALUES (?, ?)", ("Generated Plan", user_id))
            meal_plan_id = cursor.lastrowid

        # Meal type mapping
        meal_type_map = {'breakfast': 4, 'lunch': 2, 'dinner': 1, 'snack': 3}

        added_count = 0
        for item in plan:
            try:
                # Convert date to day of week
                date_obj = datetime.strptime(item['date'], '%Y-%m-%d')
                day_of_week = date_obj.strftime('%A')

                # Get meal_type_id from meal_type string
                meal_type_id = meal_type_map.get(item['meal_type'], 1)

                cursor.execute("""
                    INSERT INTO scheduled_meals (
                        meal_plan_id, meal_id, day_of_week, meal_date, meal_type_id, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """, (meal_plan_id, item['meal_id'], day_of_week, item['date'], meal_type_id, user_id))
                added_count += 1
            except sqlite3.IntegrityError:
                # Slot already filled, skip
                continue

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'data': {'added_count': added_count}})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# MEAL HISTORY & FAVORITES ENDPOINTS
# ============================================================================

@app.route('/api/meals/<int:meal_id>/mark-cooked', methods=['POST'])
@login_required
def mark_meal_cooked(meal_id):
    """Mark a meal as cooked"""
    try:
        user_id = get_current_user_id()

        # Verify meal ownership
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Meal not found'}), 404
        conn.close()

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
@login_required
def toggle_meal_favorite(meal_id):
    """Toggle favorite status for a meal"""
    try:
        user_id = get_current_user_id()

        # Verify meal ownership
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Meal not found'}), 404
        conn.close()

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
@login_required
def get_favorites():
    """Get all favorite meals"""
    try:
        user_id = get_current_user_id()
        favorites = db.get_favorites(user_id=user_id)
        return jsonify({
            'success': True,
            'meals': favorites,
            'count': len(favorites)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recently-cooked', methods=['GET'])
@login_required
def get_recently_cooked():
    """Get recently cooked meals"""
    try:
        user_id = get_current_user_id()
        limit = request.args.get('limit', 10, type=int)
        meals = db.get_recently_cooked(limit=limit, user_id=user_id)

        return jsonify({
            'success': True,
            'meals': meals,
            'count': len(meals)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/havent-made', methods=['GET'])
@login_required
def get_havent_made():
    """Get meals not made in a while"""
    try:
        user_id = get_current_user_id()
        days = request.args.get('days', 30, type=int)
        limit = request.args.get('limit', 10, type=int)
        meals = db.get_havent_made_in_while(days=days, limit=limit, user_id=user_id)

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
@login_required
def get_history():
    """Get cooking history"""
    try:
        user_id = get_current_user_id()
        meal_id = request.args.get('meal_id', type=int)
        limit = request.args.get('limit', 20, type=int)
        history = db.get_meal_history(meal_id=meal_id, limit=limit, user_id=user_id)

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
@login_required
def get_leftovers():
    """Get all active leftovers with days_until_expiry calculated"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                l.id,
                l.meal_id,
                m.name as meal_name,
                l.cooked_date,
                l.servings_remaining,
                l.expires_date,
                l.notes,
                l.created_at,
                CAST(julianday(l.expires_date) - julianday('now') AS INTEGER) as days_until_expiry
            FROM leftovers_inventory l
            JOIN meals m ON l.meal_id = m.id
            WHERE l.consumed_at IS NULL
            AND m.user_id = ?
            ORDER BY l.expires_date ASC
        """, (user_id,))

        leftovers = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify({
            'success': True,
            'data': leftovers,
            'count': len(leftovers)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/leftovers', methods=['POST'])
@login_required
def add_leftover():
    """Add leftovers to inventory"""
    try:
        user_id = get_current_user_id()
        data = request.json
        meal_id = data.get('meal_id')
        cooked_date = data.get('cooked_date')
        servings = int(data.get('servings', 2))
        days_good = int(data.get('days_good', 3))
        notes = data.get('notes', '')

        if not meal_id:
            return jsonify({
                'success': False,
                'error': 'meal_id is required'
            }), 400

        # Verify meal ownership
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
        meal = cursor.fetchone()

        if not meal:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Meal not found or access denied'
            }), 404

        # Calculate expires_date
        if not cooked_date:
            cooked_date = datetime.now().strftime('%Y-%m-%d')

        cooked_dt = datetime.strptime(cooked_date, '%Y-%m-%d')
        expires_dt = cooked_dt + timedelta(days=days_good)
        expires_date = expires_dt.strftime('%Y-%m-%d')

        cursor.execute("""
            INSERT INTO leftovers_inventory (
                meal_id, cooked_date, servings_remaining, expires_date, notes, user_id
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (meal_id, cooked_date, servings, expires_date, notes, user_id))

        leftover_id = cursor.lastrowid
        conn.commit()

        # Return created leftover
        cursor.execute("""
            SELECT
                l.id,
                l.meal_id,
                m.name as meal_name,
                l.cooked_date,
                l.servings_remaining,
                l.expires_date,
                l.notes,
                CAST(julianday(l.expires_date) - julianday('now') AS INTEGER) as days_until_expiry
            FROM leftovers_inventory l
            JOIN meals m ON l.meal_id = m.id
            WHERE l.id = ? AND l.user_id = ?
        """, (leftover_id, user_id))

        leftover = dict(cursor.fetchone())
        conn.close()

        return jsonify({
            'success': True,
            'data': leftover,
            'message': 'Leftovers added to inventory'
        }), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/leftovers/<int:leftover_id>/consume', methods=['POST'])
@login_required
def consume_leftover(leftover_id):
    """Mark leftovers as consumed"""
    try:
        user_id = get_current_user_id()

        # Verify ownership through meals table
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT l.id FROM leftovers_inventory l
            JOIN meals m ON l.meal_id = m.id
            WHERE l.id = ? AND m.user_id = ?
        """, (leftover_id, user_id))
        leftover = cursor.fetchone()
        conn.close()

        if not leftover:
            return jsonify({
                'success': False,
                'error': 'Leftover not found or access denied'
            }), 404

        db.mark_leftovers_consumed(leftover_id)

        return jsonify({
            'success': True,
            'message': 'Leftovers marked as consumed'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/leftovers/<int:leftover_id>/servings', methods=['PUT'])
@login_required
def update_leftover_servings(leftover_id):
    """Update remaining servings"""
    try:
        user_id = get_current_user_id()
        data = request.json
        servings = int(data.get('servings', 0))

        if servings < 0:
            return jsonify({
                'success': False,
                'error': 'Servings must be non-negative'
            }), 400

        # Verify ownership through meals table
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT l.id FROM leftovers_inventory l
            JOIN meals m ON l.meal_id = m.id
            WHERE l.id = ? AND m.user_id = ?
        """, (leftover_id, user_id))
        leftover = cursor.fetchone()
        conn.close()

        if not leftover:
            return jsonify({
                'success': False,
                'error': 'Leftover not found or access denied'
            }), 404

        db.update_leftover_servings(leftover_id, servings)

        return jsonify({
            'success': True,
            'message': 'Servings updated'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/leftovers/suggestions', methods=['GET'])
@login_required
def get_leftover_suggestions():
    """Get expiring leftovers needing attention"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Get leftovers expiring soon (within 2 days)
        cursor.execute("""
            SELECT
                l.id,
                l.meal_id,
                m.name as meal_name,
                l.cooked_date,
                l.servings_remaining,
                l.expires_date,
                l.notes,
                CAST(julianday(l.expires_date) - julianday('now') AS INTEGER) as days_until_expiry
            FROM leftovers_inventory l
            JOIN meals m ON l.meal_id = m.id
            WHERE l.consumed_at IS NULL
            AND m.user_id = ?
            AND julianday(l.expires_date) - julianday('now') <= 2
            ORDER BY l.expires_date ASC
        """, (user_id,))

        suggestions = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify({
            'success': True,
            'data': suggestions,
            'count': len(suggestions)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/meals/<int:meal_id>/leftover-settings', methods=['PUT'])
@login_required
def update_leftover_settings(meal_id):
    """Update leftover settings for a meal"""
    try:
        user_id = get_current_user_id()
        data = request.json
        makes_leftovers = data.get('makes_leftovers', False)
        servings = int(data.get('leftover_servings', 0))
        days = int(data.get('leftover_days', 1))

        # Verify meal ownership
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
        meal = cursor.fetchone()
        conn.close()

        if not meal:
            return jsonify({
                'success': False,
                'error': 'Meal not found or access denied'
            }), 404

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
@login_required
def get_school_menu():
    """Get school menu - supports ?date= or ?start_date&end_date"""
    try:
        user_id = get_current_user_id()
        date = request.args.get('date')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        days = request.args.get('days', 7, type=int)

        if date:
            # Get menu for specific date
            menu_items = db.get_school_menu_by_date(date, user_id)
        elif start_date and end_date:
            menu_items = db.get_school_menu_range(start_date, end_date, user_id)
        else:
            menu_items = db.get_upcoming_school_menu(days, user_id)

        return jsonify({
            'success': True,
            'data': menu_items,
            'count': len(menu_items)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/date/<date>', methods=['GET'])
@login_required
def get_school_menu_by_date(date):
    """Get school menu for a specific date"""
    try:
        user_id = get_current_user_id()
        menu_items = db.get_school_menu_by_date(date, user_id)
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
@login_required
def add_school_menu():
    """Add school menu item(s) - single or bulk upload"""
    try:
        user_id = get_current_user_id()
        data = request.json

        # Check if bulk upload (with items array or direct array)
        if 'items' in data and isinstance(data['items'], list):
            # Bulk upload with {items: [...]}
            added_count = db.add_school_menu_bulk(data['items'], user_id)
            return jsonify({
                'success': True,
                'data': {'added_count': added_count},
                'message': f'Added {added_count} menu items'
            })
        elif isinstance(data, list):
            # Direct array format
            added_count = db.add_school_menu_bulk(data, user_id)
            return jsonify({
                'success': True,
                'data': {'added_count': added_count},
                'message': f'Added {added_count} menu items'
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

            menu_id = db.add_school_menu_item(menu_date, meal_name, meal_type, description, user_id)

            if menu_id:
                return jsonify({
                    'success': True,
                    'data': {'menu_id': menu_id},
                    'message': 'Menu item added'
                }), 201
            else:
                return jsonify({
                    'success': False,
                    'error': 'Menu item already exists for this date'
                }), 409

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/<int:menu_id>', methods=['DELETE'])
@login_required
def delete_school_menu(menu_id):
    """Delete a school menu item"""
    try:
        user_id = get_current_user_id()
        deleted_count = db.delete_school_menu_item(menu_id, user_id)

        if deleted_count == 0:
            return jsonify({
                'success': False,
                'error': 'Menu item not found or access denied'
            }), 404

        return jsonify({
            'success': True,
            'message': 'Menu item deleted'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/feedback', methods=['POST'])
@login_required
def add_menu_feedback():
    """Add feedback about a school menu item"""
    try:
        user_id = get_current_user_id()
        data = request.json
        menu_item_id = data.get('menu_item_id')
        feedback_type = data.get('feedback_type')  # disliked, allergic, wont_eat
        notes = data.get('notes')

        if not menu_item_id or not feedback_type:
            return jsonify({
                'success': False,
                'error': 'menu_item_id and feedback_type are required'
            }), 400

        # Verify the menu item exists and belongs to this user
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM school_menu_items WHERE id = ? AND user_id = ?", (menu_item_id, user_id))
        menu_item = cursor.fetchone()
        conn.close()

        if not menu_item:
            return jsonify({
                'success': False,
                'error': 'Menu item not found or access denied'
            }), 404

        feedback_id = db.add_menu_feedback(menu_item_id, feedback_type, notes, user_id)

        return jsonify({
            'success': True,
            'data': {'feedback_id': feedback_id},
            'message': 'Feedback recorded'
        }), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/lunch-alternatives/<date>', methods=['GET'])
@login_required
def get_lunch_alternatives(date):
    """Get smart lunch alternatives for a specific date"""
    try:
        user_id = get_current_user_id()
        alternatives = db.suggest_lunch_alternatives(date, user_id)
        return jsonify({
            'success': True,
            'data': alternatives
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/cleanup', methods=['POST'])
@login_required
def cleanup_old_menus():
    """Clean up old school menu items"""
    try:
        user_id = get_current_user_id()
        data = request.get_json() or {}
        days_ago = data.get('days_ago', 30)
        deleted_count = db.clear_old_school_menus(days_ago, user_id)
        return jsonify({
            'success': True,
            'data': {'deleted_count': deleted_count},
            'message': f'Deleted {deleted_count} old menu items'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/parse-photo', methods=['POST'])
@login_required
def parse_menu_photo():
    """Parse school menu from uploaded photo using Claude Vision"""
    if not vision_parser:
        return jsonify({
            'success': False,
            'error': 'Vision parser is not configured. Please set ANTHROPIC_API_KEY'
        }), 503

    try:
        user_id = get_current_user_id()
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
            added_count = db.add_school_menu_bulk(menu_items, user_id)

        return jsonify({
            'success': True,
            'data': {
                'menu_items': menu_items,
                'count': len(menu_items),
                'added_count': added_count if auto_add else 0
            },
            'message': f'Parsed {len(menu_items)} menu items' + (f' and added {added_count} to database' if auto_add else '')
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/school-menu/calendar', methods=['GET'])
@login_required
def get_school_menu_calendar():
    """Get school menu in calendar format for table view"""
    try:
        user_id = get_current_user_id()
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

        menu_items = db.get_school_menu_range(start_date, end_date, user_id)

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

@app.route('/manifest.json')
def serve_manifest():
    """Serve manifest.json with correct MIME type"""
    return send_from_directory('templates', 'manifest.json', mimetype='application/json')

@app.route('/service-worker.js')
def serve_service_worker():
    """Serve service-worker.js with correct MIME type"""
    return send_from_directory('templates', 'service-worker.js', mimetype='application/javascript')

@app.route('/favicon.ico')
def serve_favicon():
    """Serve favicon.ico"""
    return send_from_directory('templates', 'favicon.ico', mimetype='image/x-icon')

@app.route('/logo192.png')
def serve_logo192():
    """Serve logo192.png for PWA"""
    return send_from_directory('templates', 'logo192.png', mimetype='image/png')

@app.route('/logo512.png')
def serve_logo512():
    """Serve logo512.png for PWA"""
    return send_from_directory('templates', 'logo512.png', mimetype='image/png')

# ============================================================================
# BENTO BOX API ENDPOINTS
# ============================================================================

@app.route('/api/bento-items', methods=['GET'])
@login_required
def get_bento_items():
    """Get all bento items"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, category, is_favorite, allergens, notes, prep_time_minutes, created_at
            FROM bento_items
            WHERE user_id = ?
            ORDER BY category, name
        """, (user_id,))

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'name': row[1],
                'category': row[2],
                'is_favorite': bool(row[3]),
                'allergens': row[4],
                'notes': row[5],
                'prep_time_minutes': row[6],
                'created_at': row[7]
            })

        conn.close()
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        print(f"Error getting bento items: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bento-items', methods=['POST'])
@login_required
def create_bento_item():
    """Create a new bento item"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()

        # Validate required fields
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Item name is required'}), 400
        if not data.get('category'):
            return jsonify({'success': False, 'error': 'Category is required'}), 400

        # Validate category
        valid_categories = ['protein', 'fruit', 'vegetable', 'grain', 'dairy', 'snack']
        if data.get('category') not in valid_categories:
            return jsonify({'success': False, 'error': f'Invalid category. Must be one of: {", ".join(valid_categories)}'}), 400

        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO bento_items (name, category, is_favorite, allergens, notes, prep_time_minutes, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data['name'].strip(),
            data['category'],
            data.get('is_favorite', False),
            data.get('allergens', '').strip() if data.get('allergens') else None,
            data.get('notes', '').strip() if data.get('notes') else None,
            data.get('prep_time_minutes'),
            user_id
        ))

        item_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'id': item_id})
    except KeyError as e:
        return jsonify({'success': False, 'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        print(f"Error creating bento item: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Failed to create bento item. Please try again.'}), 500

@app.route('/api/bento-items/<int:item_id>', methods=['PUT'])
@login_required
def update_bento_item(item_id):
    """Update a bento item"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()

        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM bento_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Bento item not found'}), 404

        cursor.execute("""
            UPDATE bento_items
            SET name = ?, category = ?, is_favorite = ?, allergens = ?, notes = ?, prep_time_minutes = ?
            WHERE id = ? AND user_id = ?
        """, (
            data['name'],
            data['category'],
            data.get('is_favorite', False),
            data.get('allergens'),
            data.get('notes'),
            data.get('prep_time_minutes'),
            item_id,
            user_id
        ))

        conn.commit()
        conn.close()

        return jsonify({'success': True})
    except Exception as e:
        print(f"Error updating bento item: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bento-items/<int:item_id>', methods=['DELETE'])
@login_required
def delete_bento_item(item_id):
    """Delete a bento item"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM bento_items WHERE id = ? AND user_id = ?", (item_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Bento item not found'}), 404

        cursor.execute("DELETE FROM bento_items WHERE id = ? AND user_id = ?", (item_id, user_id))

        conn.commit()
        conn.close()

        return jsonify({'success': True})
    except Exception as e:
        print(f"Error deleting bento item: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bento-plans', methods=['GET'])
@login_required
def get_bento_plans():
    """Get bento plans for a date range"""
    try:
        user_id = get_current_user_id()
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        conn = db.connect()
        cursor = conn.cursor()

        query = """
            SELECT bp.id, bp.date, bp.child_name, bp.notes,
                   bi1.id, bi1.name, bi1.category,
                   bi2.id, bi2.name, bi2.category,
                   bi3.id, bi3.name, bi3.category,
                   bi4.id, bi4.name, bi4.category
            FROM bento_plans bp
            LEFT JOIN bento_items bi1 ON bp.compartment1_item_id = bi1.id
            LEFT JOIN bento_items bi2 ON bp.compartment2_item_id = bi2.id
            LEFT JOIN bento_items bi3 ON bp.compartment3_item_id = bi3.id
            LEFT JOIN bento_items bi4 ON bp.compartment4_item_id = bi4.id
            WHERE bp.user_id = ?
        """

        params = [user_id]
        if start_date and end_date:
            query += " AND bp.date BETWEEN ? AND ?"
            params.extend([start_date, end_date])

        query += " ORDER BY bp.date"

        cursor.execute(query, params)

        plans = []
        for row in cursor.fetchall():
            plans.append({
                'id': row[0],
                'date': row[1],
                'child_name': row[2],
                'notes': row[3],
                'compartment1': {'id': row[4], 'name': row[5], 'category': row[6]} if row[4] else None,
                'compartment2': {'id': row[7], 'name': row[8], 'category': row[9]} if row[7] else None,
                'compartment3': {'id': row[10], 'name': row[11], 'category': row[12]} if row[10] else None,
                'compartment4': {'id': row[13], 'name': row[14], 'category': row[15]} if row[13] else None
            })

        conn.close()
        return jsonify({'success': True, 'plans': plans})
    except Exception as e:
        print(f"Error getting bento plans: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bento-plans', methods=['POST'])
@login_required
def create_bento_plan():
    """Create a new bento plan"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()

        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO bento_plans (date, child_name, compartment1_item_id, compartment2_item_id,
                                   compartment3_item_id, compartment4_item_id, notes, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data['date'],
            data.get('child_name'),
            data.get('compartment1_item_id'),
            data.get('compartment2_item_id'),
            data.get('compartment3_item_id'),
            data.get('compartment4_item_id'),
            data.get('notes'),
            user_id
        ))

        plan_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'id': plan_id})
    except Exception as e:
        print(f"Error creating bento plan: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bento-plans/<int:plan_id>', methods=['PUT'])
@login_required
def update_bento_plan(plan_id):
    """Update a bento plan"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()

        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM bento_plans WHERE id = ? AND user_id = ?", (plan_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Bento plan not found'}), 404

        cursor.execute("""
            UPDATE bento_plans
            SET child_name = ?, compartment1_item_id = ?, compartment2_item_id = ?,
                compartment3_item_id = ?, compartment4_item_id = ?, notes = ?
            WHERE id = ? AND user_id = ?
        """, (
            data.get('child_name'),
            data.get('compartment1_item_id'),
            data.get('compartment2_item_id'),
            data.get('compartment3_item_id'),
            data.get('compartment4_item_id'),
            data.get('notes'),
            plan_id,
            user_id
        ))

        conn.commit()
        conn.close()

        return jsonify({'success': True})
    except Exception as e:
        print(f"Error updating bento plan: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bento-plans/<int:plan_id>', methods=['DELETE'])
@login_required
def delete_bento_plan(plan_id):
    """Delete a bento plan"""
    try:
        user_id = get_current_user_id()
        conn = db.connect()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM bento_plans WHERE id = ? AND user_id = ?", (plan_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Bento plan not found'}), 404

        cursor.execute("DELETE FROM bento_plans WHERE id = ? AND user_id = ?", (plan_id, user_id))

        conn.commit()
        conn.close()

        return jsonify({'success': True})
    except Exception as e:
        print(f"Error deleting bento plan: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bento-plans/generate-week', methods=['POST'])
@login_required
def generate_weekly_bento_plans():
    """Generate bento plans for a week with variety"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()

        # Validate required fields
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        if not data.get('start_date'):
            return jsonify({'success': False, 'error': 'Start date is required'}), 400

        start_date = data['start_date']
        child_name = data.get('child_name', '')

        conn = db.connect()
        cursor = conn.cursor()

        # Get all available bento items grouped by category
        cursor.execute("""
            SELECT id, name, category
            FROM bento_items
            WHERE user_id = ?
            ORDER BY is_favorite DESC, RANDOM()
        """, (user_id,))

        items_by_category = {}
        total_items = 0
        for row in cursor.fetchall():
            total_items += 1
            category = row[2]
            if category not in items_by_category:
                items_by_category[category] = []
            items_by_category[category].append({'id': row[0], 'name': row[1]})

        # Check if we have enough items
        if total_items < 4:
            conn.close()
            return jsonify({'success': False, 'error': f'Need at least 4 bento items to generate a week. You currently have {total_items}. Please add more items first.'}), 400

        if len(items_by_category) < 2:
            conn.close()
            return jsonify({'success': False, 'error': f'Need items from at least 2 different categories. You currently have items from {len(items_by_category)} category. Please add variety.'}), 400

        # Generate 5 days of bento boxes (Monday-Friday)
        from datetime import datetime, timedelta
        start = datetime.strptime(start_date, '%Y-%m-%d')

        plans_created = []
        used_items = set()  # Track used items to maximize variety

        for day_offset in range(5):
            current_date = start + timedelta(days=day_offset)
            date_str = current_date.strftime('%Y-%m-%d')

            # Select 4 different items from different categories
            compartments = [None, None, None, None]
            categories_used = set()

            for i in range(4):
                # Find a category we haven't used yet for this bento
                available_categories = [c for c in items_by_category.keys() if c not in categories_used]

                if available_categories:
                    # Pick a category
                    category = random.choice(available_categories)
                    categories_used.add(category)

                    # Pick an item from this category, preferring ones we haven't used recently
                    available_items = [item for item in items_by_category[category] if item['id'] not in used_items]
                    if not available_items:
                        available_items = items_by_category[category]  # Use any if all have been used

                    if available_items:
                        item = random.choice(available_items)
                        compartments[i] = item['id']
                        used_items.add(item['id'])

                        # Clear used_items tracking after 10 items to allow reuse
                        if len(used_items) > 10:
                            used_items = set()

            # Create the bento plan
            cursor.execute("""
                INSERT INTO bento_plans (date, child_name, compartment1_item_id, compartment2_item_id,
                                       compartment3_item_id, compartment4_item_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (date_str, child_name, compartments[0], compartments[1], compartments[2], compartments[3], user_id))

            plans_created.append({
                'id': cursor.lastrowid,
                'date': date_str
            })

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'plans': plans_created, 'message': f'Successfully created {len(plans_created)} bento plans for the week!'})
    except ValueError as e:
        return jsonify({'success': False, 'error': f'Invalid date format. Please use YYYY-MM-DD format. Error: {str(e)}'}), 400
    except Exception as e:
        print(f"Error generating weekly bento plans: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Failed to generate weekly bento plans. Please check your items and try again.'}), 500


# ============================================================================
# ERROR LOGGING & DIAGNOSTICS API ENDPOINTS
# ============================================================================

@app.route('/api/errors/log', methods=['POST'])
def log_error():
    """Log frontend or backend errors for diagnostics"""
    try:
        data = request.get_json()

        # Extract error details
        error_type = data.get('error_type', 'unknown')
        message = data.get('message', 'No message provided')
        stack_trace = data.get('stack_trace')
        component = data.get('component')
        url = data.get('url')
        browser_info = json.dumps(data.get('browser_info', {}))
        metadata = json.dumps(data.get('metadata', {}))

        # Get user info if authenticated
        user_id = None
        try:
            user_id = get_current_user_id()
        except:
            pass  # Not authenticated, that's okay

        # Get session ID
        session_id = session.get('session_id', request.headers.get('X-Session-ID'))

        # Insert error log
        with db_connection(db) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO error_logs
                (error_type, message, stack_trace, component, url, user_id, session_id, browser_info, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (error_type, message, stack_trace, component, url, user_id, session_id, browser_info, metadata))
            conn.commit()
            error_id = cursor.lastrowid

        print(f"🔴 Error logged [ID: {error_id}]: {error_type} - {message}")

        return jsonify({'success': True, 'error_id': error_id})
    except Exception as e:
        print(f"Failed to log error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Failed to log error'}), 500


@app.route('/api/errors', methods=['GET'])
@login_required
def get_errors():
    """Get recent errors for diagnostics (admin only)"""
    try:
        # Optional filters
        limit = request.args.get('limit', 100, type=int)
        limit = min(limit, 500)  # Cap at 500

        resolved = request.args.get('resolved')
        error_type = request.args.get('type')

        with db_connection(db) as conn:
            cursor = conn.cursor()

            # Build query
            query = "SELECT * FROM error_logs WHERE 1=1"
            params = []

            if resolved is not None:
                query += " AND resolved = ?"
                params.append(1 if resolved == 'true' else 0)

            if error_type:
                query += " AND error_type = ?"
                params.append(error_type)

            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            errors = [dict(row) for row in cursor.fetchall()]

        # Parse JSON fields
        for error in errors:
            if error.get('browser_info'):
                try:
                    error['browser_info'] = json.loads(error['browser_info'])
                except:
                    pass
            if error.get('metadata'):
                try:
                    error['metadata'] = json.loads(error['metadata'])
                except:
                    pass

        return jsonify({'success': True, 'data': errors})
    except Exception as e:
        print(f"Failed to fetch errors: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Failed to fetch errors'}), 500


@app.route('/api/errors/<int:error_id>/resolve', methods=['PUT'])
@login_required
def resolve_error(error_id):
    """Mark an error as resolved"""
    try:
        data = request.get_json()
        notes = data.get('notes', '')

        user = get_current_user()
        resolved_by = user.get('username', 'unknown')

        with db_connection(db) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE error_logs
                SET resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, notes = ?
                WHERE id = ?
            """, (resolved_by, notes, error_id))
            conn.commit()

        return jsonify({'success': True, 'message': 'Error marked as resolved'})
    except Exception as e:
        print(f"Failed to resolve error: {e}")
        return jsonify({'success': False, 'error': 'Failed to resolve error'}), 500


@app.route('/api/errors/stats', methods=['GET'])
@login_required
def get_error_stats():
    """Get error statistics for dashboard"""
    try:
        with db_connection(db) as conn:
            cursor = conn.cursor()

            # Total errors
            cursor.execute("SELECT COUNT(*) as total FROM error_logs")
            total = cursor.fetchone()['total']

            # Unresolved errors
            cursor.execute("SELECT COUNT(*) as unresolved FROM error_logs WHERE resolved = 0")
            unresolved = cursor.fetchone()['unresolved']

            # Errors by type
            cursor.execute("""
                SELECT error_type, COUNT(*) as count
                FROM error_logs
                WHERE resolved = 0
                GROUP BY error_type
                ORDER BY count DESC
            """)
            by_type = [dict(row) for row in cursor.fetchall()]

            # Recent errors (last 24 hours)
            cursor.execute("""
                SELECT COUNT(*) as recent
                FROM error_logs
                WHERE timestamp > datetime('now', '-24 hours')
            """)
            recent_24h = cursor.fetchone()['recent']

            # Most common errors
            cursor.execute("""
                SELECT message, COUNT(*) as count
                FROM error_logs
                WHERE resolved = 0
                GROUP BY message
                ORDER BY count DESC
                LIMIT 5
            """)
            top_errors = [dict(row) for row in cursor.fetchall()]

        return jsonify({
            'success': True,
            'data': {
                'total': total,
                'unresolved': unresolved,
                'recent_24h': recent_24h,
                'by_type': by_type,
                'top_errors': top_errors
            }
        })
    except Exception as e:
        print(f"Failed to fetch error stats: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Failed to fetch error stats'}), 500


@app.route('/api/errors/analyze', methods=['POST'])
@login_required
def analyze_errors_with_ai():
    """Use Claude AI to analyze errors and provide debugging insights"""
    try:
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            return jsonify({'success': False, 'error': 'AI analysis requires ANTHROPIC_API_KEY'}), 500

        data = request.get_json()
        error_ids = data.get('error_ids', [])

        if not error_ids:
            return jsonify({'success': False, 'error': 'No error IDs provided'}), 400

        # Fetch the requested errors
        with db_connection(db) as conn:
            cursor = conn.cursor()
            placeholders = ','.join(['?' for _ in error_ids])
            cursor.execute(f"""
                SELECT * FROM error_logs
                WHERE id IN ({placeholders})
                ORDER BY timestamp DESC
            """, error_ids)
            errors = [dict(row) for row in cursor.fetchall()]

        if not errors:
            return jsonify({'success': False, 'error': 'No errors found'}), 404

        # Prepare error summary for Claude
        error_summary = []
        for error in errors:
            error_info = {
                'id': error['id'],
                'type': error['error_type'],
                'message': error['message'],
                'stack_trace': error['stack_trace'],
                'component': error['component'],
                'url': error['url'],
                'timestamp': error['timestamp']
            }

            # Parse metadata if available
            if error.get('metadata'):
                try:
                    error_info['metadata'] = json.loads(error['metadata'])
                except:
                    pass

            error_summary.append(error_info)

        # Call Claude AI for analysis
        client = anthropic.Anthropic(api_key=api_key)

        prompt = f"""You are a debugging assistant. Analyze these production errors from a Family Meal Planning web application and provide actionable insights.

Errors to analyze:
{json.dumps(error_summary, indent=2)}

Please provide:
1. **Root Cause Analysis**: What's likely causing each error?
2. **Priority**: Which errors should be fixed first and why?
3. **Suggested Fixes**: Specific code changes or approaches to resolve each error
4. **Patterns**: Are there any common patterns across these errors?
5. **Prevention**: How to prevent similar errors in the future?

Format your response in clear sections with markdown."""

        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        analysis = message.content[0].text

        return jsonify({
            'success': True,
            'data': {
                'analysis': analysis,
                'error_count': len(errors),
                'analyzed_ids': error_ids
            }
        })

    except Exception as e:
        print(f"Failed to analyze errors: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Failed to analyze errors: {str(e)}'}), 500


@app.route('/api/errors/export-for-claude', methods=['GET'])
@login_required
def export_errors_for_claude():
    """Export errors in a format optimized for Claude Code debugging"""
    try:
        # Get filters
        limit = request.args.get('limit', 20, type=int)
        limit = min(limit, 100)  # Cap at 100
        resolved = request.args.get('resolved', 'false')

        with db_connection(db) as conn:
            cursor = conn.cursor()

            query = """
                SELECT id, timestamp, error_type, message, stack_trace, component, url, metadata
                FROM error_logs
                WHERE resolved = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """

            cursor.execute(query, (1 if resolved == 'true' else 0, limit))
            errors = [dict(row) for row in cursor.fetchall()]

        # Format for Claude Code
        claude_report = {
            'report_generated': datetime.now().isoformat(),
            'total_errors': len(errors),
            'application': 'Family Meal Planner',
            'errors': []
        }

        for error in errors:
            # Parse metadata
            metadata = {}
            if error.get('metadata'):
                try:
                    metadata = json.loads(error['metadata'])
                except:
                    pass

            claude_report['errors'].append({
                'error_id': error['id'],
                'timestamp': error['timestamp'],
                'type': error['error_type'],
                'message': error['message'],
                'stack_trace': error['stack_trace'],
                'component': error['component'],
                'url': error['url'],
                'context': metadata.get('currentPath'),
                'metadata': metadata
            })

        # Create a formatted text report for easy copying
        text_report = f"""# Error Report for Claude Code Debugging
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Total Errors: {len(errors)}

## Error Summary
"""

        for i, err in enumerate(claude_report['errors'], 1):
            text_report += f"""
---
### Error #{i} (ID: {err['error_id']})
- **Type:** {err['type']}
- **Time:** {err['timestamp']}
- **Component:** {err['component'] or 'N/A'}
- **Message:** {err['message']}
- **URL:** {err['url'] or 'N/A'}

**Stack Trace:**
```
{err['stack_trace'] or 'No stack trace available'}
```

**Context:**
{json.dumps(err['metadata'], indent=2) if err['metadata'] else 'No additional context'}
"""

        return jsonify({
            'success': True,
            'data': {
                'structured': claude_report,
                'text_report': text_report,
                'markdown_report': text_report
            }
        })

    except Exception as e:
        print(f"Failed to export errors: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Failed to export errors'}), 500


@app.route('/api/errors/setup-table', methods=['POST', 'GET'])
def setup_error_logs_table():
    """
    Emergency endpoint to create error_logs table if it doesn't exist
    This fixes the 'no such table: error_logs' error
    Note: No login required since this is needed to fix the error tracking system itself
    """
    try:
        with db_connection(db) as conn:
            cursor = conn.cursor()

            # Check if table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='error_logs'")
            if cursor.fetchone():
                return jsonify({'success': True, 'message': 'Table already exists'})

            # Create table
            print("🔧 Creating error_logs table...")
            cursor.execute("""
                CREATE TABLE error_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    error_type VARCHAR(50) NOT NULL,
                    message TEXT NOT NULL,
                    stack_trace TEXT,
                    component VARCHAR(255),
                    url VARCHAR(500),
                    user_id INTEGER,
                    session_id VARCHAR(255),
                    browser_info TEXT,
                    metadata TEXT,
                    resolved BOOLEAN DEFAULT 0,
                    resolved_at DATETIME,
                    resolved_by VARCHAR(255),
                    notes TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            """)

            # Create indexes
            cursor.execute("CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC)")
            cursor.execute("CREATE INDEX idx_error_logs_type ON error_logs(error_type)")
            cursor.execute("CREATE INDEX idx_error_logs_resolved ON error_logs(resolved)")
            cursor.execute("CREATE INDEX idx_error_logs_user ON error_logs(user_id)")

            conn.commit()
            print("✅ error_logs table created successfully!")

            return jsonify({'success': True, 'message': 'Table created successfully'})

    except Exception as e:
        print(f"Failed to setup error_logs table: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# CATCH-ALL ROUTE FOR REACT ROUTER
# ============================================================================
# Note: Flask automatically serves files from templates/static at /static/
# because we configured static_folder='templates/static' when creating the app

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """
    Serve React app for all non-API routes.
    This enables React Router to handle client-side routing.
    """
    # If the path starts with 'api/', return 404 (static is handled automatically)
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404

    # Otherwise serve React's index.html
    return render_template('index.html')


# ============================================================================
# ENSURE ERROR_LOGS TABLE EXISTS (runs on module load for Gunicorn)
# ============================================================================
# This must run outside __main__ to work with Gunicorn in production
try:
    with db_connection(db) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='error_logs'")
        if not cursor.fetchone():
            print("🔧 Creating error_logs table (missing from migrations)...")
            cursor.execute("""
                CREATE TABLE error_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    error_type VARCHAR(50) NOT NULL,
                    message TEXT NOT NULL,
                    stack_trace TEXT,
                    component VARCHAR(255),
                    url VARCHAR(500),
                    user_id INTEGER,
                    session_id VARCHAR(255),
                    browser_info TEXT,
                    metadata TEXT,
                    resolved BOOLEAN DEFAULT 0,
                    resolved_at DATETIME,
                    resolved_by VARCHAR(255),
                    notes TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            """)
            cursor.execute("CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC)")
            cursor.execute("CREATE INDEX idx_error_logs_type ON error_logs(error_type)")
            cursor.execute("CREATE INDEX idx_error_logs_resolved ON error_logs(resolved)")
            cursor.execute("CREATE INDEX idx_error_logs_user ON error_logs(user_id)")
            conn.commit()
            print("✅ error_logs table created successfully!")
        else:
            print("✓ error_logs table already exists")
except Exception as e:
    print(f"⚠️ Error checking/creating error_logs table: {e}")
    traceback.print_exc()


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
            migration_file = 'database/migrations/add_school_menu_feature.sql'
            if os.path.exists(migration_file):
                with open(migration_file, 'r') as f:
                    cursor.executescript(f.read())
                conn.commit()
                print("✅ School menu feature added!")
            else:
                print(f"⚠️  Migration file not found: {migration_file}")
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

    # Run migration for shopping_items table if needed
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='shopping_items'")
        if not cursor.fetchone():
            print("🔄 Running shopping items migration...")
            from database.migrations.add_shopping_items_table import migrate_add_shopping_items
            migrate_add_shopping_items(db.db_path)
            print("✅ Shopping items table added!")
        conn.close()
    except Exception as e:
        print(f"⚠️  Shopping items migration check: {e}")

    # Run migration for cuisine column if needed
    try:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(meals)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'cuisine' not in columns:
            print("🔄 Running cuisine column migration...")
            from database.migrations.add_cuisine import migrate
            migrate(db.db_path)
            print("✅ Cuisine column added!")
        else:
            print("✅ Cuisine column already exists")
        conn.close()
    except Exception as e:
        print(f"⚠️  Cuisine migration check: {e}")

    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', '1') == '1'

    print(f"\n{'='*60}")
    print(f"🍽️  Family Meal Planner Web App")
    print(f"{'='*60}")
    print(f"🌐 Running on http://localhost:{port}")
    print(f"🤖 AI Recipe Parser: {'Enabled' if recipe_parser else 'Disabled'}")
    print(f"{'='*60}\n")

    app.run(host='0.0.0.0', port=port, debug=debug)
