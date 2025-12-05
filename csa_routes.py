"""
CSA (Community Supported Agriculture) Box Management Routes
Handles CSA box deliveries, schedules, and recipe matching
"""

from flask import Blueprint, request, jsonify
from auth import login_required, get_current_user_id
from validation import db_connection, error_response
from datetime import datetime, timedelta
import json
import sqlite3
from typing import List, Dict, Optional

csa_bp = Blueprint('csa', __name__, url_prefix='/api/csa')

# ============================================================================
# CSA BOX CRUD OPERATIONS
# ============================================================================

@csa_bp.route('/boxes', methods=['GET'])
@login_required
def get_csa_boxes():
    """Get all CSA boxes for the current user"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        # Get boxes with item counts
        cursor.execute("""
            SELECT
                cb.id,
                cb.name,
                cb.delivery_date,
                cb.source,
                cb.notes,
                cb.is_active,
                cb.created_at,
                COUNT(cbi.id) as total_items,
                SUM(CASE WHEN cbi.is_used = 0 THEN 1 ELSE 0 END) as unused_items,
                SUM(CASE WHEN cbi.is_used = 1 THEN 1 ELSE 0 END) as used_items
            FROM csa_boxes cb
            LEFT JOIN csa_box_items cbi ON cb.id = cbi.box_id
            WHERE cb.user_id = ?
            GROUP BY cb.id
            ORDER BY cb.delivery_date DESC, cb.created_at DESC
        """, (user_id,))

        boxes = []
        for row in cursor.fetchall():
            boxes.append({
                'id': row[0],
                'name': row[1],
                'delivery_date': row[2],
                'source': row[3],
                'notes': row[4],
                'is_active': bool(row[5]),
                'created_at': row[6],
                'stats': {
                    'total_items': row[7] or 0,
                    'unused_items': row[8] or 0,
                    'used_items': row[9] or 0
                }
            })

        return jsonify({'success': True, 'boxes': boxes})

@csa_bp.route('/boxes/<int:box_id>', methods=['GET'])
@login_required
def get_csa_box(box_id):
    """Get a specific CSA box with all its items"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        # Get box details
        cursor.execute("""
            SELECT id, name, delivery_date, source, notes, is_active, created_at
            FROM csa_boxes
            WHERE id = ? AND user_id = ?
        """, (box_id, user_id))

        box_row = cursor.fetchone()
        if not box_row:
            return error_response("CSA box not found", 404)

        # Get box items
        cursor.execute("""
            SELECT
                id, ingredient_name, quantity, unit,
                estimated_expiry_days, is_used, used_in_recipe_id,
                used_date, notes, created_at
            FROM csa_box_items
            WHERE box_id = ?
            ORDER BY is_used ASC, ingredient_name ASC
        """, (box_id,))

        items = []
        for item in cursor.fetchall():
            items.append({
                'id': item[0],
                'ingredient_name': item[1],
                'quantity': item[2],
                'unit': item[3],
                'estimated_expiry_days': item[4],
                'is_used': bool(item[5]),
                'used_in_recipe_id': item[6],
                'used_date': item[7],
                'notes': item[8],
                'created_at': item[9]
            })

        box = {
            'id': box_row[0],
            'name': box_row[1],
            'delivery_date': box_row[2],
            'source': box_row[3],
            'notes': box_row[4],
            'is_active': bool(box_row[5]),
            'created_at': box_row[6],
            'items': items
        }

        return jsonify({'success': True, 'box': box})

@csa_bp.route('/boxes', methods=['POST'])
@login_required
def create_csa_box():
    """Create a new CSA box"""
    user_id = get_current_user_id()
    data = request.json

    if not data.get('name') or not data.get('delivery_date'):
        return error_response("Name and delivery date are required", 400)

    with db_connection() as conn:
        cursor = conn.cursor()

        # Create the box
        cursor.execute("""
            INSERT INTO csa_boxes (user_id, name, delivery_date, source, notes, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            data['name'],
            data['delivery_date'],
            data.get('source', ''),
            data.get('notes', ''),
            1
        ))

        box_id = cursor.lastrowid

        # Add items if provided
        items = data.get('items', [])
        for item in items:
            cursor.execute("""
                INSERT INTO csa_box_items
                (box_id, ingredient_name, quantity, unit, estimated_expiry_days, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                box_id,
                item['ingredient_name'],
                item.get('quantity'),
                item.get('unit', ''),
                item.get('estimated_expiry_days', 7),
                item.get('notes', '')
            ))

        conn.commit()

        return jsonify({
            'success': True,
            'box_id': box_id,
            'message': f'CSA box "{data["name"]}" created successfully'
        }), 201

@csa_bp.route('/boxes/<int:box_id>', methods=['PUT'])
@login_required
def update_csa_box(box_id):
    """Update a CSA box"""
    user_id = get_current_user_id()
    data = request.json

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM csa_boxes WHERE id = ? AND user_id = ?", (box_id, user_id))
        if not cursor.fetchone():
            return error_response("CSA box not found", 404)

        # Update box details
        cursor.execute("""
            UPDATE csa_boxes
            SET name = ?, delivery_date = ?, source = ?, notes = ?, is_active = ?
            WHERE id = ?
        """, (
            data.get('name'),
            data.get('delivery_date'),
            data.get('source', ''),
            data.get('notes', ''),
            data.get('is_active', True),
            box_id
        ))

        conn.commit()

        return jsonify({'success': True, 'message': 'CSA box updated successfully'})

@csa_bp.route('/boxes/<int:box_id>', methods=['DELETE'])
@login_required
def delete_csa_box(box_id):
    """Delete a CSA box and all its items"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("SELECT id FROM csa_boxes WHERE id = ? AND user_id = ?", (box_id, user_id))
        if not cursor.fetchone():
            return error_response("CSA box not found", 404)

        # Delete box (cascade will delete items)
        cursor.execute("DELETE FROM csa_boxes WHERE id = ?", (box_id,))
        conn.commit()

        return jsonify({'success': True, 'message': 'CSA box deleted successfully'})

# ============================================================================
# CSA BOX ITEMS OPERATIONS
# ============================================================================

@csa_bp.route('/boxes/<int:box_id>/items', methods=['POST'])
@login_required
def add_box_item(box_id):
    """Add an item to a CSA box"""
    user_id = get_current_user_id()
    data = request.json

    if not data.get('ingredient_name'):
        return error_response("Ingredient name is required", 400)

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify box ownership
        cursor.execute("SELECT id FROM csa_boxes WHERE id = ? AND user_id = ?", (box_id, user_id))
        if not cursor.fetchone():
            return error_response("CSA box not found", 404)

        # Add item
        cursor.execute("""
            INSERT INTO csa_box_items
            (box_id, ingredient_name, quantity, unit, estimated_expiry_days, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            box_id,
            data['ingredient_name'],
            data.get('quantity'),
            data.get('unit', ''),
            data.get('estimated_expiry_days', 7),
            data.get('notes', '')
        ))

        item_id = cursor.lastrowid
        conn.commit()

        return jsonify({
            'success': True,
            'item_id': item_id,
            'message': f'Added {data["ingredient_name"]} to CSA box'
        }), 201

@csa_bp.route('/boxes/<int:box_id>/items/<int:item_id>', methods=['PUT'])
@login_required
def update_box_item(box_id, item_id):
    """Update a CSA box item"""
    user_id = get_current_user_id()
    data = request.json

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify ownership through box
        cursor.execute("""
            SELECT cbi.id FROM csa_box_items cbi
            JOIN csa_boxes cb ON cbi.box_id = cb.id
            WHERE cbi.id = ? AND cbi.box_id = ? AND cb.user_id = ?
        """, (item_id, box_id, user_id))

        if not cursor.fetchone():
            return error_response("Item not found", 404)

        # Update item
        cursor.execute("""
            UPDATE csa_box_items
            SET ingredient_name = ?, quantity = ?, unit = ?,
                estimated_expiry_days = ?, is_used = ?, notes = ?
            WHERE id = ?
        """, (
            data.get('ingredient_name'),
            data.get('quantity'),
            data.get('unit', ''),
            data.get('estimated_expiry_days', 7),
            data.get('is_used', False),
            data.get('notes', ''),
            item_id
        ))

        conn.commit()

        return jsonify({'success': True, 'message': 'Item updated successfully'})

@csa_bp.route('/boxes/<int:box_id>/items/<int:item_id>', methods=['DELETE'])
@login_required
def delete_box_item(box_id, item_id):
    """Delete a CSA box item"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("""
            SELECT cbi.id FROM csa_box_items cbi
            JOIN csa_boxes cb ON cbi.box_id = cb.id
            WHERE cbi.id = ? AND cbi.box_id = ? AND cb.user_id = ?
        """, (item_id, box_id, user_id))

        if not cursor.fetchone():
            return error_response("Item not found", 404)

        cursor.execute("DELETE FROM csa_box_items WHERE id = ?", (item_id,))
        conn.commit()

        return jsonify({'success': True, 'message': 'Item deleted successfully'})

@csa_bp.route('/boxes/<int:box_id>/items/<int:item_id>/mark-used', methods=['POST'])
@login_required
def mark_item_used(box_id, item_id):
    """Mark a CSA box item as used"""
    user_id = get_current_user_id()
    data = request.json

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("""
            SELECT cbi.id FROM csa_box_items cbi
            JOIN csa_boxes cb ON cbi.box_id = cb.id
            WHERE cbi.id = ? AND cbi.box_id = ? AND cb.user_id = ?
        """, (item_id, box_id, user_id))

        if not cursor.fetchone():
            return error_response("Item not found", 404)

        cursor.execute("""
            UPDATE csa_box_items
            SET is_used = 1,
                used_in_recipe_id = ?,
                used_date = ?
            WHERE id = ?
        """, (
            data.get('recipe_id'),
            datetime.now().strftime('%Y-%m-%d'),
            item_id
        ))

        conn.commit()

        return jsonify({'success': True, 'message': 'Item marked as used'})

# ============================================================================
# RECIPE MATCHING ALGORITHM
# ============================================================================

@csa_bp.route('/boxes/<int:box_id>/recipe-matches', methods=['GET'])
@login_required
def get_recipe_matches(box_id):
    """Get recipe recommendations for a CSA box"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify box ownership
        cursor.execute("SELECT id FROM csa_boxes WHERE id = ? AND user_id = ?", (box_id, user_id))
        if not cursor.fetchone():
            return error_response("CSA box not found", 404)

        # Get unused ingredients from the box
        cursor.execute("""
            SELECT ingredient_name
            FROM csa_box_items
            WHERE box_id = ? AND is_used = 0
        """, (box_id,))

        csa_ingredients = [row[0].lower() for row in cursor.fetchall()]

        if not csa_ingredients:
            return jsonify({
                'success': True,
                'matches': [],
                'message': 'No unused ingredients in this CSA box'
            })

        # Get all recipes for this user
        cursor.execute("""
            SELECT id, name, ingredients, cuisine, cook_time_minutes
            FROM recipes
            WHERE user_id = ?
        """, (user_id,))

        recipes = cursor.fetchall()
        matches = []

        for recipe in recipes:
            recipe_id, name, ingredients_json, cuisine, cook_time = recipe

            if not ingredients_json:
                continue

            try:
                recipe_ingredients = json.loads(ingredients_json)
            except:
                continue

            # Calculate match score
            recipe_ingredient_names = [ing.get('name', '').lower() for ing in recipe_ingredients if ing.get('name')]

            matched = []
            for csa_ing in csa_ingredients:
                for recipe_ing in recipe_ingredient_names:
                    if csa_ing in recipe_ing or recipe_ing in csa_ing:
                        matched.append(csa_ing)
                        break

            if matched:
                match_score = len(matched) / len(csa_ingredients) * 100
                missing = [ing for ing in recipe_ingredient_names if not any(csa in ing for csa in csa_ingredients)]

                # Diversity score: recipes using more different CSA ingredients are better
                diversity_score = len(set(matched)) / len(csa_ingredients) * 100

                matches.append({
                    'recipe_id': recipe_id,
                    'recipe_name': name,
                    'cuisine': cuisine,
                    'cook_time': cook_time,
                    'match_score': round(match_score, 1),
                    'diversity_score': round(diversity_score, 1),
                    'matched_ingredients': matched,
                    'missing_ingredients': missing[:5],  # Show first 5 missing
                    'total_matched': len(matched),
                    'total_csa_ingredients': len(csa_ingredients)
                })

        # Sort by diversity score first (use variety), then match score
        matches.sort(key=lambda x: (x['diversity_score'], x['match_score']), reverse=True)

        # Cache results
        for match in matches[:20]:  # Cache top 20
            cursor.execute("""
                INSERT OR REPLACE INTO recipe_csa_matches
                (box_id, recipe_id, match_score, matched_ingredients, missing_ingredients, diversity_score)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                box_id,
                match['recipe_id'],
                match['match_score'],
                json.dumps(match['matched_ingredients']),
                json.dumps(match['missing_ingredients']),
                match['diversity_score']
            ))

        conn.commit()

        return jsonify({
            'success': True,
            'matches': matches[:20],  # Return top 20
            'total_matches': len(matches),
            'csa_ingredients': csa_ingredients
        })

# ============================================================================
# CSA SCHEDULES
# ============================================================================

@csa_bp.route('/schedules', methods=['GET'])
@login_required
def get_csa_schedules():
    """Get all CSA schedules for the current user"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, source, frequency, delivery_day, start_date, end_date,
                   is_active, auto_create_boxes, default_items, notes, created_at
            FROM csa_schedules
            WHERE user_id = ?
            ORDER BY is_active DESC, start_date DESC
        """, (user_id,))

        schedules = []
        for row in cursor.fetchall():
            schedules.append({
                'id': row[0],
                'name': row[1],
                'source': row[2],
                'frequency': row[3],
                'delivery_day': row[4],
                'start_date': row[5],
                'end_date': row[6],
                'is_active': bool(row[7]),
                'auto_create_boxes': bool(row[8]),
                'default_items': json.loads(row[9]) if row[9] else [],
                'notes': row[10],
                'created_at': row[11]
            })

        return jsonify({'success': True, 'schedules': schedules})

@csa_bp.route('/schedules', methods=['POST'])
@login_required
def create_csa_schedule():
    """Create a new CSA schedule"""
    user_id = get_current_user_id()
    data = request.json

    if not data.get('name') or not data.get('start_date'):
        return error_response("Name and start date are required", 400)

    with db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO csa_schedules
            (user_id, name, source, frequency, delivery_day, start_date, end_date,
             is_active, auto_create_boxes, default_items, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            data['name'],
            data.get('source', ''),
            data.get('frequency', 'weekly'),
            data.get('delivery_day', 'Wednesday'),
            data['start_date'],
            data.get('end_date'),
            1,
            data.get('auto_create_boxes', True),
            json.dumps(data.get('default_items', [])),
            data.get('notes', '')
        ))

        schedule_id = cursor.lastrowid
        conn.commit()

        return jsonify({
            'success': True,
            'schedule_id': schedule_id,
            'message': f'CSA schedule "{data["name"]}" created successfully'
        }), 201

@csa_bp.route('/schedules/<int:schedule_id>', methods=['DELETE'])
@login_required
def delete_csa_schedule(schedule_id):
    """Delete a CSA schedule"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("DELETE FROM csa_schedules WHERE id = ? AND user_id = ?", (schedule_id, user_id))

        if cursor.rowcount == 0:
            return error_response("Schedule not found", 404)

        conn.commit()

        return jsonify({'success': True, 'message': 'Schedule deleted successfully'})

# ============================================================================
# UNIFIED PRODUCE TRACKING (For Seasonal Cooking Page)
# ============================================================================

@csa_bp.route('/produce', methods=['GET'])
@login_required
def get_all_produce():
    """Get all produce items across all sources (CSA boxes, store purchases)"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        # Get all unused items from all active boxes, with box info
        cursor.execute("""
            SELECT
                cbi.id,
                cbi.ingredient_name,
                cbi.quantity,
                cbi.unit,
                cbi.estimated_expiry_days,
                cbi.is_used,
                cbi.notes,
                cbi.created_at,
                cb.id as box_id,
                cb.name as box_name,
                cb.source,
                cb.delivery_date
            FROM csa_box_items cbi
            JOIN csa_boxes cb ON cbi.box_id = cb.id
            WHERE cb.user_id = ? AND cb.is_active = 1
            ORDER BY cbi.is_used ASC,
                     cbi.estimated_expiry_days ASC,
                     cbi.created_at ASC
        """, (user_id,))

        items = []
        for row in cursor.fetchall():
            # Calculate days until expiry based on created_at and estimated_expiry_days
            created_at = row[7]
            expiry_days = row[4] or 7

            # Parse created_at to calculate days remaining
            try:
                from datetime import datetime
                created = datetime.strptime(created_at[:10], '%Y-%m-%d')
                expiry_date = created + timedelta(days=expiry_days)
                days_remaining = (expiry_date - datetime.now()).days
            except:
                days_remaining = expiry_days

            items.append({
                'id': row[0],
                'ingredient_name': row[1],
                'quantity': row[2],
                'unit': row[3],
                'estimated_expiry_days': expiry_days,
                'days_remaining': days_remaining,
                'is_used': bool(row[5]),
                'notes': row[6],
                'created_at': row[7],
                'box_id': row[8],
                'box_name': row[9],
                'source': row[10] or 'CSA',
                'delivery_date': row[11]
            })

        return jsonify({
            'success': True,
            'items': items,
            'total': len(items),
            'unused': len([i for i in items if not i['is_used']])
        })


@csa_bp.route('/produce/quick-add', methods=['POST'])
@login_required
def quick_add_produce():
    """Quick add produce from store or as seasonal item - creates/uses a default 'My Produce' box"""
    user_id = get_current_user_id()
    data = request.json

    if not data.get('ingredient_name'):
        return error_response("Ingredient name is required", 400)

    source = data.get('source', 'Store')  # Default to store purchase
    expiry_days = data.get('estimated_expiry_days', 7)

    with db_connection() as conn:
        cursor = conn.cursor()

        # Find or create a default produce box for this source
        today = datetime.now().strftime('%Y-%m-%d')

        # Look for an active box from this source within the last week
        cursor.execute("""
            SELECT id FROM csa_boxes
            WHERE user_id = ? AND source = ? AND is_active = 1
            AND delivery_date >= date(?, '-7 days')
            ORDER BY delivery_date DESC
            LIMIT 1
        """, (user_id, source, today))

        box_row = cursor.fetchone()

        if box_row:
            box_id = box_row[0]
        else:
            # Create a new box for this source
            box_name = f"{source} - {datetime.now().strftime('%b %d')}"
            cursor.execute("""
                INSERT INTO csa_boxes (user_id, name, delivery_date, source, notes, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
            """, (user_id, box_name, today, source, f'Auto-created for {source.lower()} produce'))
            box_id = cursor.lastrowid

        # Add the item
        cursor.execute("""
            INSERT INTO csa_box_items
            (box_id, ingredient_name, quantity, unit, estimated_expiry_days, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            box_id,
            data['ingredient_name'],
            data.get('quantity'),
            data.get('unit', ''),
            expiry_days,
            data.get('notes', '')
        ))

        item_id = cursor.lastrowid
        conn.commit()

        return jsonify({
            'success': True,
            'item_id': item_id,
            'box_id': box_id,
            'message': f'Added {data["ingredient_name"]} to {source} produce'
        }), 201


@csa_bp.route('/produce/<int:item_id>/use', methods=['POST'])
@login_required
def mark_produce_used(item_id):
    """Mark a produce item as used (simplified endpoint)"""
    user_id = get_current_user_id()
    data = request.json or {}

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify ownership through box
        cursor.execute("""
            SELECT cbi.id, cbi.box_id FROM csa_box_items cbi
            JOIN csa_boxes cb ON cbi.box_id = cb.id
            WHERE cbi.id = ? AND cb.user_id = ?
        """, (item_id, user_id))

        row = cursor.fetchone()
        if not row:
            return error_response("Item not found", 404)

        cursor.execute("""
            UPDATE csa_box_items
            SET is_used = 1,
                used_in_recipe_id = ?,
                used_date = ?
            WHERE id = ?
        """, (
            data.get('recipe_id'),
            datetime.now().strftime('%Y-%m-%d'),
            item_id
        ))

        conn.commit()

        return jsonify({'success': True, 'message': 'Item marked as used'})


@csa_bp.route('/produce/<int:item_id>', methods=['DELETE'])
@login_required
def delete_produce_item(item_id):
    """Delete a produce item"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("""
            SELECT cbi.id FROM csa_box_items cbi
            JOIN csa_boxes cb ON cbi.box_id = cb.id
            WHERE cbi.id = ? AND cb.user_id = ?
        """, (item_id, user_id))

        if not cursor.fetchone():
            return error_response("Item not found", 404)

        cursor.execute("DELETE FROM csa_box_items WHERE id = ?", (item_id,))
        conn.commit()

        return jsonify({'success': True, 'message': 'Item removed'})


@csa_bp.route('/produce/recipe-suggestions', methods=['GET'])
@login_required
def get_produce_recipe_suggestions():
    """Get recipe suggestions based on ALL available produce, prioritizing expiring items"""
    user_id = get_current_user_id()

    with db_connection() as conn:
        cursor = conn.cursor()

        # Get all unused produce with expiry info
        cursor.execute("""
            SELECT
                cbi.ingredient_name,
                cbi.estimated_expiry_days,
                cbi.created_at
            FROM csa_box_items cbi
            JOIN csa_boxes cb ON cbi.box_id = cb.id
            WHERE cb.user_id = ? AND cb.is_active = 1 AND cbi.is_used = 0
        """, (user_id,))

        produce_items = []
        for row in cursor.fetchall():
            ingredient = row[0].lower()
            expiry_days = row[1] or 7
            created_at = row[2]

            # Calculate days remaining
            try:
                created = datetime.strptime(created_at[:10], '%Y-%m-%d')
                expiry_date = created + timedelta(days=expiry_days)
                days_remaining = (expiry_date - datetime.now()).days
            except:
                days_remaining = expiry_days

            produce_items.append({
                'name': ingredient,
                'days_remaining': days_remaining,
                'urgency': 'critical' if days_remaining <= 2 else ('warning' if days_remaining <= 5 else 'ok')
            })

        if not produce_items:
            return jsonify({
                'success': True,
                'suggestions': [],
                'message': 'No produce items to match'
            })

        # Get all recipes
        cursor.execute("""
            SELECT id, name, ingredients, cuisine, cook_time_minutes, image_url
            FROM recipes
            WHERE user_id = ?
        """, (user_id,))

        recipes = cursor.fetchall()
        suggestions = []

        for recipe in recipes:
            recipe_id, name, ingredients_json, cuisine, cook_time, image_url = recipe

            if not ingredients_json:
                continue

            try:
                recipe_ingredients = json.loads(ingredients_json)
            except:
                continue

            recipe_ingredient_names = [ing.get('name', '').lower() for ing in recipe_ingredients if ing.get('name')]

            # Match produce to recipe ingredients and track urgency
            matched = []
            expiring_matched = []
            urgency_score = 0

            for produce in produce_items:
                produce_name = produce['name']
                for recipe_ing in recipe_ingredient_names:
                    if produce_name in recipe_ing or recipe_ing in produce_name:
                        matched.append(produce_name)
                        if produce['urgency'] == 'critical':
                            expiring_matched.append(produce_name)
                            urgency_score += 10
                        elif produce['urgency'] == 'warning':
                            expiring_matched.append(produce_name)
                            urgency_score += 5
                        break

            if matched:
                # Calculate scores
                match_score = len(matched) / len(produce_items) * 100
                missing = [ing for ing in recipe_ingredient_names
                          if not any(p['name'] in ing for p in produce_items)]

                suggestions.append({
                    'recipe_id': recipe_id,
                    'recipe_name': name,
                    'cuisine': cuisine,
                    'cook_time': cook_time,
                    'image_url': image_url,
                    'match_score': round(match_score, 1),
                    'urgency_score': urgency_score,
                    'total_score': round(match_score + urgency_score, 1),
                    'matched_ingredients': matched,
                    'expiring_ingredients': expiring_matched,
                    'missing_ingredients': missing[:5],
                    'total_matched': len(matched)
                })

        # Sort by total score (urgency + match)
        suggestions.sort(key=lambda x: x['total_score'], reverse=True)

        return jsonify({
            'success': True,
            'suggestions': suggestions[:20],
            'produce_items': produce_items,
            'total_produce': len(produce_items)
        })


# ============================================================================
# AI-POWERED CSA BOX PARSING
# ============================================================================

# Try to import the CSA AI parser
try:
    from csa_ai_parser import CSABoxParser
    import os
    HAS_CSA_AI_PARSER = True
except ImportError:
    HAS_CSA_AI_PARSER = False
    print("⚠️  CSA AI Parser not available")


@csa_bp.route('/parse/text', methods=['POST'])
@login_required
def parse_csa_text():
    """Parse CSA box contents from text using AI"""
    if not HAS_CSA_AI_PARSER:
        return error_response("AI parsing is not available", 503)

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        return error_response("AI service not configured", 503)

    data = request.json
    text = data.get('text', '').strip()
    source = data.get('source', 'CSA')

    if not text:
        return error_response("No text provided", 400)

    if len(text) > 10000:
        return error_response("Text too long (max 10,000 characters)", 400)

    try:
        parser = CSABoxParser(api_key)
        result = parser.parse_text(text, source)

        return jsonify({
            'success': True,
            'parsed': result
        })

    except Exception as e:
        return error_response(f"Failed to parse text: {str(e)}", 500)


@csa_bp.route('/parse/image', methods=['POST'])
@login_required
def parse_csa_image():
    """Parse CSA box contents from an image using AI vision"""
    if not HAS_CSA_AI_PARSER:
        return error_response("AI parsing is not available", 503)

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        return error_response("AI service not configured", 503)

    data = request.json
    image_data = data.get('image_data', '')
    media_type = data.get('media_type', 'image/jpeg')
    source = data.get('source', 'CSA')

    if not image_data:
        return error_response("No image data provided", 400)

    # Validate media type
    valid_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if media_type not in valid_types:
        return error_response(f"Invalid image type. Supported: {', '.join(valid_types)}", 400)

    # Remove data URL prefix if present
    if ',' in image_data:
        image_data = image_data.split(',', 1)[1]

    try:
        parser = CSABoxParser(api_key)
        result = parser.parse_image(image_data, media_type, source)

        return jsonify({
            'success': True,
            'parsed': result
        })

    except Exception as e:
        return error_response(f"Failed to parse image: {str(e)}", 500)


@csa_bp.route('/parse/add-all', methods=['POST'])
@login_required
def add_parsed_items():
    """Add all parsed items to produce tracking"""
    user_id = get_current_user_id()
    data = request.json

    items = data.get('items', [])
    source = data.get('source', 'CSA')
    delivery_date = data.get('delivery_date', datetime.now().strftime('%Y-%m-%d'))
    box_name = data.get('box_name', f"{source} - {datetime.now().strftime('%b %d')}")

    if not items:
        return error_response("No items to add", 400)

    with db_connection() as conn:
        cursor = conn.cursor()

        # Create a new box for this parsed CSA
        cursor.execute("""
            INSERT INTO csa_boxes (user_id, name, delivery_date, source, notes, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (user_id, box_name, delivery_date, source, 'Added via AI parsing'))

        box_id = cursor.lastrowid

        # Add all items
        added_count = 0
        for item in items:
            if not item.get('name'):
                continue

            cursor.execute("""
                INSERT INTO csa_box_items
                (box_id, ingredient_name, quantity, unit, estimated_expiry_days, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                box_id,
                item['name'],
                item.get('quantity', 1),
                item.get('unit', 'pieces'),
                item.get('estimated_shelf_life_days', 7),
                item.get('notes', '')
            ))
            added_count += 1

        conn.commit()

        return jsonify({
            'success': True,
            'box_id': box_id,
            'items_added': added_count,
            'message': f'Added {added_count} items to "{box_name}"'
        }), 201


print("🥬 CSA box & Seasonal Cooking routes loaded successfully")
