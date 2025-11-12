#!/usr/bin/env python3
"""
Test suite for error tracking system
Tests edge cases and ensures robust error handling
"""

import sys
import os
import json
import sqlite3

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
import pytest


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_log_error_basic(client):
    """Test basic error logging"""
    response = client.post('/api/errors/log',
        json={
            'error_type': 'api',
            'message': 'Test error',
            'stack_trace': 'at line 123',
            'component': 'TestComponent',
            'url': 'http://test.com/page',
            'browser_info': {
                'userAgent': 'Mozilla/5.0',
                'screenWidth': 1920,
                'screenHeight': 1080
            },
            'metadata': {
                'test': True
            }
        })

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert 'error_id' in data
    print(f"✓ Basic error logged with ID: {data['error_id']}")


def test_log_error_minimal(client):
    """Test error logging with minimal data"""
    response = client.post('/api/errors/log',
        json={
            'error_type': 'unknown',
            'message': 'Minimal error'
        })

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    print("✓ Minimal error logged successfully")


def test_log_error_with_null_values(client):
    """Test error logging with null values"""
    response = client.post('/api/errors/log',
        json={
            'error_type': 'network',
            'message': 'Error with nulls',
            'stack_trace': None,
            'component': None,
            'url': None,
            'browser_info': None,
            'metadata': None
        })

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    print("✓ Error with null values logged successfully")


def test_log_error_long_message(client):
    """Test error logging with very long message"""
    long_message = 'A' * 10000
    response = client.post('/api/errors/log',
        json={
            'error_type': 'validation',
            'message': long_message,
        })

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    print(f"✓ Error with long message ({len(long_message)} chars) logged successfully")


def test_log_error_complex_metadata(client):
    """Test error logging with complex nested metadata"""
    response = client.post('/api/errors/log',
        json={
            'error_type': 'api',
            'message': 'Complex metadata test',
            'metadata': {
                'nested': {
                    'level1': {
                        'level2': {
                            'level3': 'deep value'
                        }
                    }
                },
                'array': [1, 2, 3, 4, 5],
                'mixed': {
                    'string': 'value',
                    'number': 42,
                    'boolean': True,
                    'null': None
                }
            }
        })

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    print("✓ Error with complex metadata logged successfully")


def test_log_error_special_characters(client):
    """Test error logging with special characters"""
    response = client.post('/api/errors/log',
        json={
            'error_type': 'parse',
            'message': 'Error with special chars: <>&"\'`\n\t\r',
            'component': 'Component™️ ® © with émojis 🚀'
        })

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    print("✓ Error with special characters logged successfully")


def test_log_multiple_errors_rapidly(client):
    """Test logging many errors in rapid succession"""
    error_ids = []
    for i in range(50):
        response = client.post('/api/errors/log',
            json={
                'error_type': 'api',
                'message': f'Rapid error {i}',
            })

        assert response.status_code == 200
        data = json.loads(response.data)
        error_ids.append(data['error_id'])

    # Verify all errors have unique IDs
    assert len(error_ids) == len(set(error_ids))
    print(f"✓ {len(error_ids)} rapid errors logged with unique IDs")


def test_get_error_stats_unauthorized(client):
    """Test that error stats requires authentication"""
    response = client.get('/api/errors/stats')
    # Should redirect to login or return 401
    assert response.status_code in [302, 401]
    print("✓ Error stats endpoint properly requires authentication")


def test_error_database_structure():
    """Test that error_logs table has correct structure"""
    conn = sqlite3.connect('meal_planner.db')
    cursor = conn.cursor()

    # Check table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='error_logs'")
    assert cursor.fetchone() is not None

    # Check columns
    cursor.execute("PRAGMA table_info(error_logs)")
    columns = {row[1] for row in cursor.fetchall()}

    required_columns = {
        'id', 'timestamp', 'error_type', 'message', 'stack_trace',
        'component', 'url', 'user_id', 'session_id', 'browser_info',
        'metadata', 'resolved', 'resolved_at', 'resolved_by', 'notes'
    }

    assert required_columns.issubset(columns)

    # Check indexes exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='error_logs'")
    indexes = {row[0] for row in cursor.fetchall()}

    assert 'idx_error_logs_timestamp' in indexes
    assert 'idx_error_logs_type' in indexes
    assert 'idx_error_logs_resolved' in indexes

    conn.close()
    print("✓ Database structure verified with all required columns and indexes")


def test_error_log_retrieval():
    """Test retrieving errors directly from database"""
    conn = sqlite3.connect('meal_planner.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get recent errors
    cursor.execute("SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 5")
    errors = [dict(row) for row in cursor.fetchall()]

    print(f"✓ Retrieved {len(errors)} recent errors from database")

    if errors:
        # Verify JSON fields are valid
        for error in errors:
            if error['browser_info']:
                browser_info = json.loads(error['browser_info'])
                assert isinstance(browser_info, dict)

            if error['metadata']:
                metadata = json.loads(error['metadata'])
                assert isinstance(metadata, dict)

        print("✓ All JSON fields are valid and parseable")

    conn.close()


def run_all_tests():
    """Run all tests without pytest"""
    print("\n" + "="*60)
    print("🧪 ERROR TRACKING SYSTEM - COMPREHENSIVE TEST SUITE")
    print("="*60 + "\n")

    app.config['TESTING'] = True
    client = app.test_client()

    tests = [
        ("Basic Error Logging", lambda: test_log_error_basic(client)),
        ("Minimal Data", lambda: test_log_error_minimal(client)),
        ("Null Values", lambda: test_log_error_with_null_values(client)),
        ("Long Message", lambda: test_log_error_long_message(client)),
        ("Complex Metadata", lambda: test_log_error_complex_metadata(client)),
        ("Special Characters", lambda: test_log_error_special_characters(client)),
        ("Rapid Errors", lambda: test_log_multiple_errors_rapidly(client)),
        ("Authentication Check", lambda: test_get_error_stats_unauthorized(client)),
        ("Database Structure", test_error_database_structure),
        ("Error Retrieval", test_error_log_retrieval),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            print(f"\n📋 Testing: {name}")
            print("-" * 60)
            test_func()
            passed += 1
        except Exception as e:
            print(f"❌ FAILED: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "="*60)
    print(f"✅ Tests Passed: {passed}/{len(tests)}")
    if failed > 0:
        print(f"❌ Tests Failed: {failed}/{len(tests)}")
    else:
        print("🎉 All tests passed!")
    print("="*60 + "\n")


if __name__ == '__main__':
    run_all_tests()
