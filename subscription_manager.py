#!/usr/bin/env python3
"""
Subscription Manager - Handles all subscription and payment logic

This module provides a clean interface for:
- Creating and managing Stripe customers
- Handling subscriptions (create, upgrade, downgrade, cancel)
- Checking feature access permissions
- Tracking usage for rate limiting
- Processing webhook events from Stripe

Usage:
    from subscription_manager import SubscriptionManager

    sub_manager = SubscriptionManager(stripe_api_key)

    # Check if user can access a feature
    if sub_manager.can_use_feature(user_id, 'ai_recipe_parsing'):
        # Allow access
        pass

    # Create a checkout session
    session_url = sub_manager.create_checkout_session(
        user_id, 'family', success_url, cancel_url
    )
"""

import stripe
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
import os


class SubscriptionManager:
    """
    Manages user subscriptions and feature access

    This class handles all subscription-related operations including:
    - Stripe customer and subscription creation
    - Feature access validation
    - Usage tracking and rate limiting
    - Plan upgrades/downgrades
    - Cancellations and refunds
    """

    # Plan tier pricing (in cents)
    PLAN_PRICES = {
        'free': 0,
        'family': 999,  # $9.99/month
        'premium': 1999,  # $19.99/month
        'lifetime': 29900,  # $299 one-time
    }

    def __init__(self, stripe_api_key: str, db_path: str = None):
        """
        Initialize the subscription manager

        Args:
            stripe_api_key: Your Stripe secret key
            db_path: Path to SQLite database (uses meal_planner.db if None)
        """
        stripe.api_key = stripe_api_key

        # Get database path
        if db_path is None:
            # Import here to avoid circular dependency
            from meal_planner import MealPlannerDB
            db = MealPlannerDB()
            self.db_path = db.db_path
        else:
            self.db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection"""
        conn = sqlite3.Connection(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # =========================================================================
    # CUSTOMER MANAGEMENT
    # =========================================================================

    def get_or_create_stripe_customer(self, user_id: int, email: str, name: str = None) -> str:
        """
        Get existing Stripe customer ID or create a new one

        Args:
            user_id: Internal user ID
            email: User's email address
            name: User's display name (optional)

        Returns:
            Stripe customer ID

        Example:
            customer_id = sub_manager.get_or_create_stripe_customer(
                user_id=1,
                email='user@example.com',
                name='John Doe'
            )
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        # Check if customer already exists
        cursor.execute("""
            SELECT stripe_customer_id FROM subscriptions
            WHERE user_id = ? AND stripe_customer_id IS NOT NULL
        """, (user_id,))

        row = cursor.fetchone()
        if row and row['stripe_customer_id']:
            conn.close()
            return row['stripe_customer_id']

        # Create new Stripe customer
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={'user_id': str(user_id)}
            )

            # Update database
            cursor.execute("""
                UPDATE subscriptions
                SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (customer.id, user_id))

            conn.commit()
            conn.close()

            return customer.id

        except stripe.error.StripeError as e:
            conn.close()
            raise Exception(f"Failed to create Stripe customer: {str(e)}")

    # =========================================================================
    # CHECKOUT & SUBSCRIPTION CREATION
    # =========================================================================

    def create_checkout_session(
        self,
        user_id: int,
        plan_tier: str,
        success_url: str,
        cancel_url: str,
        trial_days: int = 14
    ) -> str:
        """
        Create a Stripe Checkout session for subscription

        Args:
            user_id: Internal user ID
            plan_tier: 'family', 'premium', or 'lifetime'
            success_url: Where to redirect after successful payment
            cancel_url: Where to redirect if user cancels
            trial_days: Number of trial days (default 14, set to 0 for no trial)

        Returns:
            Checkout session URL

        Example:
            session_url = sub_manager.create_checkout_session(
                user_id=1,
                plan_tier='family',
                success_url='https://myapp.com/success',
                cancel_url='https://myapp.com/cancel',
                trial_days=14
            )
            # Redirect user to session_url
        """
        if plan_tier not in ['family', 'premium', 'lifetime']:
            raise ValueError(f"Invalid plan tier: {plan_tier}")

        # Get or create Stripe customer
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT email, display_name FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            conn.close()
            raise ValueError(f"User {user_id} not found")

        customer_id = self.get_or_create_stripe_customer(
            user_id, user['email'], user['display_name']
        )

        # Create Stripe price if needed (you should create these in Stripe Dashboard)
        # For now, we'll create them on-the-fly
        price_data = {
            'currency': 'usd',
            'product_data': {
                'name': f'Meal Planner - {plan_tier.title()} Plan',
                'description': self._get_plan_description(plan_tier),
            },
            'unit_amount': self.PLAN_PRICES[plan_tier],
        }

        if plan_tier == 'lifetime':
            # One-time payment
            mode = 'payment'
        else:
            # Recurring subscription
            mode = 'subscription'
            price_data['recurring'] = {'interval': 'month'}

        try:
            # Create checkout session
            session_params = {
                'customer': customer_id,
                'payment_method_types': ['card'],
                'line_items': [{
                    'price_data': price_data,
                    'quantity': 1,
                }],
                'mode': mode,
                'success_url': success_url + '?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url': cancel_url,
                'metadata': {
                    'user_id': str(user_id),
                    'plan_tier': plan_tier,
                },
            }

            # Add trial period for subscriptions
            if mode == 'subscription' and trial_days > 0:
                session_params['subscription_data'] = {
                    'trial_period_days': trial_days,
                }

            session = stripe.checkout.Session.create(**session_params)

            conn.close()
            return session.url

        except stripe.error.StripeError as e:
            conn.close()
            raise Exception(f"Failed to create checkout session: {str(e)}")

    def _get_plan_description(self, plan_tier: str) -> str:
        """Get description for a plan tier"""
        descriptions = {
            'family': 'Unlimited recipes, AI parsing, nutrition tracking, meal prep mode',
            'premium': 'Everything in Family + AI assistant, family sharing, priority support',
            'lifetime': 'All Premium features forever - one-time payment',
        }
        return descriptions.get(plan_tier, '')

    # =========================================================================
    # WEBHOOK HANDLING
    # =========================================================================

    def handle_webhook_event(self, event_type: str, event_data: Dict[str, Any]) -> bool:
        """
        Handle Stripe webhook events

        Args:
            event_type: Type of event (e.g., 'checkout.session.completed')
            event_data: Event data from Stripe

        Returns:
            True if handled successfully, False otherwise

        Common event types:
        - checkout.session.completed: Payment succeeded
        - customer.subscription.updated: Subscription changed
        - customer.subscription.deleted: Subscription canceled
        - invoice.payment_succeeded: Recurring payment succeeded
        - invoice.payment_failed: Payment failed

        Example:
            # In your webhook endpoint
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
            sub_manager.handle_webhook_event(event['type'], event['data']['object'])
        """
        try:
            if event_type == 'checkout.session.completed':
                return self._handle_checkout_completed(event_data)

            elif event_type == 'customer.subscription.updated':
                return self._handle_subscription_updated(event_data)

            elif event_type == 'customer.subscription.deleted':
                return self._handle_subscription_deleted(event_data)

            elif event_type == 'invoice.payment_succeeded':
                return self._handle_payment_succeeded(event_data)

            elif event_type == 'invoice.payment_failed':
                return self._handle_payment_failed(event_data)

            else:
                print(f"⚠️  Unhandled webhook event: {event_type}")
                return True  # Don't fail on unknown events

        except Exception as e:
            print(f"❌ Error handling webhook {event_type}: {e}")
            return False

    def _handle_checkout_completed(self, session: Dict[str, Any]) -> bool:
        """Handle successful checkout"""
        user_id = int(session['metadata']['user_id'])
        plan_tier = session['metadata']['plan_tier']

        conn = self._get_connection()
        cursor = conn.cursor()

        if session['mode'] == 'subscription':
            # Subscription created
            subscription_id = session['subscription']

            # Fetch full subscription details
            subscription = stripe.Subscription.retrieve(subscription_id)

            cursor.execute("""
                UPDATE subscriptions
                SET
                    stripe_subscription_id = ?,
                    plan_tier = ?,
                    status = ?,
                    price_monthly = ?,
                    trial_start = ?,
                    trial_end = ?,
                    current_period_start = ?,
                    current_period_end = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (
                subscription_id,
                plan_tier,
                subscription['status'],
                self.PLAN_PRICES[plan_tier] / 100,  # Convert cents to dollars
                datetime.fromtimestamp(subscription['trial_start']) if subscription.get('trial_start') else None,
                datetime.fromtimestamp(subscription['trial_end']) if subscription.get('trial_end') else None,
                datetime.fromtimestamp(subscription['current_period_start']),
                datetime.fromtimestamp(subscription['current_period_end']),
                user_id
            ))

        else:
            # One-time payment (lifetime)
            cursor.execute("""
                UPDATE subscriptions
                SET
                    plan_tier = 'lifetime',
                    status = 'active',
                    price_monthly = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (user_id,))

        # Record payment
        cursor.execute("""
            INSERT INTO payment_history (
                user_id, stripe_payment_id, amount, status, description
            ) VALUES (?, ?, ?, 'succeeded', ?)
        """, (
            user_id,
            session['payment_intent'],
            session['amount_total'] / 100,  # Convert cents to dollars
            f"{plan_tier.title()} plan purchase"
        ))

        conn.commit()
        conn.close()

        print(f"✅ User {user_id} subscribed to {plan_tier} plan")
        return True

    def _handle_subscription_updated(self, subscription: Dict[str, Any]) -> bool:
        """Handle subscription updates"""
        customer_id = subscription['customer']

        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE subscriptions
            SET
                status = ?,
                current_period_start = ?,
                current_period_end = ?,
                cancel_at_period_end = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_customer_id = ?
        """, (
            subscription['status'],
            datetime.fromtimestamp(subscription['current_period_start']),
            datetime.fromtimestamp(subscription['current_period_end']),
            subscription['cancel_at_period_end'],
            customer_id
        ))

        conn.commit()
        conn.close()
        return True

    def _handle_subscription_deleted(self, subscription: Dict[str, Any]) -> bool:
        """Handle subscription cancellation"""
        customer_id = subscription['customer']

        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE subscriptions
            SET
                status = 'canceled',
                plan_tier = 'free',
                canceled_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_customer_id = ?
        """, (customer_id,))

        conn.commit()
        conn.close()
        return True

    def _handle_payment_succeeded(self, invoice: Dict[str, Any]) -> bool:
        """Handle successful recurring payment"""
        customer_id = invoice['customer']

        conn = self._get_connection()
        cursor = conn.cursor()

        # Get user_id from subscription
        cursor.execute("""
            SELECT id, user_id FROM subscriptions
            WHERE stripe_customer_id = ?
        """, (customer_id,))

        row = cursor.fetchone()
        if not row:
            conn.close()
            return False

        # Record payment
        cursor.execute("""
            INSERT INTO payment_history (
                user_id, subscription_id, stripe_invoice_id,
                amount, status, description, receipt_url
            ) VALUES (?, ?, ?, ?, 'succeeded', ?, ?)
        """, (
            row['user_id'],
            row['id'],
            invoice['id'],
            invoice['amount_paid'] / 100,
            f"Monthly subscription payment",
            invoice.get('hosted_invoice_url')
        ))

        conn.commit()
        conn.close()
        return True

    def _handle_payment_failed(self, invoice: Dict[str, Any]) -> bool:
        """Handle failed payment"""
        customer_id = invoice['customer']

        conn = self._get_connection()
        cursor = conn.cursor()

        # Update subscription status
        cursor.execute("""
            UPDATE subscriptions
            SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
            WHERE stripe_customer_id = ?
        """, (customer_id,))

        # Get user_id
        cursor.execute("""
            SELECT id, user_id FROM subscriptions
            WHERE stripe_customer_id = ?
        """, (customer_id,))

        row = cursor.fetchone()
        if row:
            # Record failed payment
            cursor.execute("""
                INSERT INTO payment_history (
                    user_id, subscription_id, stripe_invoice_id,
                    amount, status, description
                ) VALUES (?, ?, ?, ?, 'failed', ?)
            """, (
                row['user_id'],
                row['id'],
                invoice['id'],
                invoice['amount_due'] / 100,
                f"Payment failed - please update payment method"
            ))

        conn.commit()
        conn.close()
        return True

    # =========================================================================
    # FEATURE ACCESS CONTROL
    # =========================================================================

    def can_use_feature(self, user_id: int, feature_name: str) -> Tuple[bool, Optional[str]]:
        """
        Check if user can access a feature

        Args:
            user_id: Internal user ID
            feature_name: Feature to check (e.g., 'ai_recipe_parsing')

        Returns:
            Tuple of (can_access: bool, reason: str)
            - (True, None) if access granted
            - (False, "reason") if access denied

        Example:
            can_access, reason = sub_manager.can_use_feature(1, 'ai_recipe_parsing')
            if not can_access:
                return jsonify({'error': reason}), 403
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        # Get user's subscription
        cursor.execute("""
            SELECT plan_tier, status FROM subscriptions
            WHERE user_id = ?
        """, (user_id,))

        subscription = cursor.fetchone()
        if not subscription:
            conn.close()
            return False, "No subscription found"

        # Check if subscription is active
        if subscription['status'] not in ['active', 'trialing']:
            conn.close()
            return False, f"Subscription is {subscription['status']}. Please update your payment method."

        # Check feature access for this plan tier
        cursor.execute("""
            SELECT limit_value FROM plan_features
            WHERE plan_tier = ? AND feature_name = ?
        """, (subscription['plan_tier'], feature_name))

        feature = cursor.fetchone()
        if not feature:
            conn.close()
            return False, f"Feature '{feature_name}' not available in {subscription['plan_tier']} plan"

        limit_value = feature['limit_value']

        # If limit is 0, feature is disabled
        if limit_value == 0:
            conn.close()
            return False, f"Upgrade to use {feature_name}"

        # If limit is 1 (boolean feature), access granted
        if limit_value == 1:
            conn.close()
            return True, None

        # If limit is NULL (unlimited), access granted
        if limit_value is None:
            conn.close()
            return True, None

        # Check usage count for today
        cursor.execute("""
            SELECT usage_count FROM feature_usage
            WHERE user_id = ? AND feature_name = ? AND usage_date = DATE('now')
        """, (user_id, feature_name))

        usage = cursor.fetchone()
        current_usage = usage['usage_count'] if usage else 0

        conn.close()

        if current_usage >= limit_value:
            return False, f"Monthly limit reached for {feature_name} ({limit_value} per month)"

        return True, None

    def track_feature_usage(self, user_id: int, feature_name: str, count: int = 1) -> bool:
        """
        Track feature usage for rate limiting

        Args:
            user_id: Internal user ID
            feature_name: Feature being used
            count: How many times (default 1)

        Returns:
            True if tracked successfully

        Example:
            # Before using AI feature
            if sub_manager.can_use_feature(user_id, 'ai_recipe_parsing')[0]:
                # Use feature
                result = ai_parser.parse(recipe)

                # Track usage
                sub_manager.track_feature_usage(user_id, 'ai_recipe_parsing')
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO feature_usage (user_id, feature_name, usage_count, usage_date)
            VALUES (?, ?, ?, DATE('now'))
            ON CONFLICT(user_id, feature_name, usage_date)
            DO UPDATE SET usage_count = usage_count + ?
        """, (user_id, feature_name, count, count))

        conn.commit()
        conn.close()
        return True

    # =========================================================================
    # SUBSCRIPTION MANAGEMENT
    # =========================================================================

    def get_subscription(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user's current subscription details

        Args:
            user_id: Internal user ID

        Returns:
            Dictionary with subscription details or None

        Example:
            sub = sub_manager.get_subscription(user_id)
            print(f"Plan: {sub['plan_tier']}, Status: {sub['status']}")
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM subscriptions WHERE user_id = ?
        """, (user_id,))

        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        return dict(row)

    def cancel_subscription(self, user_id: int, at_period_end: bool = True) -> bool:
        """
        Cancel a user's subscription

        Args:
            user_id: Internal user ID
            at_period_end: If True, cancel at end of billing period (default)
                          If False, cancel immediately

        Returns:
            True if successful

        Example:
            # Cancel at end of billing period (user keeps access until then)
            sub_manager.cancel_subscription(user_id, at_period_end=True)

            # Cancel immediately (user loses access now)
            sub_manager.cancel_subscription(user_id, at_period_end=False)
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT stripe_subscription_id FROM subscriptions
            WHERE user_id = ?
        """, (user_id,))

        row = cursor.fetchone()
        if not row or not row['stripe_subscription_id']:
            conn.close()
            return False

        try:
            if at_period_end:
                # Cancel at period end
                stripe.Subscription.modify(
                    row['stripe_subscription_id'],
                    cancel_at_period_end=True
                )

                cursor.execute("""
                    UPDATE subscriptions
                    SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                """, (user_id,))

            else:
                # Cancel immediately
                stripe.Subscription.delete(row['stripe_subscription_id'])

                cursor.execute("""
                    UPDATE subscriptions
                    SET
                        status = 'canceled',
                        plan_tier = 'free',
                        canceled_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                """, (user_id,))

            conn.commit()
            conn.close()
            return True

        except stripe.error.StripeError as e:
            conn.close()
            raise Exception(f"Failed to cancel subscription: {str(e)}")

    def get_usage_stats(self, user_id: int, days: int = 30) -> Dict[str, int]:
        """
        Get feature usage statistics for a user

        Args:
            user_id: Internal user ID
            days: Number of days to look back (default 30)

        Returns:
            Dictionary of feature_name -> usage_count

        Example:
            stats = sub_manager.get_usage_stats(user_id, days=30)
            print(f"AI parses this month: {stats.get('ai_recipe_parsing', 0)}")
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT feature_name, SUM(usage_count) as total
            FROM feature_usage
            WHERE user_id = ?
              AND usage_date >= DATE('now', ?)
            GROUP BY feature_name
        """, (user_id, f'-{days} days'))

        stats = {row['feature_name']: row['total'] for row in cursor.fetchall()}

        conn.close()
        return stats


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def get_subscription_manager() -> SubscriptionManager:
    """
    Get a subscription manager instance with Stripe API key from environment

    Returns:
        Configured SubscriptionManager instance

    Raises:
        ValueError: If STRIPE_SECRET_KEY not found in environment

    Example:
        sub_manager = get_subscription_manager()
        can_access, reason = sub_manager.can_use_feature(user_id, 'ai_recipe_parsing')
    """
    api_key = os.getenv('STRIPE_SECRET_KEY')
    if not api_key:
        raise ValueError("STRIPE_SECRET_KEY environment variable not set")

    return SubscriptionManager(api_key)
