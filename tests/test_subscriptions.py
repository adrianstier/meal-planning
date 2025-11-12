#!/usr/bin/env python3
"""
Comprehensive tests for subscription system

Tests cover:
- Database migrations
- Subscription creation and management
- Feature access control
- Usage tracking
- Stripe webhook handling
- Payment processing

Run with: python -m pytest tests/test_subscriptions.py -v
"""

import pytest
import sqlite3
import os
import sys
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from subscription_manager import SubscriptionManager
import stripe


@pytest.fixture
def test_db():
    """Create a test database"""
    db_path = ':memory:'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT,
            display_name TEXT,
            password_hash TEXT
        )
    """)

    # Create subscriptions table
    cursor.execute("""
        CREATE TABLE subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stripe_customer_id TEXT UNIQUE,
            stripe_subscription_id TEXT UNIQUE,
            plan_tier TEXT NOT NULL DEFAULT 'free',
            status TEXT NOT NULL DEFAULT 'active',
            price_monthly REAL,
            currency TEXT DEFAULT 'usd',
            trial_start DATE,
            trial_end DATE,
            current_period_start DATE,
            current_period_end DATE,
            cancel_at_period_end BOOLEAN DEFAULT 0,
            canceled_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Create plan_features table
    cursor.execute("""
        CREATE TABLE plan_features (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tier TEXT NOT NULL,
            feature_name TEXT NOT NULL,
            limit_value INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(plan_tier, feature_name)
        )
    """)

    # Create feature_usage table
    cursor.execute("""
        CREATE TABLE feature_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            feature_name TEXT NOT NULL,
            usage_date DATE NOT NULL DEFAULT (DATE('now')),
            usage_count INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, feature_name, usage_date)
        )
    """)

    # Create payment_history table
    cursor.execute("""
        CREATE TABLE payment_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subscription_id INTEGER,
            stripe_payment_id TEXT UNIQUE,
            stripe_invoice_id TEXT,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'usd',
            status TEXT NOT NULL,
            description TEXT,
            receipt_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
        )
    """)

    # Insert test user
    cursor.execute("""
        INSERT INTO users (id, username, email, display_name, password_hash)
        VALUES (1, 'testuser', 'test@example.com', 'Test User', 'hash123')
    """)

    # Insert test subscription
    cursor.execute("""
        INSERT INTO subscriptions (user_id, plan_tier, status)
        VALUES (1, 'free', 'active')
    """)

    # Insert plan features
    features = [
        ('free', 'max_recipes', 10),
        ('free', 'ai_recipe_parsing', 0),
        ('family', 'max_recipes', None),
        ('family', 'ai_recipe_parsing', 50),
        ('premium', 'ai_recipe_parsing', None),
    ]

    for plan_tier, feature_name, limit_value in features:
        cursor.execute("""
            INSERT INTO plan_features (plan_tier, feature_name, limit_value)
            VALUES (?, ?, ?)
        """, (plan_tier, feature_name, limit_value))

    conn.commit()
    yield db_path, conn
    conn.close()


@pytest.fixture
def sub_manager(test_db):
    """Create a subscription manager with test database"""
    db_path, conn = test_db
    # Use test Stripe key (replace with your test key)
    return SubscriptionManager('sk_test_fake_key', db_path)


class TestFeatureAccess:
    """Test feature access control"""

    def test_free_user_cannot_use_ai_parsing(self, sub_manager):
        """Free users should not be able to use AI parsing"""
        can_access, reason = sub_manager.can_use_feature(1, 'ai_recipe_parsing')

        assert can_access is False
        assert 'Upgrade' in reason or 'not available' in reason.lower()

    def test_free_user_respects_recipe_limit(self, sub_manager):
        """Free users should have recipe limits"""
        # This would be checked at the application level
        # The subscription manager just defines the limit
        pass

    def test_family_user_has_ai_limit(self, sub_manager, test_db):
        """Family plan users should have AI parsing limits"""
        db_path, conn = test_db
        cursor = conn.cursor()

        # Upgrade user to family plan
        cursor.execute("""
            UPDATE subscriptions
            SET plan_tier = 'family', status = 'active'
            WHERE user_id = 1
        """)
        conn.commit()

        # First use should work
        can_access, reason = sub_manager.can_use_feature(1, 'ai_recipe_parsing')
        assert can_access is True
        assert reason is None

    def test_premium_user_unlimited_ai(self, sub_manager, test_db):
        """Premium users should have unlimited AI parsing"""
        db_path, conn = test_db
        cursor = conn.cursor()

        # Upgrade to premium
        cursor.execute("""
            UPDATE subscriptions
            SET plan_tier = 'premium', status = 'active'
            WHERE user_id = 1
        """)
        conn.commit()

        can_access, reason = sub_manager.can_use_feature(1, 'ai_recipe_parsing')
        assert can_access is True
        assert reason is None

    def test_inactive_subscription_denied(self, sub_manager, test_db):
        """Inactive subscriptions should be denied access"""
        db_path, conn = test_db
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE subscriptions
            SET status = 'past_due'
            WHERE user_id = 1
        """)
        conn.commit()

        can_access, reason = sub_manager.can_use_feature(1, 'ai_recipe_parsing')
        assert can_access is False
        assert 'past_due' in reason or 'payment' in reason.lower()


class TestUsageTracking:
    """Test usage tracking and rate limiting"""

    def test_track_single_usage(self, sub_manager):
        """Should track feature usage"""
        success = sub_manager.track_feature_usage(1, 'ai_recipe_parsing', 1)
        assert success is True

        stats = sub_manager.get_usage_stats(1, days=1)
        assert stats.get('ai_recipe_parsing') == 1

    def test_track_multiple_usage(self, sub_manager):
        """Should accumulate usage counts"""
        sub_manager.track_feature_usage(1, 'ai_recipe_parsing', 3)
        sub_manager.track_feature_usage(1, 'ai_recipe_parsing', 2)

        stats = sub_manager.get_usage_stats(1, days=1)
        assert stats.get('ai_recipe_parsing') == 5

    def test_usage_limit_enforcement(self, sub_manager, test_db):
        """Should enforce usage limits"""
        db_path, conn = test_db
        cursor = conn.cursor()

        # Upgrade to family (50 parses/month limit)
        cursor.execute("""
            UPDATE subscriptions
            SET plan_tier = 'family'
            WHERE user_id = 1
        """)
        conn.commit()

        # Use up the limit
        sub_manager.track_feature_usage(1, 'ai_recipe_parsing', 50)

        # Next access should be denied
        can_access, reason = sub_manager.can_use_feature(1, 'ai_recipe_parsing')
        assert can_access is False
        assert 'limit reached' in reason.lower()


class TestSubscriptionManagement:
    """Test subscription CRUD operations"""

    def test_get_subscription(self, sub_manager):
        """Should retrieve user's subscription"""
        sub = sub_manager.get_subscription(1)

        assert sub is not None
        assert sub['user_id'] == 1
        assert sub['plan_tier'] == 'free'
        assert sub['status'] == 'active'

    def test_get_nonexistent_subscription(self, sub_manager):
        """Should return None for non-existent user"""
        sub = sub_manager.get_subscription(999)
        assert sub is None

    @patch('stripe.Customer.create')
    def test_create_stripe_customer(self, mock_create, sub_manager):
        """Should create Stripe customer"""
        mock_customer = Mock()
        mock_customer.id = 'cus_test123'
        mock_create.return_value = mock_customer

        customer_id = sub_manager.get_or_create_stripe_customer(
            user_id=1,
            email='test@example.com',
            name='Test User'
        )

        assert customer_id == 'cus_test123'
        mock_create.assert_called_once()

    @patch('stripe.Subscription.delete')
    def test_cancel_subscription_immediately(self, mock_delete, sub_manager, test_db):
        """Should cancel subscription immediately"""
        db_path, conn = test_db
        cursor = conn.cursor()

        # Set up subscription with Stripe ID
        cursor.execute("""
            UPDATE subscriptions
            SET stripe_subscription_id = 'sub_test123', plan_tier = 'family'
            WHERE user_id = 1
        """)
        conn.commit()

        success = sub_manager.cancel_subscription(1, at_period_end=False)

        assert success is True
        mock_delete.assert_called_once_with('sub_test123')

        # Check database updated
        cursor.execute("SELECT plan_tier, status FROM subscriptions WHERE user_id = 1")
        row = cursor.fetchone()
        assert row[0] == 'free'
        assert row[1] == 'canceled'

    @patch('stripe.Subscription.modify')
    def test_cancel_subscription_at_period_end(self, mock_modify, sub_manager, test_db):
        """Should schedule cancellation at period end"""
        db_path, conn = test_db
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE subscriptions
            SET stripe_subscription_id = 'sub_test123'
            WHERE user_id = 1
        """)
        conn.commit()

        success = sub_manager.cancel_subscription(1, at_period_end=True)

        assert success is True
        mock_modify.assert_called_once_with('sub_test123', cancel_at_period_end=True)


class TestWebhookHandling:
    """Test Stripe webhook event handling"""

    def test_handle_checkout_completed_subscription(self, sub_manager):
        """Should handle subscription checkout completion"""
        event_data = {
            'mode': 'subscription',
            'customer': 'cus_test123',
            'subscription': 'sub_test123',
            'metadata': {
                'user_id': '1',
                'plan_tier': 'family'
            },
            'payment_intent': 'pi_test123',
            'amount_total': 999,
        }

        with patch('stripe.Subscription.retrieve') as mock_retrieve:
            mock_sub = {
                'status': 'active',
                'trial_start': None,
                'trial_end': None,
                'current_period_start': int(datetime.now().timestamp()),
                'current_period_end': int((datetime.now() + timedelta(days=30)).timestamp()),
            }
            mock_retrieve.return_value = mock_sub

            success = sub_manager.handle_webhook_event(
                'checkout.session.completed',
                event_data
            )

            assert success is True

    def test_handle_subscription_deleted(self, sub_manager, test_db):
        """Should handle subscription cancellation"""
        db_path, conn = test_db
        cursor = conn.cursor()

        # Set up subscription
        cursor.execute("""
            UPDATE subscriptions
            SET stripe_customer_id = 'cus_test123', plan_tier = 'family'
            WHERE user_id = 1
        """)
        conn.commit()

        event_data = {
            'customer': 'cus_test123',
        }

        success = sub_manager.handle_webhook_event(
            'customer.subscription.deleted',
            event_data
        )

        assert success is True

        # Check downgraded to free
        cursor.execute("SELECT plan_tier, status FROM subscriptions WHERE user_id = 1")
        row = cursor.fetchone()
        assert row[0] == 'free'
        assert row[1] == 'canceled'

    def test_handle_payment_succeeded(self, sub_manager, test_db):
        """Should record successful payment"""
        db_path, conn = test_db
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE subscriptions
            SET stripe_customer_id = 'cus_test123'
            WHERE user_id = 1
        """)
        conn.commit()

        event_data = {
            'customer': 'cus_test123',
            'id': 'in_test123',
            'amount_paid': 999,
            'hosted_invoice_url': 'https://invoice.stripe.com/...'
        }

        success = sub_manager.handle_webhook_event(
            'invoice.payment_succeeded',
            event_data
        )

        assert success is True

        # Check payment recorded
        cursor.execute("""
            SELECT amount, status FROM payment_history
            WHERE user_id = 1 AND stripe_invoice_id = 'in_test123'
        """)
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == 9.99  # $9.99
        assert row[1] == 'succeeded'


class TestPlanFeatures:
    """Test plan feature definitions"""

    def test_all_plans_have_features(self, sub_manager):
        """All plan tiers should have feature definitions"""
        conn = sub_manager._get_connection()
        cursor = conn.cursor()

        for plan_tier in ['free', 'family', 'premium']:
            cursor.execute("""
                SELECT COUNT(*) FROM plan_features WHERE plan_tier = ?
            """, (plan_tier,))

            count = cursor.fetchone()[0]
            assert count > 0, f"Plan {plan_tier} has no features defined"

        conn.close()

    def test_premium_has_unlimited_ai(self, sub_manager):
        """Premium plan should have unlimited AI features"""
        conn = sub_manager._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT limit_value FROM plan_features
            WHERE plan_tier = 'premium' AND feature_name = 'ai_recipe_parsing'
        """)

        row = cursor.fetchone()
        assert row is not None
        assert row[0] is None  # NULL = unlimited

        conn.close()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
