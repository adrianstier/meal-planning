#!/usr/bin/env python3
"""
Analytics Dashboard Routes - Premium Feature

Provides insights and analytics about:
- Meal history and favorites
- Cooking patterns
- Time and money saved
- Cuisine diversity
- Kid ratings over time
- Shopping trends
"""

from flask import Blueprint, request, jsonify
from auth import login_required, get_current_user_id
from datetime import datetime, timedelta
import sqlite3
from typing import Dict, Any, List

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')


def _get_connection():
    """Get database connection"""
    from meal_planner import MealPlannerDB
    db = MealPlannerDB()
    conn = sqlite3.connect(db.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _check_subscription_access(user_id: int) -> tuple[bool, str]:
    """Check if user has access to analytics"""
    try:
        from subscription_manager import get_subscription_manager
        sub_manager = get_subscription_manager()
        return sub_manager.can_use_feature(user_id, 'analytics')
    except Exception as e:
        # Fail closed - deny access if subscription check fails
        return False, f"Unable to verify subscription: {str(e)}"


# =============================================================================
# DASHBOARD OVERVIEW
# =============================================================================

@analytics_bp.route('/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    """
    Get complete analytics dashboard data

    GET /api/analytics/dashboard?days=30

    Returns: {
        "success": true,
        "overview": {
            "total_recipes": 45,
            "total_meal_plans": 12,
            "meals_cooked": 38,
            "time_saved_hours": 42,
            "money_saved": 380
        },
        "top_recipes": [...],
        "cuisine_diversity": {...},
        "kid_favorites": [...],
        "recent_activity": [...]
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

    days = request.args.get('days', 30, type=int)
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    conn = _get_connection()
    cursor = conn.cursor()

    # Overview stats
    cursor.execute("""
        SELECT COUNT(*) as total_recipes FROM meals WHERE user_id = ?
    """, (user_id,))
    total_recipes = cursor.fetchone()['total_recipes']

    cursor.execute("""
        SELECT COUNT(DISTINCT meal_plan_id) as total_plans
        FROM scheduled_meals
        WHERE user_id = ?
    """, (user_id,))
    total_plans = cursor.fetchone()['total_plans']

    cursor.execute("""
        SELECT COUNT(*) as meals_cooked
        FROM meal_history
        WHERE user_id = ? AND cooked_date >= ?
    """, (user_id, start_date))
    meals_cooked = cursor.fetchone()['meals_cooked']

    # Calculate time saved (avg 45 min per meal not having to plan)
    time_saved_hours = round(meals_cooked * 0.75, 1)  # 45 minutes = 0.75 hours

    # Calculate money saved (avg $12 per meal vs eating out at $25)
    money_saved = round(meals_cooked * 13, 2)

    overview = {
        'total_recipes': total_recipes,
        'total_meal_plans': total_plans,
        'meals_cooked': meals_cooked,
        'time_saved_hours': time_saved_hours,
        'money_saved': money_saved,
        'avg_prep_time_minutes': 0,  # Will calculate below
        'days_tracked': days
    }

    # Top 10 most cooked recipes
    cursor.execute("""
        SELECT
            m.id,
            m.name,
            m.cuisine,
            COUNT(mh.id) as times_cooked,
            AVG(mh.rating) as avg_rating,
            m.prep_time_minutes + m.cook_time_minutes as total_time
        FROM meal_history mh
        JOIN meals m ON mh.meal_id = m.id
        WHERE mh.user_id = ? AND mh.cooked_date >= ?
        GROUP BY m.id
        ORDER BY times_cooked DESC
        LIMIT 10
    """, (user_id, start_date))

    top_recipes = [dict(row) for row in cursor.fetchall()]

    # Cuisine diversity
    cursor.execute("""
        SELECT
            m.cuisine,
            COUNT(mh.id) as times_cooked
        FROM meal_history mh
        JOIN meals m ON mh.meal_id = m.id
        WHERE mh.user_id = ? AND mh.cooked_date >= ?
        GROUP BY m.cuisine
        ORDER BY times_cooked DESC
    """, (user_id, start_date))

    cuisine_diversity = {row['cuisine']: row['times_cooked'] for row in cursor.fetchall()}

    # Kid favorites (highest rated meals)
    cursor.execute("""
        SELECT
            m.id,
            m.name,
            m.cuisine,
            AVG(mh.rating) as avg_rating,
            COUNT(mh.id) as times_cooked
        FROM meal_history mh
        JOIN meals m ON mh.meal_id = m.id
        WHERE mh.user_id = ? AND mh.rating >= 7 AND mh.cooked_date >= ?
        GROUP BY m.id
        HAVING COUNT(mh.id) >= 2  -- At least cooked twice
        ORDER BY avg_rating DESC, times_cooked DESC
        LIMIT 10
    """, (user_id, start_date))

    kid_favorites = [dict(row) for row in cursor.fetchall()]

    # Recent activity
    cursor.execute("""
        SELECT
            'cooked' as activity_type,
            m.name as meal_name,
            mh.cooked_date as activity_date,
            mh.rating
        FROM meal_history mh
        JOIN meals m ON mh.meal_id = m.id
        WHERE mh.user_id = ?
        ORDER BY mh.cooked_date DESC
        LIMIT 20
    """, (user_id,))

    recent_activity = [dict(row) for row in cursor.fetchall()]

    # Calculate average prep time
    cursor.execute("""
        SELECT AVG(m.prep_time_minutes + m.cook_time_minutes) as avg_time
        FROM meal_history mh
        JOIN meals m ON mh.meal_id = m.id
        WHERE mh.user_id = ? AND mh.cooked_date >= ?
    """, (user_id, start_date))

    avg_time = cursor.fetchone()['avg_time']
    overview['avg_prep_time_minutes'] = round(avg_time or 0, 1)

    conn.close()

    # Track usage
    try:
        from subscription_manager import get_subscription_manager
        sub_manager = get_subscription_manager()
        sub_manager.track_feature_usage(user_id, 'analytics')
    except Exception:
        pass

    return jsonify({
        'success': True,
        'overview': overview,
        'top_recipes': top_recipes,
        'cuisine_diversity': cuisine_diversity,
        'kid_favorites': kid_favorites,
        'recent_activity': recent_activity
    })


# =============================================================================
# TIME & MONEY TRACKING
# =============================================================================

@analytics_bp.route('/savings', methods=['GET'])
@login_required
def get_savings():
    """
    Calculate time and money saved vs eating out

    GET /api/analytics/savings?days=30

    Returns: {
        "success": true,
        "time_saved": {
            "hours": 42.5,
            "comparison": "Almost 2 full days!"
        },
        "money_saved": {
            "amount": 380,
            "comparison": "Enough for a nice dinner out"
        },
        "meals_cooked": 38,
        "avg_cost_per_meal": 8.5
    }
    """
    user_id = get_current_user_id()
    days = request.args.get('days', 30, type=int)
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(*) as meals_cooked
        FROM meal_history
        WHERE user_id = ? AND cooked_date >= ?
    """, (user_id, start_date))

    meals_cooked = cursor.fetchone()['meals_cooked']

    conn.close()

    # Assumptions:
    # - Eating out: $25 per meal
    # - Cooking at home: $8.50 per meal
    # - Time saved: 45 minutes per meal (no planning, shopping optimized)
    avg_restaurant_cost = 25.00
    avg_home_cost = 8.50
    time_per_meal_hours = 0.75

    money_saved = round((avg_restaurant_cost - avg_home_cost) * meals_cooked, 2)
    time_saved_hours = round(time_per_meal_hours * meals_cooked, 1)

    # Fun comparisons
    time_comparison = ""
    if time_saved_hours >= 24:
        days_saved = round(time_saved_hours / 24, 1)
        time_comparison = f"Almost {days_saved} full days!"
    elif time_saved_hours >= 8:
        time_comparison = "A full work day!"
    else:
        time_comparison = "Several hours of free time!"

    money_comparison = ""
    if money_saved >= 500:
        money_comparison = "Enough for a weekend getaway!"
    elif money_saved >= 200:
        money_comparison = "Enough for a nice dinner out!"
    elif money_saved >= 100:
        money_comparison = "A nice dinner for two!"
    else:
        money_comparison = "Building up savings!"

    return jsonify({
        'success': True,
        'time_saved': {
            'hours': time_saved_hours,
            'comparison': time_comparison
        },
        'money_saved': {
            'amount': money_saved,
            'comparison': money_comparison
        },
        'meals_cooked': meals_cooked,
        'avg_cost_per_meal': avg_home_cost
    })


# =============================================================================
# TRENDS & INSIGHTS
# =============================================================================

@analytics_bp.route('/trends/cooking-frequency', methods=['GET'])
@login_required
def get_cooking_frequency():
    """
    Get cooking frequency over time

    Returns daily/weekly cooking counts for charting
    """
    user_id = get_current_user_id()
    days = request.args.get('days', 90, type=int)
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            DATE(cooked_date) as cook_date,
            COUNT(*) as meals_count
        FROM meal_history
        WHERE user_id = ? AND cooked_date >= ?
        GROUP BY DATE(cooked_date)
        ORDER BY cook_date ASC
    """, (user_id, start_date))

    frequency = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'success': True,
        'frequency': frequency
    })


@analytics_bp.route('/trends/ratings', methods=['GET'])
@login_required
def get_rating_trends():
    """
    Get kid rating trends over time

    Shows how meal ratings have changed
    """
    user_id = get_current_user_id()
    days = request.args.get('days', 90, type=int)
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            DATE(cooked_date) as date,
            AVG(rating) as avg_rating,
            COUNT(*) as meals_rated
        FROM meal_history
        WHERE user_id = ? AND cooked_date >= ? AND rating IS NOT NULL
        GROUP BY DATE(cooked_date)
        ORDER BY date ASC
    """, (user_id, start_date))

    trends = [dict(row) for row in cursor.fetchall()]

    # Calculate overall stats
    cursor.execute("""
        SELECT
            AVG(rating) as overall_avg,
            COUNT(*) as total_rated
        FROM meal_history
        WHERE user_id = ? AND cooked_date >= ? AND rating IS NOT NULL
    """, (user_id, start_date))

    stats = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        'success': True,
        'trends': trends,
        'overall_avg_rating': round(stats['overall_avg'] or 0, 1),
        'total_meals_rated': stats['total_rated']
    })


# =============================================================================
# RECOMMENDATIONS & INSIGHTS
# =============================================================================

@analytics_bp.route('/insights', methods=['GET'])
@login_required
def get_insights():
    """
    Get AI-generated insights and recommendations

    Returns personalized insights based on cooking patterns
    """
    user_id = get_current_user_id()

    conn = _get_connection()
    cursor = conn.cursor()

    insights = []

    # Insight 1: Most popular cuisine
    cursor.execute("""
        SELECT
            m.cuisine,
            COUNT(*) as count
        FROM meal_history mh
        JOIN meals m ON mh.meal_id = m.id
        WHERE mh.user_id = ?
        GROUP BY m.cuisine
        ORDER BY count DESC
        LIMIT 1
    """, (user_id,))

    top_cuisine = cursor.fetchone()
    if top_cuisine and top_cuisine['count'] > 3:
        insights.append({
            'type': 'favorite_cuisine',
            'title': f"You love {top_cuisine['cuisine']} food!",
            'description': f"You've cooked {top_cuisine['count']} {top_cuisine['cuisine']} meals. Try exploring more recipes from this cuisine.",
            'action': 'Browse more ' + top_cuisine['cuisine']
        })

    # Insight 2: Meal variety
    cursor.execute("""
        SELECT COUNT(DISTINCT meal_id) as unique_meals, COUNT(*) as total_meals
        FROM meal_history
        WHERE user_id = ? AND cooked_date >= DATE('now', '-30 days')
    """, (user_id,))

    variety = cursor.fetchone()
    if variety and variety['total_meals'] > 0:
        variety_score = variety['unique_meals'] / variety['total_meals']
        if variety_score < 0.4:  # Cooking same meals often
            insights.append({
                'type': 'low_variety',
                'title': 'Try something new!',
                'description': f"You're cooking {variety['unique_meals']} different meals. Explore new recipes to add variety.",
                'action': 'Discover new recipes'
            })
        elif variety_score > 0.8:  # High variety
            insights.append({
                'type': 'high_variety',
                'title': "You're a culinary explorer!",
                'description': f"Great job trying {variety['unique_meals']} different meals this month!",
                'action': None
            })

    # Insight 3: Kid favorites to repeat
    cursor.execute("""
        SELECT m.name, AVG(mh.rating) as avg_rating, COUNT(*) as times_cooked
        FROM meal_history mh
        JOIN meals m ON mh.meal_id = m.id
        WHERE mh.user_id = ? AND mh.rating >= 8
        GROUP BY m.id
        HAVING times_cooked = 1  -- Only cooked once
        ORDER BY avg_rating DESC
        LIMIT 1
    """, (user_id,))

    high_rated_once = cursor.fetchone()
    if high_rated_once:
        insights.append({
            'type': 'repeat_favorite',
            'title': f"Time to make {high_rated_once['name']} again!",
            'description': f"The family loved it (rated {high_rated_once['avg_rating']:.1f}/10), but you haven't made it since.",
            'action': 'Add to this week'
        })

    # Insight 4: Streak tracking
    cursor.execute("""
        SELECT COUNT(DISTINCT DATE(cooked_date)) as days_cooked
        FROM meal_history
        WHERE user_id = ? AND cooked_date >= DATE('now', '-7 days')
    """, (user_id,))

    streak = cursor.fetchone()
    if streak and streak['days_cooked'] >= 5:
        insights.append({
            'type': 'streak',
            'title': f"{streak['days_cooked']}-day cooking streak!",
            'description': "You're on fire! Keep up the great work.",
            'action': None
        })

    conn.close()

    return jsonify({
        'success': True,
        'insights': insights
    })


# =============================================================================
# EXPORT DATA
# =============================================================================

@analytics_bp.route('/export', methods=['GET'])
@login_required
def export_analytics():
    """
    Export analytics data as CSV

    GET /api/analytics/export?format=csv&days=90

    Returns CSV file with all analytics data
    """
    user_id = get_current_user_id()
    format_type = request.args.get('format', 'csv')
    days = request.args.get('days', 90, type=int)
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    if format_type != 'csv':
        return jsonify({'success': False, 'error': 'Only CSV export supported'}), 400

    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            mh.cooked_date,
            m.name as meal_name,
            m.cuisine,
            mh.rating,
            mh.servings,
            m.prep_time_minutes + m.cook_time_minutes as total_time
        FROM meal_history mh
        JOIN meals m ON mh.meal_id = m.id
        WHERE mh.user_id = ? AND mh.cooked_date >= ?
        ORDER BY mh.cooked_date DESC
    """, (user_id, start_date))

    rows = cursor.fetchall()
    conn.close()

    # Generate CSV
    import io
    output = io.StringIO()
    output.write("Date,Meal Name,Cuisine,Rating,Servings,Time (minutes)\n")

    for row in rows:
        output.write(f"{row['cooked_date']},{row['meal_name']},{row['cuisine'] or 'N/A'},{row['rating'] or 'N/A'},{row['servings']},{row['total_time'] or 'N/A'}\n")

    csv_data = output.getvalue()
    output.close()

    return csv_data, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': f'attachment; filename=meal_analytics_{datetime.now().strftime("%Y%m%d")}.csv'
    }
