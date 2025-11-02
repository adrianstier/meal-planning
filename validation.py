#!/usr/bin/env python3
"""
Input validation utilities for API endpoints
Provides validation functions and decorators
"""

from functools import wraps
from flask import request, jsonify
from typing import Dict, List, Any, Callable, Optional
import re


class ValidationError(Exception):
    """Custom exception for validation errors"""
    def __init__(self, message: str, field: str = None):
        self.message = message
        self.field = field
        super().__init__(self.message)


def validate_meal_data(data: Dict) -> Dict:
    """
    Validate meal creation/update data
    Returns cleaned data or raises ValidationError
    """
    errors = []

    # Name validation
    if 'name' in data:
        name = data.get('name', '').strip()
        if not name:
            errors.append({'field': 'name', 'message': 'Name is required'})
        elif len(name) < 2:
            errors.append({'field': 'name', 'message': 'Name must be at least 2 characters'})
        elif len(name) > 200:
            errors.append({'field': 'name', 'message': 'Name must be less than 200 characters'})
        else:
            data['name'] = name

    # Meal type validation
    if 'meal_type' in data:
        valid_types = ['breakfast', 'lunch', 'dinner', 'snack']
        if data['meal_type'] not in valid_types:
            errors.append({'field': 'meal_type', 'message': f'Meal type must be one of: {", ".join(valid_types)}'})

    # Cook time validation
    if 'cook_time_minutes' in data:
        try:
            cook_time = int(data['cook_time_minutes'])
            if cook_time < 0:
                errors.append({'field': 'cook_time_minutes', 'message': 'Cook time cannot be negative'})
            elif cook_time > 1440:  # 24 hours
                errors.append({'field': 'cook_time_minutes', 'message': 'Cook time cannot exceed 24 hours'})
            else:
                data['cook_time_minutes'] = cook_time
        except (ValueError, TypeError):
            errors.append({'field': 'cook_time_minutes', 'message': 'Cook time must be a number'})

    # Servings validation
    if 'servings' in data:
        try:
            servings = int(data['servings'])
            if servings < 1:
                errors.append({'field': 'servings', 'message': 'Servings must be at least 1'})
            elif servings > 100:
                errors.append({'field': 'servings', 'message': 'Servings cannot exceed 100'})
            else:
                data['servings'] = servings
        except (ValueError, TypeError):
            errors.append({'field': 'servings', 'message': 'Servings must be a number'})

    # Difficulty validation
    if 'difficulty' in data:
        valid_difficulties = ['easy', 'medium', 'hard']
        if data['difficulty'] not in valid_difficulties:
            errors.append({'field': 'difficulty', 'message': f'Difficulty must be one of: {", ".join(valid_difficulties)}'})

    # Kid rating validation
    if 'kid_rating' in data:
        try:
            if data['kid_rating'] is not None:
                rating = int(data['kid_rating'])
                if rating < 1 or rating > 5:
                    errors.append({'field': 'kid_rating', 'message': 'Kid rating must be between 1 and 5'})
                else:
                    data['kid_rating'] = rating
        except (ValueError, TypeError):
            errors.append({'field': 'kid_rating', 'message': 'Kid rating must be a number'})

    # Ingredients validation
    if 'ingredients' in data:
        ingredients = data.get('ingredients', '').strip()
        if len(ingredients) > 5000:
            errors.append({'field': 'ingredients', 'message': 'Ingredients text too long (max 5000 characters)'})
        else:
            data['ingredients'] = ingredients

    # Instructions validation
    if 'instructions' in data:
        instructions = data.get('instructions', '').strip()
        if len(instructions) > 10000:
            errors.append({'field': 'instructions', 'message': 'Instructions text too long (max 10000 characters)'})
        else:
            data['instructions'] = instructions

    # Tags validation
    if 'tags' in data:
        tags = data.get('tags', '').strip()
        if len(tags) > 500:
            errors.append({'field': 'tags', 'message': 'Tags text too long (max 500 characters)'})
        else:
            data['tags'] = tags

    # Cuisine validation
    if 'cuisine' in data:
        cuisine = data.get('cuisine', '').strip()
        if len(cuisine) > 50:
            errors.append({'field': 'cuisine', 'message': 'Cuisine name too long (max 50 characters)'})
        else:
            data['cuisine'] = cuisine if cuisine else None

    # Image URL validation
    if 'image_url' in data:
        image_url = data.get('image_url', '').strip()
        if image_url and not (image_url.startswith('http://') or image_url.startswith('https://') or image_url.startswith('/')):
            errors.append({'field': 'image_url', 'message': 'Invalid image URL format'})
        else:
            data['image_url'] = image_url if image_url else None

    if errors:
        raise ValidationError('Validation failed', errors)

    return data


def validate_shopping_item(data: Dict) -> Dict:
    """Validate shopping item data"""
    errors = []

    # Item name validation
    if 'item_name' in data:
        item_name = data.get('item_name', '').strip()
        if not item_name:
            errors.append({'field': 'item_name', 'message': 'Item name is required'})
        elif len(item_name) > 200:
            errors.append({'field': 'item_name', 'message': 'Item name too long (max 200 characters)'})
        else:
            data['item_name'] = item_name

    # Category validation
    if 'category' in data:
        category = data.get('category', '').strip()
        if len(category) > 50:
            errors.append({'field': 'category', 'message': 'Category name too long (max 50 characters)'})
        else:
            data['category'] = category if category else None

    # Quantity validation
    if 'quantity' in data:
        quantity = data.get('quantity', '').strip()
        if len(quantity) > 50:
            errors.append({'field': 'quantity', 'message': 'Quantity text too long (max 50 characters)'})
        else:
            data['quantity'] = quantity if quantity else None

    if errors:
        raise ValidationError('Validation failed', errors)

    return data


def validate_date(date_str: str, field_name: str = 'date') -> str:
    """Validate date string in YYYY-MM-DD format"""
    if not date_str:
        raise ValidationError(f'{field_name} is required', field_name)

    # Check format
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        raise ValidationError(f'{field_name} must be in YYYY-MM-DD format', field_name)

    # Try to parse it
    from datetime import datetime
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        return date_str
    except ValueError:
        raise ValidationError(f'Invalid {field_name}', field_name)


def validate_required_fields(data: Dict, required_fields: List[str]) -> None:
    """Check that all required fields are present"""
    missing = [field for field in required_fields if field not in data or data[field] is None]
    if missing:
        raise ValidationError(f'Missing required fields: {", ".join(missing)}')


def validate_request(validation_func: Callable):
    """
    Decorator to validate request data using a validation function
    Usage:
        @validate_request(validate_meal_data)
        def create_meal():
            data = request.json
            # data is already validated here
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                data = request.json
                if data is None:
                    return jsonify({
                        'success': False,
                        'error': 'Request body must be JSON'
                    }), 400

                # Run validation
                validated_data = validation_func(data)

                # Replace request.json with validated data
                request.validated_data = validated_data

                return f(*args, **kwargs)

            except ValidationError as e:
                return jsonify({
                    'success': False,
                    'error': 'Validation failed',
                    'details': e.message if isinstance(e.message, list) else [{'message': str(e.message)}]
                }), 400
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': 'Invalid request data',
                    'details': str(e)
                }), 400

        return decorated_function
    return decorator


def sanitize_sql_string(value: str) -> str:
    """
    Sanitize string for SQL (basic protection)
    NOTE: Always prefer parameterized queries over this!
    """
    if not isinstance(value, str):
        return value

    # Remove any SQL injection attempts
    dangerous_patterns = [
        r';\s*DROP',
        r';\s*DELETE',
        r';\s*UPDATE',
        r';\s*INSERT',
        r'--',
        r'/\*',
        r'\*/',
        r'xp_',
        r'sp_',
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, value, re.IGNORECASE):
            raise ValidationError('Invalid characters in input')

    return value
