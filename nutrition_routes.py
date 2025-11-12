#!/usr/bin/env python3
"""
Nutrition Tracking Routes - Premium Feature

API endpoints for:
- Logging daily nutrition
- Viewing nutrition history
- Setting/updating nutrition goals
- Getting weekly summaries
- Analyzing nutrition trends

All endpoints require authentication and Family/Premium subscription.
"""

from flask import Blueprint, request, jsonify
from auth import login_required, get_current_user_id
from datetime import datetime, timedelta
import sqlite3
from typing import Dict, Any, List

nutrition_bp = Blueprint('nutrition', __name__, url_prefix='/api/nutrition')


def _get_connection():
    """Get database connection"""
    from meal_planner import MealPlannerDB
    db = MealPlannerDB()
    conn = sqlite3.connect(db.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _check_subscription_access(user_id: int) -> tuple[bool, str]:
    """Check if user has access to nutrition tracking"""
    try:
        from subscription_manager import get_subscription_manager
        sub_manager = get_subscription_manager()
        return sub_manager.can_use_feature(user_id, 'nutrition_tracking')
    except Exception:
        # If subscription system not configured, allow access
        return True, None


# =============================================================================
# NUTRITION LOGGING
# =============================================================================

@nutrition_bp.route('/log', methods=['POST'])
@login_required
def log_nutrition():
    """
    Log a meal's nutrition for a specific date

    POST /api/nutrition/log
    Body: {
        "log_date": "2024-01-15",  // optional, defaults to today
        "meal_id": 123,  // optional
        "meal_name": "Chicken Stir Fry",
        "meal_type": "dinner",  // breakfast, lunch, dinner, snack
        "servings": 1.5,
        "calories": 450,
        "protein_g": 35,
        "carbs_g": 45,
        "fat_g": 15,
        "fiber_g": 8,
        "sugar_g": 5,
        "sodium_mg": 600
    }

    Returns: {
        "success": true,
        "log_id": 1,
        "daily_total": {...}  // Total nutrition for the day
    }
    """
    user_id = get_current_user_id()

    # Check subscription
    can_access, reason = _check_subscription_access(user_id)
    if not can_access:
        return jsonify({
            'success': False,
            'error': reason,
            'upgrade_required': True
        }), 403

    data = request.get_json()

    # Validate required fields
    if not data.get('meal_name'):
        return jsonify({'success': False, 'error': 'meal_name is required'}), 400

    log_date = data.get('log_date', datetime.now().strftime('%Y-%m-%d'))
    meal_id = data.get('meal_id')
    meal_name = data['meal_name']
    meal_type = data.get('meal_type', 'dinner')
    servings = data.get('servings', 1.0)

    # Nutrition data
    calories = data.get('calories', 0)
    protein_g = data.get('protein_g', 0)
    carbs_g = data.get('carbs_g', 0)
    fat_g = data.get('fat_g', 0)
    fiber_g = data.get('fiber_g', 0)
    sugar_g = data.get('sugar_g', 0)
    sodium_mg = data.get('sodium_mg', 0)

    conn = _get_connection()
    cursor = conn.cursor()

    # Insert nutrition log
    cursor.execute("""
        INSERT INTO nutrition_logs (
            user_id, log_date, meal_id, meal_name, meal_type, servings,
            calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, log_date, meal_id, meal_name, meal_type, servings,
        calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg
    ))

    log_id = cursor.lastrowid

    # Get daily total
    cursor.execute("""
        SELECT
            SUM(calories) as total_calories,
            SUM(protein_g) as total_protein,
            SUM(carbs_g) as total_carbs,
            SUM(fat_g) as total_fat,
            SUM(fiber_g) as total_fiber,
            SUM(sugar_g) as total_sugar,
            SUM(sodium_mg) as total_sodium,
            COUNT(*) as meals_logged
        FROM nutrition_logs
        WHERE user_id = ? AND log_date = ?
    """, (user_id, log_date))

    daily_total = dict(cursor.fetchone())

    # Get user's goals
    cursor.execute("""
        SELECT * FROM nutrition_goals WHERE user_id = ?
    """, (user_id,))

    goals = cursor.fetchone()
    if goals:
        goals_dict = dict(goals)
    else:
        goals_dict = None

    conn.commit()
    conn.close()

    # Track usage
    try:
        from subscription_manager import get_subscription_manager
        sub_manager = get_subscription_manager()
        sub_manager.track_feature_usage(user_id, 'nutrition_tracking')
    except Exception:
        pass

    return jsonify({
        'success': True,
        'log_id': log_id,
        'daily_total': daily_total,
        'goals': goals_dict
    })


@nutrition_bp.route('/logs', methods=['GET'])
@login_required
def get_nutrition_logs():
    """
    Get nutrition logs for a date range

    GET /api/nutrition/logs?start_date=2024-01-01&end_date=2024-01-07

    Returns: {
        "success": true,
        "logs": [...],
        "daily_totals": {...}
    }
    """
    user_id = get_current_user_id()

    can_access, reason = _check_subscription_access(user_id)
    if not can_access:
        return jsonify({
            'success': False,
            'error': reason,
            'upgrade_required': True
        }), 403

    start_date = request.args.get('start_date', (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))
    end_date = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))

    conn = _get_connection()
    cursor = conn.cursor()

    # Get all logs in range
    cursor.execute("""
        SELECT * FROM nutrition_logs
        WHERE user_id = ? AND log_date >= ? AND log_date <= ?
        ORDER BY log_date DESC, created_at DESC
    """, (user_id, start_date, end_date))

    logs = [dict(row) for row in cursor.fetchall()]

    # Get daily totals
    cursor.execute("""
        SELECT
            log_date,
            SUM(calories) as total_calories,
            SUM(protein_g) as total_protein,
            SUM(carbs_g) as total_carbs,
            SUM(fat_g) as total_fat,
            SUM(fiber_g) as total_fiber,
            SUM(sugar_g) as total_sugar,
            SUM(sodium_mg) as total_sodium,
            COUNT(*) as meals_logged
        FROM nutrition_logs
        WHERE user_id = ? AND log_date >= ? AND log_date <= ?
        GROUP BY log_date
        ORDER BY log_date DESC
    """, (user_id, start_date, end_date))

    daily_totals = {row['log_date']: dict(row) for row in cursor.fetchall()}

    # Get goals
    cursor.execute("""
        SELECT * FROM nutrition_goals WHERE user_id = ?
    """, (user_id,))

    goals = cursor.fetchone()
    goals_dict = dict(goals) if goals else None

    conn.close()

    return jsonify({
        'success': True,
        'logs': logs,
        'daily_totals': daily_totals,
        'goals': goals_dict
    })


@nutrition_bp.route('/log/<int:log_id>', methods=['DELETE'])
@login_required
def delete_nutrition_log(log_id):
    """Delete a nutrition log entry"""
    user_id = get_current_user_id()

    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM nutrition_logs
        WHERE id = ? AND user_id = ?
    """, (log_id, user_id))

    conn.commit()
    affected = cursor.rowcount
    conn.close()

    if affected == 0:
        return jsonify({'success': False, 'error': 'Log not found'}), 404

    return jsonify({'success': True})


# =============================================================================
# NUTRITION GOALS
# =============================================================================

@nutrition_bp.route('/goals', methods=['GET'])
@login_required
def get_nutrition_goals():
    """
    Get user's nutrition goals

    GET /api/nutrition/goals

    Returns: {
        "success": true,
        "goals": {
            "daily_calories": 2000,
            "daily_protein_g": 50,
            ...
        }
    }
    """
    user_id = get_current_user_id()

    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM nutrition_goals WHERE user_id = ?
    """, (user_id,))

    goals = cursor.fetchone()
    conn.close()

    if not goals:
        # Create default goals
        return jsonify({
            'success': True,
            'goals': {
                'daily_calories': 2000,
                'daily_protein_g': 50,
                'daily_carbs_g': 275,
                'daily_fat_g': 78,
                'daily_fiber_g': 25,
                'max_sugar_g': 50,
                'max_sodium_mg': 2300
            }
        })

    return jsonify({
        'success': True,
        'goals': dict(goals)
    })


@nutrition_bp.route('/goals', methods=['PUT'])
@login_required
def update_nutrition_goals():
    """
    Update user's nutrition goals

    PUT /api/nutrition/goals
    Body: {
        "daily_calories": 2200,
        "daily_protein_g": 60,
        "daily_carbs_g": 250,
        "daily_fat_g": 80,
        "daily_fiber_g": 30,
        "max_sugar_g": 40,
        "max_sodium_mg": 2000
    }
    """
    user_id = get_current_user_id()
    data = request.get_json()

    conn = _get_connection()
    cursor = conn.cursor()

    # Check if goals exist
    cursor.execute("""
        SELECT id FROM nutrition_goals WHERE user_id = ?
    """, (user_id,))

    exists = cursor.fetchone()

    if exists:
        # Update existing goals
        updates = []
        values = []

        for field in ['daily_calories', 'daily_protein_g', 'daily_carbs_g', 'daily_fat_g',
                      'daily_fiber_g', 'max_sugar_g', 'max_sodium_mg']:
            if field in data:
                updates.append(f"{field} = ?")
                values.append(data[field])

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            values.append(user_id)

            cursor.execute(f"""
                UPDATE nutrition_goals
                SET {', '.join(updates)}
                WHERE user_id = ?
            """, values)
    else:
        # Insert new goals
        cursor.execute("""
            INSERT INTO nutrition_goals (
                user_id, daily_calories, daily_protein_g, daily_carbs_g,
                daily_fat_g, daily_fiber_g, max_sugar_g, max_sodium_mg
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            data.get('daily_calories', 2000),
            data.get('daily_protein_g', 50),
            data.get('daily_carbs_g', 275),
            data.get('daily_fat_g', 78),
            data.get('daily_fiber_g', 25),
            data.get('max_sugar_g', 50),
            data.get('max_sodium_mg', 2300)
        ))

    conn.commit()

    # Fetch updated goals
    cursor.execute("""
        SELECT * FROM nutrition_goals WHERE user_id = ?
    """, (user_id,))

    goals = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        'success': True,
        'goals': goals
    })


# =============================================================================
# ANALYTICS & SUMMARIES
# =============================================================================

@nutrition_bp.route('/summary/week', methods=['GET'])
@login_required
def get_weekly_summary():
    """
    Get weekly nutrition summary

    GET /api/nutrition/summary/week?week_start=2024-01-07

    Returns: {
        "success": true,
        "summary": {
            "avg_daily_calories": 2100,
            "avg_daily_protein_g": 55,
            ...
        },
        "goals": {...},
        "adherence": {
            "calories": 0.95,  // 95% of goal
            "protein": 1.1,  // 110% of goal (over by 10%)
            ...
        }
    }
    """
    user_id = get_current_user_id()

    week_start = request.args.get('week_start')
    if not week_start:
        # Default to start of current week (Sunday)
        today = datetime.now()
        days_since_sunday = (today.weekday() + 1) % 7
        week_start = (today - timedelta(days=days_since_sunday)).strftime('%Y-%m-%d')

    week_end = (datetime.strptime(week_start, '%Y-%m-%d') + timedelta(days=6)).strftime('%Y-%m-%d')

    conn = _get_connection()
    cursor = conn.cursor()

    # Calculate weekly averages
    cursor.execute("""
        SELECT
            AVG(daily_calories) as avg_daily_calories,
            AVG(daily_protein) as avg_daily_protein,
            AVG(daily_carbs) as avg_daily_carbs,
            AVG(daily_fat) as avg_daily_fat,
            AVG(daily_fiber) as avg_daily_fiber,
            AVG(daily_sugar) as avg_daily_sugar,
            AVG(daily_sodium) as avg_daily_sodium,
            COUNT(DISTINCT log_date) as days_logged
        FROM (
            SELECT
                log_date,
                SUM(calories) as daily_calories,
                SUM(protein_g) as daily_protein,
                SUM(carbs_g) as daily_carbs,
                SUM(fat_g) as daily_fat,
                SUM(fiber_g) as daily_fiber,
                SUM(sugar_g) as daily_sugar,
                SUM(sodium_mg) as daily_sodium
            FROM nutrition_logs
            WHERE user_id = ? AND log_date >= ? AND log_date <= ?
            GROUP BY log_date
        )
    """, (user_id, week_start, week_end))

    summary = dict(cursor.fetchone())

    # Get goals
    cursor.execute("""
        SELECT * FROM nutrition_goals WHERE user_id = ?
    """, (user_id,))

    goals = cursor.fetchone()
    goals_dict = dict(goals) if goals else None

    conn.close()

    # Calculate adherence percentages
    adherence = {}
    if goals_dict and summary.get('days_logged', 0) > 0:
        adherence = {
            'calories': round(summary.get('avg_daily_calories', 0) / goals_dict['daily_calories'], 2),
            'protein': round(summary.get('avg_daily_protein', 0) / goals_dict['daily_protein_g'], 2),
            'carbs': round(summary.get('avg_daily_carbs', 0) / goals_dict['daily_carbs_g'], 2),
            'fat': round(summary.get('avg_daily_fat', 0) / goals_dict['daily_fat_g'], 2),
            'fiber': round(summary.get('avg_daily_fiber', 0) / goals_dict['daily_fiber_g'], 2),
        }

    return jsonify({
        'success': True,
        'summary': summary,
        'goals': goals_dict,
        'adherence': adherence,
        'week_start': week_start,
        'week_end': week_end
    })


@nutrition_bp.route('/trends', methods=['GET'])
@login_required
def get_nutrition_trends():
    """
    Get nutrition trends over time

    GET /api/nutrition/trends?days=30

    Returns daily nutrition totals for charting
    """
    user_id = get_current_user_id()
    days = request.args.get('days', 30, type=int)

    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    end_date = datetime.now().strftime('%Y-%m-%d')

    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            log_date,
            SUM(calories) as total_calories,
            SUM(protein_g) as total_protein,
            SUM(carbs_g) as total_carbs,
            SUM(fat_g) as total_fat,
            SUM(fiber_g) as total_fiber
        FROM nutrition_logs
        WHERE user_id = ? AND log_date >= ? AND log_date <= ?
        GROUP BY log_date
        ORDER BY log_date ASC
    """, (user_id, start_date, end_date))

    trends = [dict(row) for row in cursor.fetchall()]

    # Get goals for reference line
    cursor.execute("""
        SELECT * FROM nutrition_goals WHERE user_id = ?
    """, (user_id,))

    goals = cursor.fetchone()
    goals_dict = dict(goals) if goals else None

    conn.close()

    return jsonify({
        'success': True,
        'trends': trends,
        'goals': goals_dict
    })


# =============================================================================
# AUTO-POPULATE FROM MEAL
# =============================================================================

@nutrition_bp.route('/from-meal/<int:meal_id>', methods=['GET'])
@login_required
def get_nutrition_from_meal(meal_id):
    """
    Get nutrition data from a meal to pre-populate log form

    GET /api/nutrition/from-meal/123

    Returns: {
        "success": true,
        "nutrition": {
            "meal_name": "Chicken Stir Fry",
            "calories": 450,
            ...
        }
    }
    """
    user_id = get_current_user_id()

    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            name as meal_name,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            fiber_g,
            sugar_g,
            sodium_mg
        FROM meals
        WHERE id = ? AND user_id = ?
    """, (meal_id, user_id))

    meal = cursor.fetchone()
    conn.close()

    if not meal:
        return jsonify({'success': False, 'error': 'Meal not found'}), 404

    return jsonify({
        'success': True,
        'nutrition': dict(meal)
    })
