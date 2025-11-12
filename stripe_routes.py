#!/usr/bin/env python3
"""
Stripe Payment Routes

This module contains all Stripe-related API endpoints for:
- Creating checkout sessions
- Managing subscriptions
- Handling webhooks
- Checking subscription status

These routes are imported into app.py

IMPORTANT: Before using in production:
1. Set STRIPE_SECRET_KEY in .env
2. Set STRIPE_WEBHOOK_SECRET in .env (from Stripe Dashboard)
3. Configure webhooks in Stripe Dashboard to point to /api/stripe/webhook
4. Test with Stripe CLI: stripe listen --forward-to localhost:5001/api/stripe/webhook
"""

from flask import Blueprint, request, jsonify, session
import stripe
import os
from subscription_manager import get_subscription_manager
from auth import get_current_user_id, login_required

# Create blueprint
stripe_bp = Blueprint('stripe', __name__, url_prefix='/api/stripe')

# Stripe webhook secret (set in Stripe Dashboard)
WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET')


# =============================================================================
# CHECKOUT & SUBSCRIPTION CREATION
# =============================================================================

@stripe_bp.route('/create-checkout-session', methods=['POST'])
@login_required
def create_checkout_session():
    """
    Create a Stripe Checkout session for subscription

    POST /api/stripe/create-checkout-session
    Body: {
        "plan_tier": "family" | "premium" | "lifetime",
        "trial_days": 14 (optional, default 14)
    }

    Returns: {
        "success": true,
        "checkout_url": "https://checkout.stripe.com/...",
        "session_id": "cs_..."
    }

    Usage from frontend:
        fetch('/api/stripe/create-checkout-session', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({plan_tier: 'family'})
        })
        .then(r => r.json())
        .then(data => {
            window.location.href = data.checkout_url;
        })
    """
    try:
        data = request.get_json()
        plan_tier = data.get('plan_tier')
        trial_days = data.get('trial_days', 14)

        # Validate plan tier
        if plan_tier not in ['family', 'premium', 'lifetime']:
            return jsonify({
                'success': False,
                'error': 'Invalid plan tier. Must be family, premium, or lifetime'
            }), 400

        user_id = get_current_user_id()

        # Get base URL from request
        base_url = request.host_url.rstrip('/')

        # Create checkout session
        sub_manager = get_subscription_manager()
        checkout_url = sub_manager.create_checkout_session(
            user_id=user_id,
            plan_tier=plan_tier,
            success_url=f"{base_url}/subscription/success",
            cancel_url=f"{base_url}/subscription/cancel",
            trial_days=trial_days
        )

        return jsonify({
            'success': True,
            'checkout_url': checkout_url
        })

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        print(f"❌ Error creating checkout session: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to create checkout session'
        }), 500


@stripe_bp.route('/create-portal-session', methods=['POST'])
@login_required
def create_portal_session():
    """
    Create a Stripe Customer Portal session for managing subscription

    POST /api/stripe/create-portal-session

    Returns: {
        "success": true,
        "portal_url": "https://billing.stripe.com/..."
    }

    Usage:
    User can manage their subscription, update payment method, view invoices
    """
    try:
        user_id = get_current_user_id()
        sub_manager = get_subscription_manager()

        # Get user's subscription
        subscription = sub_manager.get_subscription(user_id)
        if not subscription or not subscription.get('stripe_customer_id'):
            return jsonify({
                'success': False,
                'error': 'No subscription found'
            }), 404

        # Create portal session
        base_url = request.host_url.rstrip('/')
        portal_session = stripe.billing_portal.Session.create(
            customer=subscription['stripe_customer_id'],
            return_url=f"{base_url}/settings"
        )

        return jsonify({
            'success': True,
            'portal_url': portal_session.url
        })

    except Exception as e:
        print(f"❌ Error creating portal session: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to create portal session'
        }), 500


# =============================================================================
# SUBSCRIPTION STATUS
# =============================================================================

@stripe_bp.route('/subscription', methods=['GET'])
@login_required
def get_subscription():
    """
    Get current user's subscription details

    GET /api/stripe/subscription

    Returns: {
        "success": true,
        "subscription": {
            "plan_tier": "family",
            "status": "active",
            "price_monthly": 9.99,
            "trial_end": "2024-01-15",
            "current_period_end": "2024-02-01",
            "cancel_at_period_end": false
        }
    }
    """
    try:
        user_id = get_current_user_id()
        sub_manager = get_subscription_manager()

        subscription = sub_manager.get_subscription(user_id)
        if not subscription:
            return jsonify({
                'success': False,
                'error': 'No subscription found'
            }), 404

        # Convert datetime objects to strings
        sub_dict = dict(subscription)
        for key in ['trial_start', 'trial_end', 'current_period_start', 'current_period_end', 'canceled_at', 'created_at', 'updated_at']:
            if sub_dict.get(key):
                sub_dict[key] = str(sub_dict[key])

        return jsonify({
            'success': True,
            'subscription': sub_dict
        })

    except Exception as e:
        print(f"❌ Error fetching subscription: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch subscription'
        }), 500


@stripe_bp.route('/can-use-feature/<feature_name>', methods=['GET'])
@login_required
def can_use_feature(feature_name):
    """
    Check if current user can access a feature

    GET /api/stripe/can-use-feature/ai_recipe_parsing

    Returns: {
        "success": true,
        "can_access": true,
        "reason": null
    }

    OR: {
        "success": true,
        "can_access": false,
        "reason": "Upgrade to use ai_recipe_parsing"
    }
    """
    try:
        user_id = get_current_user_id()
        sub_manager = get_subscription_manager()

        can_access, reason = sub_manager.can_use_feature(user_id, feature_name)

        return jsonify({
            'success': True,
            'can_access': can_access,
            'reason': reason
        })

    except Exception as e:
        print(f"❌ Error checking feature access: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to check feature access'
        }), 500


@stripe_bp.route('/usage-stats', methods=['GET'])
@login_required
def get_usage_stats():
    """
    Get feature usage statistics for current user

    GET /api/stripe/usage-stats?days=30

    Returns: {
        "success": true,
        "stats": {
            "ai_recipe_parsing": 15,
            "ai_meal_assistant": 3
        },
        "limits": {
            "ai_recipe_parsing": 50,
            "ai_meal_assistant": null  // null = unlimited
        }
    }
    """
    try:
        user_id = get_current_user_id()
        days = request.args.get('days', 30, type=int)

        sub_manager = get_subscription_manager()

        # Get usage stats
        stats = sub_manager.get_usage_stats(user_id, days)

        # Get limits for current plan
        subscription = sub_manager.get_subscription(user_id)
        plan_tier = subscription['plan_tier'] if subscription else 'free'

        # Get limits from database
        import sqlite3
        conn = sub_manager._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT feature_name, limit_value
            FROM plan_features
            WHERE plan_tier = ?
        """, (plan_tier,))

        limits = {row['feature_name']: row['limit_value'] for row in cursor.fetchall()}
        conn.close()

        return jsonify({
            'success': True,
            'stats': stats,
            'limits': limits,
            'plan_tier': plan_tier
        })

    except Exception as e:
        print(f"❌ Error fetching usage stats: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch usage stats'
        }), 500


# =============================================================================
# SUBSCRIPTION MANAGEMENT
# =============================================================================

@stripe_bp.route('/cancel', methods=['POST'])
@login_required
def cancel_subscription():
    """
    Cancel user's subscription

    POST /api/stripe/cancel
    Body: {
        "immediately": false  // If true, cancel now. If false, cancel at period end
    }

    Returns: {
        "success": true,
        "message": "Subscription will be canceled at period end"
    }
    """
    try:
        data = request.get_json() or {}
        immediately = data.get('immediately', False)

        user_id = get_current_user_id()
        sub_manager = get_subscription_manager()

        success = sub_manager.cancel_subscription(
            user_id,
            at_period_end=not immediately
        )

        if success:
            if immediately:
                message = "Subscription canceled immediately"
            else:
                message = "Subscription will be canceled at the end of the billing period"

            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No active subscription to cancel'
            }), 404

    except Exception as e:
        print(f"❌ Error canceling subscription: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to cancel subscription'
        }), 500


# =============================================================================
# WEBHOOKS
# =============================================================================

@stripe_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    """
    Handle Stripe webhook events

    POST /api/stripe/webhook

    This endpoint receives events from Stripe when:
    - A payment succeeds/fails
    - A subscription is created/updated/canceled
    - A customer is updated

    IMPORTANT: This endpoint must be public (no @login_required)

    To test locally:
    1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
    2. Run: stripe listen --forward-to localhost:5001/api/stripe/webhook
    3. Copy the webhook secret and set STRIPE_WEBHOOK_SECRET in .env
    """
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')

    if not WEBHOOK_SECRET:
        print("⚠️  STRIPE_WEBHOOK_SECRET not set - webhook verification disabled")
        # In development, you can parse without verification
        # In production, ALWAYS verify
        event = stripe.Event.construct_from(
            request.get_json(), stripe.api_key
        )
    else:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, WEBHOOK_SECRET
            )
        except ValueError as e:
            print(f"❌ Invalid webhook payload: {e}")
            return jsonify({'error': 'Invalid payload'}), 400
        except stripe.error.SignatureVerificationError as e:
            print(f"❌ Invalid webhook signature: {e}")
            return jsonify({'error': 'Invalid signature'}), 400

    # Handle the event
    event_type = event['type']
    event_data = event['data']['object']

    print(f"📨 Received webhook: {event_type}")

    try:
        sub_manager = get_subscription_manager()
        success = sub_manager.handle_webhook_event(event_type, event_data)

        if success:
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False}), 500

    except Exception as e:
        print(f"❌ Error handling webhook: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# PRICING INFORMATION (PUBLIC)
# =============================================================================

@stripe_bp.route('/pricing', methods=['GET'])
def get_pricing():
    """
    Get pricing information for all plans

    GET /api/stripe/pricing

    Returns: {
        "success": true,
        "plans": {
            "free": {...},
            "family": {...},
            "premium": {...},
            "lifetime": {...}
        }
    }

    This endpoint is public (no login required) for the pricing page
    """
    try:
        from subscription_manager import SubscriptionManager

        plans = {
            'free': {
                'name': 'Free',
                'price_monthly': 0,
                'price_annual': 0,
                'features': [
                    'Up to 10 recipes',
                    'Basic meal planning',
                    'Shopping lists',
                    'School menu tracking (3 months)',
                ],
                'limits': {
                    'max_recipes': 10,
                    'ai_recipe_parsing': 0,
                }
            },
            'family': {
                'name': 'Family',
                'price_monthly': 9.99,
                'price_annual': 99,  # $8.25/month
                'features': [
                    'Unlimited recipes',
                    '50 AI recipe parses/month',
                    'Nutrition tracking',
                    'Analytics dashboard',
                    'Meal prep mode',
                    'Budget tracking',
                    'Recipe collections',
                    'Leftover intelligence',
                ],
                'popular': True  # Show "Most Popular" badge
            },
            'premium': {
                'name': 'Premium',
                'price_monthly': 19.99,
                'price_annual': 199,  # $16.58/month
                'features': [
                    'Everything in Family',
                    'Unlimited AI features',
                    'AI meal planning assistant',
                    'Family sharing (5 members)',
                    'Priority support',
                    'Export to PDF',
                    'Early access to features',
                ]
            },
            'lifetime': {
                'name': 'Lifetime',
                'price_onetime': 299,
                'features': [
                    'All Premium features forever',
                    'Family sharing (10 members)',
                    'Founding member badge',
                    'Never pay again',
                ],
                'badge': 'Best Value'
            }
        }

        return jsonify({
            'success': True,
            'plans': plans
        })

    except Exception as e:
        print(f"❌ Error fetching pricing: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch pricing'
        }), 500
