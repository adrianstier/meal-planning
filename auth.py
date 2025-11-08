"""
Authentication utilities for multi-user meal planning app
"""

import hashlib
import secrets
from functools import wraps
from flask import session, jsonify
import sqlite3


def hash_password(password):
    """Hash a password using SHA-256 with salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${pwd_hash}"


def verify_password(password, password_hash):
    """Verify a password against a hash"""
    try:
        salt, pwd_hash = password_hash.split('$')
        test_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return test_hash == pwd_hash
    except (ValueError, AttributeError, TypeError) as e:
        # ValueError: invalid hash format
        # AttributeError: password_hash is None
        # TypeError: password_hash is not a string
        return False


def get_current_user_id():
    """Get the current logged-in user's ID from session"""
    return session.get('user_id')


def get_current_user(db_path='meal_planner.db'):
    """Get the current logged-in user's data"""
    user_id = get_current_user_id()
    if not user_id:
        return None

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, username, email, display_name, created_at, last_login
        FROM users
        WHERE id = ?
    """, (user_id,))

    user = cursor.fetchone()
    conn.close()

    if user:
        return dict(user)
    return None


def login_required(f):
    """Decorator to require login for a route"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not get_current_user_id():
            return jsonify({
                'success': False,
                'error': 'Authentication required. Please log in.'
            }), 401
        return f(*args, **kwargs)
    return decorated_function


def create_user(username, email, password, display_name=None, db_path='meal_planner.db'):
    """Create a new user"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if username already exists
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            conn.close()
            return None, "Username already exists"

        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return None, "Email already exists"

        # Create user
        password_hash = hash_password(password)
        cursor.execute("""
            INSERT INTO users (username, email, password_hash, display_name)
            VALUES (?, ?, ?, ?)
        """, (username, email, password_hash, display_name or username))

        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return user_id, None

    except Exception as e:
        conn.rollback()
        conn.close()
        return None, str(e)


def authenticate_user(username, password, db_path='meal_planner.db'):
    """Authenticate a user by username and password"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, username, email, password_hash, display_name
        FROM users
        WHERE username = ?
    """, (username,))

    user = cursor.fetchone()

    if not user:
        conn.close()
        return None, "Invalid username or password"

    if not verify_password(password, user['password_hash']):
        conn.close()
        return None, "Invalid username or password"

    # Update last_login
    cursor.execute("""
        UPDATE users SET last_login = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (user['id'],))
    conn.commit()
    conn.close()

    return dict(user), None
