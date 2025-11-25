"""
Holiday Meal Planning Routes
Handles holiday events, cooking timelines, guest management, and dish assignments
"""

from flask import Blueprint, request, jsonify
from auth import login_required, get_current_user_id
from validation import db_connection
from datetime import datetime, timedelta
import json

holiday_bp = Blueprint('holiday', __name__, url_prefix='/api/holiday')

# Store the db instance that will be set from app.py
db = None

def init_db(db_instance):
    """Initialize the db instance for this module"""
    global db
    db = db_instance
    # Now that we have the db, initialize the tables
    try:
        init_holiday_tables()
        print("✅ Holiday tables initialized successfully")
    except Exception as e:
        print(f"⚠️ Failed to initialize holiday tables: {e}")


def init_holiday_tables():
    """Initialize holiday planning tables in the database"""
    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Holiday Events table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS holiday_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_date TEXT NOT NULL,
                serving_time TEXT NOT NULL,
                guest_count INTEGER DEFAULT 4,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')

        # Holiday Dishes table (recipes for the event)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS holiday_dishes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                meal_id INTEGER,
                custom_name TEXT,
                category TEXT NOT NULL,
                servings INTEGER DEFAULT 4,
                prep_time_minutes INTEGER DEFAULT 30,
                cook_time_minutes INTEGER DEFAULT 60,
                can_make_ahead INTEGER DEFAULT 0,
                make_ahead_days INTEGER DEFAULT 0,
                assigned_to TEXT,
                is_confirmed INTEGER DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES holiday_events(id) ON DELETE CASCADE,
                FOREIGN KEY (meal_id) REFERENCES meals(id)
            )
        ''')

        # Holiday Guests table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS holiday_guests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                dietary_restrictions TEXT,
                bringing_dish INTEGER DEFAULT 0,
                rsvp_status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES holiday_events(id) ON DELETE CASCADE
            )
        ''')

        # Cooking Timeline Steps table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS holiday_timeline_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dish_id INTEGER NOT NULL,
                step_order INTEGER NOT NULL,
                description TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                start_time TEXT,
                end_time TEXT,
                is_completed INTEGER DEFAULT 0,
                requires_attention INTEGER DEFAULT 1,
                notes TEXT,
                FOREIGN KEY (dish_id) REFERENCES holiday_dishes(id) ON DELETE CASCADE
            )
        ''')

        conn.commit()
        print("✅ Holiday planning tables initialized")


# Tables will be initialized when init_db is called from app.py


# ============== EVENT MANAGEMENT ==============

@holiday_bp.route('/events', methods=['GET'])
@login_required
def get_events():
    """Get all holiday events for the current user"""
    user_id = get_current_user_id()

    with db_connection(db) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                e.*,
                (SELECT COUNT(*) FROM holiday_dishes WHERE event_id = e.id) as dish_count,
                (SELECT COUNT(*) FROM holiday_guests WHERE event_id = e.id) as guest_count_actual
            FROM holiday_events e
            WHERE e.user_id = ?
            ORDER BY e.event_date DESC
        ''', (user_id,))

        events = []
        for row in cursor.fetchall():
            events.append({
                'id': row[0],
                'user_id': row[1],
                'name': row[2],
                'event_type': row[3],
                'event_date': row[4],
                'serving_time': row[5],
                'guest_count': row[6],
                'notes': row[7],
                'created_at': row[8],
                'updated_at': row[9],
                'dish_count': row[10],
                'guest_count_actual': row[11]
            })

        return jsonify({'events': events})


@holiday_bp.route('/events', methods=['POST'])
@login_required
def create_event():
    """Create a new holiday event"""
    user_id = get_current_user_id()
    data = request.json

    required = ['name', 'event_type', 'event_date', 'serving_time']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    with db_connection(db) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO holiday_events
            (user_id, name, event_type, event_date, serving_time, guest_count, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            data['name'],
            data['event_type'],
            data['event_date'],
            data['serving_time'],
            data.get('guest_count', 4),
            data.get('notes', '')
        ))

        event_id = cursor.lastrowid
        conn.commit()

        return jsonify({
            'success': True,
            'event_id': event_id,
            'message': 'Holiday event created'
        })


@holiday_bp.route('/events/<int:event_id>', methods=['GET'])
@login_required
def get_event(event_id):
    """Get a single holiday event with all details"""
    user_id = get_current_user_id()

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Get event
        cursor.execute('''
            SELECT * FROM holiday_events
            WHERE id = ? AND user_id = ?
        ''', (event_id, user_id))

        event_row = cursor.fetchone()
        if not event_row:
            return jsonify({'error': 'Event not found'}), 404

        event = {
            'id': event_row[0],
            'user_id': event_row[1],
            'name': event_row[2],
            'event_type': event_row[3],
            'event_date': event_row[4],
            'serving_time': event_row[5],
            'guest_count': event_row[6],
            'notes': event_row[7],
            'created_at': event_row[8],
            'updated_at': event_row[9]
        }

        # Get dishes
        cursor.execute('''
            SELECT
                d.*,
                m.name as meal_name,
                m.cuisine,
                m.ingredients
            FROM holiday_dishes d
            LEFT JOIN meals m ON d.meal_id = m.id
            WHERE d.event_id = ?
            ORDER BY d.category, d.id
        ''', (event_id,))

        dishes = []
        for row in cursor.fetchall():
            dishes.append({
                'id': row[0],
                'event_id': row[1],
                'meal_id': row[2],
                'custom_name': row[3],
                'category': row[4],
                'servings': row[5],
                'prep_time_minutes': row[6],
                'cook_time_minutes': row[7],
                'can_make_ahead': bool(row[8]),
                'make_ahead_days': row[9],
                'assigned_to': row[10],
                'is_confirmed': bool(row[11]),
                'notes': row[12],
                'created_at': row[13],
                'meal_name': row[14],
                'cuisine': row[15],
                'ingredients': row[16]
            })

        # Get guests
        cursor.execute('''
            SELECT * FROM holiday_guests
            WHERE event_id = ?
            ORDER BY name
        ''', (event_id,))

        guests = []
        for row in cursor.fetchall():
            guests.append({
                'id': row[0],
                'event_id': row[1],
                'name': row[2],
                'email': row[3],
                'dietary_restrictions': row[4],
                'bringing_dish': bool(row[5]),
                'rsvp_status': row[6],
                'notes': row[7],
                'created_at': row[8]
            })

        return jsonify({
            'event': event,
            'dishes': dishes,
            'guests': guests
        })


@holiday_bp.route('/events/<int:event_id>', methods=['PUT'])
@login_required
def update_event(event_id):
    """Update a holiday event"""
    user_id = get_current_user_id()
    data = request.json

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute('SELECT id FROM holiday_events WHERE id = ? AND user_id = ?', (event_id, user_id))
        if not cursor.fetchone():
            return jsonify({'error': 'Event not found'}), 404

        cursor.execute('''
            UPDATE holiday_events
            SET name = ?, event_type = ?, event_date = ?, serving_time = ?,
                guest_count = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (
            data.get('name'),
            data.get('event_type'),
            data.get('event_date'),
            data.get('serving_time'),
            data.get('guest_count'),
            data.get('notes'),
            event_id
        ))

        conn.commit()
        return jsonify({'success': True, 'message': 'Event updated'})


@holiday_bp.route('/events/<int:event_id>', methods=['DELETE'])
@login_required
def delete_event(event_id):
    """Delete a holiday event and all associated data"""
    user_id = get_current_user_id()

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute('SELECT id FROM holiday_events WHERE id = ? AND user_id = ?', (event_id, user_id))
        if not cursor.fetchone():
            return jsonify({'error': 'Event not found'}), 404

        cursor.execute('DELETE FROM holiday_events WHERE id = ?', (event_id,))
        conn.commit()

        return jsonify({'success': True, 'message': 'Event deleted'})


# ============== DISH MANAGEMENT ==============

@holiday_bp.route('/events/<int:event_id>/dishes', methods=['POST'])
@login_required
def add_dish(event_id):
    """Add a dish to a holiday event"""
    user_id = get_current_user_id()
    data = request.json

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify event ownership
        cursor.execute('SELECT id FROM holiday_events WHERE id = ? AND user_id = ?', (event_id, user_id))
        if not cursor.fetchone():
            return jsonify({'error': 'Event not found'}), 404

        cursor.execute('''
            INSERT INTO holiday_dishes
            (event_id, meal_id, custom_name, category, servings, prep_time_minutes,
             cook_time_minutes, can_make_ahead, make_ahead_days, assigned_to, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            event_id,
            data.get('meal_id'),
            data.get('custom_name'),
            data.get('category', 'main'),
            data.get('servings', 4),
            data.get('prep_time_minutes', 30),
            data.get('cook_time_minutes', 60),
            1 if data.get('can_make_ahead') else 0,
            data.get('make_ahead_days', 0),
            data.get('assigned_to'),
            data.get('notes')
        ))

        dish_id = cursor.lastrowid
        conn.commit()

        return jsonify({
            'success': True,
            'dish_id': dish_id,
            'message': 'Dish added to event'
        })


@holiday_bp.route('/dishes/<int:dish_id>', methods=['PUT'])
@login_required
def update_dish(dish_id):
    """Update a dish"""
    user_id = get_current_user_id()
    data = request.json

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify ownership through event
        cursor.execute('''
            SELECT d.id FROM holiday_dishes d
            JOIN holiday_events e ON d.event_id = e.id
            WHERE d.id = ? AND e.user_id = ?
        ''', (dish_id, user_id))

        if not cursor.fetchone():
            return jsonify({'error': 'Dish not found'}), 404

        cursor.execute('''
            UPDATE holiday_dishes
            SET custom_name = ?, category = ?, servings = ?, prep_time_minutes = ?,
                cook_time_minutes = ?, can_make_ahead = ?, make_ahead_days = ?,
                assigned_to = ?, is_confirmed = ?, notes = ?
            WHERE id = ?
        ''', (
            data.get('custom_name'),
            data.get('category'),
            data.get('servings'),
            data.get('prep_time_minutes'),
            data.get('cook_time_minutes'),
            1 if data.get('can_make_ahead') else 0,
            data.get('make_ahead_days'),
            data.get('assigned_to'),
            1 if data.get('is_confirmed') else 0,
            data.get('notes'),
            dish_id
        ))

        conn.commit()
        return jsonify({'success': True, 'message': 'Dish updated'})


@holiday_bp.route('/dishes/<int:dish_id>', methods=['DELETE'])
@login_required
def delete_dish(dish_id):
    """Delete a dish from an event"""
    user_id = get_current_user_id()

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify ownership through event
        cursor.execute('''
            SELECT d.id FROM holiday_dishes d
            JOIN holiday_events e ON d.event_id = e.id
            WHERE d.id = ? AND e.user_id = ?
        ''', (dish_id, user_id))

        if not cursor.fetchone():
            return jsonify({'error': 'Dish not found'}), 404

        cursor.execute('DELETE FROM holiday_dishes WHERE id = ?', (dish_id,))
        conn.commit()

        return jsonify({'success': True, 'message': 'Dish deleted'})


# ============== GUEST MANAGEMENT ==============

@holiday_bp.route('/events/<int:event_id>/guests', methods=['POST'])
@login_required
def add_guest(event_id):
    """Add a guest to a holiday event"""
    user_id = get_current_user_id()
    data = request.json

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify event ownership
        cursor.execute('SELECT id FROM holiday_events WHERE id = ? AND user_id = ?', (event_id, user_id))
        if not cursor.fetchone():
            return jsonify({'error': 'Event not found'}), 404

        cursor.execute('''
            INSERT INTO holiday_guests
            (event_id, name, email, dietary_restrictions, bringing_dish, rsvp_status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            event_id,
            data.get('name'),
            data.get('email'),
            data.get('dietary_restrictions'),
            1 if data.get('bringing_dish') else 0,
            data.get('rsvp_status', 'pending'),
            data.get('notes')
        ))

        guest_id = cursor.lastrowid
        conn.commit()

        return jsonify({
            'success': True,
            'guest_id': guest_id,
            'message': 'Guest added'
        })


@holiday_bp.route('/guests/<int:guest_id>', methods=['PUT'])
@login_required
def update_guest(guest_id):
    """Update a guest"""
    user_id = get_current_user_id()
    data = request.json

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify ownership through event
        cursor.execute('''
            SELECT g.id FROM holiday_guests g
            JOIN holiday_events e ON g.event_id = e.id
            WHERE g.id = ? AND e.user_id = ?
        ''', (guest_id, user_id))

        if not cursor.fetchone():
            return jsonify({'error': 'Guest not found'}), 404

        cursor.execute('''
            UPDATE holiday_guests
            SET name = ?, email = ?, dietary_restrictions = ?,
                bringing_dish = ?, rsvp_status = ?, notes = ?
            WHERE id = ?
        ''', (
            data.get('name'),
            data.get('email'),
            data.get('dietary_restrictions'),
            1 if data.get('bringing_dish') else 0,
            data.get('rsvp_status'),
            data.get('notes'),
            guest_id
        ))

        conn.commit()
        return jsonify({'success': True, 'message': 'Guest updated'})


@holiday_bp.route('/guests/<int:guest_id>', methods=['DELETE'])
@login_required
def delete_guest(guest_id):
    """Delete a guest"""
    user_id = get_current_user_id()

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify ownership through event
        cursor.execute('''
            SELECT g.id FROM holiday_guests g
            JOIN holiday_events e ON g.event_id = e.id
            WHERE g.id = ? AND e.user_id = ?
        ''', (guest_id, user_id))

        if not cursor.fetchone():
            return jsonify({'error': 'Guest not found'}), 404

        cursor.execute('DELETE FROM holiday_guests WHERE id = ?', (guest_id,))
        conn.commit()

        return jsonify({'success': True, 'message': 'Guest deleted'})


# ============== COOKING TIMELINE ==============

@holiday_bp.route('/events/<int:event_id>/timeline', methods=['GET'])
@login_required
def get_timeline(event_id):
    """Generate a cooking timeline for the event based on serving time"""
    user_id = get_current_user_id()

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Get event with serving time
        cursor.execute('''
            SELECT event_date, serving_time FROM holiday_events
            WHERE id = ? AND user_id = ?
        ''', (event_id, user_id))

        event_row = cursor.fetchone()
        if not event_row:
            return jsonify({'error': 'Event not found'}), 404

        event_date = event_row[0]
        serving_time = event_row[1]

        # Parse serving time
        try:
            serve_datetime = datetime.strptime(f"{event_date} {serving_time}", "%Y-%m-%d %H:%M")
        except:
            serve_datetime = datetime.strptime(f"{event_date} 17:00", "%Y-%m-%d %H:%M")

        # Get all dishes
        cursor.execute('''
            SELECT
                d.id, d.custom_name, d.category, d.prep_time_minutes,
                d.cook_time_minutes, d.can_make_ahead, d.make_ahead_days,
                m.name as meal_name
            FROM holiday_dishes d
            LEFT JOIN meals m ON d.meal_id = m.id
            WHERE d.event_id = ?
            ORDER BY d.cook_time_minutes DESC
        ''', (event_id,))

        dishes = cursor.fetchall()

        # Build timeline working backwards from serving time
        timeline = []

        # Add make-ahead items first
        make_ahead_items = []
        day_of_items = []

        for dish in dishes:
            dish_name = dish[1] or dish[7] or 'Unnamed Dish'
            total_time = (dish[3] or 30) + (dish[4] or 60)

            if dish[5] and dish[6] > 0:  # can_make_ahead and make_ahead_days
                make_ahead_items.append({
                    'dish_id': dish[0],
                    'dish_name': dish_name,
                    'category': dish[2],
                    'when': f"{dish[6]} day(s) before",
                    'duration_minutes': total_time,
                    'type': 'make_ahead'
                })
            else:
                day_of_items.append({
                    'dish_id': dish[0],
                    'dish_name': dish_name,
                    'category': dish[2],
                    'prep_time': dish[3] or 30,
                    'cook_time': dish[4] or 60,
                    'total_time': total_time
                })

        # Schedule day-of items working backwards
        # Sort by total time (longest first) to ensure big items start early
        day_of_items.sort(key=lambda x: x['total_time'], reverse=True)

        scheduled_items = []
        for item in day_of_items:
            # Calculate start time by working backwards
            end_time = serve_datetime
            start_time = end_time - timedelta(minutes=item['total_time'])

            scheduled_items.append({
                'dish_id': item['dish_id'],
                'dish_name': item['dish_name'],
                'category': item['category'],
                'start_time': start_time.strftime('%H:%M'),
                'end_time': end_time.strftime('%H:%M'),
                'duration_minutes': item['total_time'],
                'prep_time': item['prep_time'],
                'cook_time': item['cook_time'],
                'type': 'day_of'
            })

        # Sort scheduled items by start time
        scheduled_items.sort(key=lambda x: x['start_time'])

        return jsonify({
            'event_date': event_date,
            'serving_time': serving_time,
            'make_ahead_items': make_ahead_items,
            'day_of_schedule': scheduled_items,
            'total_dishes': len(dishes)
        })


@holiday_bp.route('/events/<int:event_id>/shopping-list', methods=['GET'])
@login_required
def get_holiday_shopping_list(event_id):
    """Generate a combined shopping list for all dishes in the event"""
    user_id = get_current_user_id()

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify event ownership
        cursor.execute('SELECT id FROM holiday_events WHERE id = ? AND user_id = ?', (event_id, user_id))
        if not cursor.fetchone():
            return jsonify({'error': 'Event not found'}), 404

        # Get all ingredients from dishes
        cursor.execute('''
            SELECT
                m.ingredients,
                d.servings,
                COALESCE(d.custom_name, m.name) as dish_name
            FROM holiday_dishes d
            JOIN meals m ON d.meal_id = m.id
            WHERE d.event_id = ? AND d.assigned_to IS NULL
        ''', (event_id,))

        all_ingredients = []
        for row in cursor.fetchall():
            if row[0]:
                # Parse ingredients (assuming newline or comma separated)
                ingredients = row[0].replace('\n', ',').split(',')
                for ing in ingredients:
                    ing = ing.strip()
                    if ing:
                        all_ingredients.append({
                            'item': ing,
                            'from_dish': row[2]
                        })

        return jsonify({
            'shopping_list': all_ingredients,
            'total_items': len(all_ingredients)
        })


# ============== TEMPLATES ==============

@holiday_bp.route('/templates', methods=['GET'])
@login_required
def get_templates():
    """Get holiday meal templates"""
    templates = {
        'thanksgiving': {
            'name': 'Traditional Thanksgiving',
            'dishes': [
                {'category': 'main', 'name': 'Roasted Turkey', 'prep_time': 30, 'cook_time': 240, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Mashed Potatoes', 'prep_time': 20, 'cook_time': 30, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Gravy', 'prep_time': 10, 'cook_time': 20, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Stuffing', 'prep_time': 20, 'cook_time': 45, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'side', 'name': 'Cranberry Sauce', 'prep_time': 10, 'cook_time': 15, 'can_make_ahead': True, 'make_ahead_days': 3},
                {'category': 'side', 'name': 'Green Bean Casserole', 'prep_time': 15, 'cook_time': 30, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'side', 'name': 'Sweet Potato Casserole', 'prep_time': 20, 'cook_time': 45, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'side', 'name': 'Dinner Rolls', 'prep_time': 15, 'cook_time': 20, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'dessert', 'name': 'Pumpkin Pie', 'prep_time': 30, 'cook_time': 60, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'dessert', 'name': 'Pecan Pie', 'prep_time': 20, 'cook_time': 50, 'can_make_ahead': True, 'make_ahead_days': 1},
            ]
        },
        'christmas': {
            'name': 'Traditional Christmas',
            'dishes': [
                {'category': 'main', 'name': 'Prime Rib Roast', 'prep_time': 30, 'cook_time': 180, 'can_make_ahead': False},
                {'category': 'main', 'name': 'Honey Glazed Ham', 'prep_time': 15, 'cook_time': 120, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Yorkshire Pudding', 'prep_time': 10, 'cook_time': 25, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Roasted Vegetables', 'prep_time': 20, 'cook_time': 45, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Mashed Potatoes', 'prep_time': 20, 'cook_time': 30, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Brussels Sprouts', 'prep_time': 15, 'cook_time': 25, 'can_make_ahead': False},
                {'category': 'appetizer', 'name': 'Shrimp Cocktail', 'prep_time': 20, 'cook_time': 10, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'dessert', 'name': 'Yule Log', 'prep_time': 45, 'cook_time': 30, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'dessert', 'name': 'Gingerbread Cookies', 'prep_time': 30, 'cook_time': 12, 'can_make_ahead': True, 'make_ahead_days': 3},
            ]
        },
        'easter': {
            'name': 'Traditional Easter',
            'dishes': [
                {'category': 'main', 'name': 'Glazed Ham', 'prep_time': 15, 'cook_time': 120, 'can_make_ahead': False},
                {'category': 'main', 'name': 'Lamb Roast', 'prep_time': 20, 'cook_time': 90, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Scalloped Potatoes', 'prep_time': 25, 'cook_time': 60, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'side', 'name': 'Asparagus', 'prep_time': 10, 'cook_time': 15, 'can_make_ahead': False},
                {'category': 'side', 'name': 'Deviled Eggs', 'prep_time': 30, 'cook_time': 15, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'side', 'name': 'Dinner Rolls', 'prep_time': 15, 'cook_time': 20, 'can_make_ahead': True, 'make_ahead_days': 1},
                {'category': 'dessert', 'name': 'Carrot Cake', 'prep_time': 30, 'cook_time': 45, 'can_make_ahead': True, 'make_ahead_days': 1},
            ]
        }
    }

    return jsonify({'templates': templates})


@holiday_bp.route('/events/<int:event_id>/apply-template', methods=['POST'])
@login_required
def apply_template(event_id):
    """Apply a holiday template to an event"""
    user_id = get_current_user_id()
    data = request.json

    template_name = data.get('template')
    if not template_name:
        return jsonify({'error': 'Template name required'}), 400

    # Get templates
    templates_response = get_templates()
    templates = templates_response.get_json()['templates']

    if template_name not in templates:
        return jsonify({'error': 'Template not found'}), 404

    template = templates[template_name]

    with db_connection(db) as conn:
        cursor = conn.cursor()

        # Verify event ownership
        cursor.execute('SELECT id FROM holiday_events WHERE id = ? AND user_id = ?', (event_id, user_id))
        if not cursor.fetchone():
            return jsonify({'error': 'Event not found'}), 404

        # Add dishes from template
        added = 0
        for dish in template['dishes']:
            cursor.execute('''
                INSERT INTO holiday_dishes
                (event_id, custom_name, category, prep_time_minutes, cook_time_minutes,
                 can_make_ahead, make_ahead_days)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                event_id,
                dish['name'],
                dish['category'],
                dish['prep_time'],
                dish['cook_time'],
                1 if dish.get('can_make_ahead') else 0,
                dish.get('make_ahead_days', 0)
            ))
            added += 1

        conn.commit()

        return jsonify({
            'success': True,
            'added_dishes': added,
            'message': f'Applied {template["name"]} template'
        })
