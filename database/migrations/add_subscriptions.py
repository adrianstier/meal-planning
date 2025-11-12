#!/usr/bin/env python3
"""
Add subscriptions table for Stripe payment tracking

This migration creates a comprehensive subscription management system:
- Tracks user subscriptions (free, family, premium)
- Stores Stripe customer and subscription IDs
- Manages trial periods and cancellations
- Records payment history
"""

import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from meal_planner import MealPlannerDB


def migrate():
    """Add subscriptions and payment tracking tables"""
    db = MealPlannerDB()
    db_path = db.db_path
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("📦 Creating subscriptions table...")

    # Main subscriptions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,

            -- Stripe identifiers
            stripe_customer_id TEXT UNIQUE,
            stripe_subscription_id TEXT UNIQUE,

            -- Subscription details
            plan_tier TEXT NOT NULL DEFAULT 'free',  -- free, family, premium, lifetime
            status TEXT NOT NULL DEFAULT 'active',  -- active, trialing, past_due, canceled, paused

            -- Billing
            price_monthly REAL,  -- Monthly price in dollars (NULL for free)
            currency TEXT DEFAULT 'usd',

            -- Trial tracking
            trial_start DATE,
            trial_end DATE,

            -- Subscription lifecycle
            current_period_start DATE,
            current_period_end DATE,
            cancel_at_period_end BOOLEAN DEFAULT 0,
            canceled_at DATETIME,

            -- Timestamps
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            -- Foreign key
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    print("📦 Creating payment history table...")

    # Payment history for analytics
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payment_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subscription_id INTEGER,

            -- Stripe details
            stripe_payment_id TEXT UNIQUE,
            stripe_invoice_id TEXT,

            -- Payment info
            amount REAL NOT NULL,  -- Amount in dollars
            currency TEXT DEFAULT 'usd',
            status TEXT NOT NULL,  -- succeeded, failed, refunded

            -- Details
            description TEXT,
            receipt_url TEXT,

            -- Timestamps
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
        )
    """)

    print("📦 Creating feature access table...")

    # Track which features each plan tier gets
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS plan_features (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tier TEXT NOT NULL,  -- free, family, premium, lifetime
            feature_name TEXT NOT NULL,  -- ai_parsing, nutrition, analytics, etc.
            limit_value INTEGER,  -- NULL = unlimited, number = max usage
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(plan_tier, feature_name)
        )
    """)

    print("📦 Creating feature usage tracking table...")

    # Track usage for rate limiting
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feature_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            feature_name TEXT NOT NULL,
            usage_date DATE NOT NULL DEFAULT (DATE('now')),
            usage_count INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, feature_name, usage_date)
        )
    """)

    print("📦 Adding indexes for performance...")

    # Indexes for fast queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user
        ON subscriptions(user_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
        ON subscriptions(stripe_customer_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_payment_history_user
        ON payment_history(user_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_feature_usage_user_date
        ON feature_usage(user_id, usage_date)
    """)

    print("📦 Seeding default plan features...")

    # Define what each plan tier gets
    plan_features_data = [
        # Free tier - limited features
        ('free', 'max_recipes', 10),
        ('free', 'ai_recipe_parsing', 0),  # 0 = disabled
        ('free', 'meal_planning', 1),  # 1 = enabled unlimited
        ('free', 'shopping_lists', 1),
        ('free', 'nutrition_tracking', 0),
        ('free', 'analytics', 0),
        ('free', 'meal_prep_mode', 0),
        ('free', 'budget_tracking', 0),

        # Family tier ($9.99/month) - most features
        ('family', 'max_recipes', None),  # NULL = unlimited
        ('family', 'ai_recipe_parsing', 50),  # 50 per month
        ('family', 'meal_planning', 1),
        ('family', 'shopping_lists', 1),
        ('family', 'nutrition_tracking', 1),
        ('family', 'analytics', 1),
        ('family', 'meal_prep_mode', 1),
        ('family', 'budget_tracking', 1),
        ('family', 'recipe_collections', 1),
        ('family', 'leftover_intelligence', 1),

        # Premium tier ($19.99/month) - all features
        ('premium', 'max_recipes', None),
        ('premium', 'ai_recipe_parsing', None),  # Unlimited
        ('premium', 'meal_planning', 1),
        ('premium', 'shopping_lists', 1),
        ('premium', 'nutrition_tracking', 1),
        ('premium', 'analytics', 1),
        ('premium', 'meal_prep_mode', 1),
        ('premium', 'budget_tracking', 1),
        ('premium', 'recipe_collections', 1),
        ('premium', 'leftover_intelligence', 1),
        ('premium', 'ai_meal_assistant', 1),
        ('premium', 'family_sharing', 5),  # Up to 5 family members
        ('premium', 'priority_support', 1),
        ('premium', 'export_pdf', 1),

        # Lifetime - same as premium
        ('lifetime', 'max_recipes', None),
        ('lifetime', 'ai_recipe_parsing', None),
        ('lifetime', 'meal_planning', 1),
        ('lifetime', 'shopping_lists', 1),
        ('lifetime', 'nutrition_tracking', 1),
        ('lifetime', 'analytics', 1),
        ('lifetime', 'meal_prep_mode', 1),
        ('lifetime', 'budget_tracking', 1),
        ('lifetime', 'recipe_collections', 1),
        ('lifetime', 'leftover_intelligence', 1),
        ('lifetime', 'ai_meal_assistant', 1),
        ('lifetime', 'family_sharing', 10),  # More family members
        ('lifetime', 'priority_support', 1),
        ('lifetime', 'export_pdf', 1),
    ]

    for plan_tier, feature_name, limit_value in plan_features_data:
        cursor.execute("""
            INSERT OR IGNORE INTO plan_features (plan_tier, feature_name, limit_value)
            VALUES (?, ?, ?)
        """, (plan_tier, feature_name, limit_value))

    print("📦 Creating default free subscriptions for existing users...")

    # Give all existing users a free subscription
    cursor.execute("""
        INSERT INTO subscriptions (user_id, plan_tier, status)
        SELECT id, 'free', 'active'
        FROM users
        WHERE id NOT IN (SELECT user_id FROM subscriptions)
    """)

    conn.commit()
    conn.close()

    print("✅ Subscriptions migration complete!")
    print("   - subscriptions table created")
    print("   - payment_history table created")
    print("   - plan_features table created with 4 tiers")
    print("   - feature_usage tracking table created")
    print("   - Existing users given free subscriptions")


if __name__ == '__main__':
    migrate()
