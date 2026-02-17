-- ============================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR MEAL PLANNING APP
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROFILES (extends Supabase Auth users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. MEAL TYPES (reference table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meal_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

INSERT INTO public.meal_types (name, description) VALUES
    ('dinner', 'Evening meal'),
    ('lunch', 'Midday meal'),
    ('snack', 'Light snack'),
    ('breakfast', 'Morning meal')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. INGREDIENTS CATALOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ingredients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    kid_friendly_level INTEGER DEFAULT 5 CHECK (kid_friendly_level BETWEEN 1 AND 10),
    prep_difficulty TEXT DEFAULT 'easy' CHECK (prep_difficulty IN ('easy', 'medium', 'hard')),
    notes TEXT
);

-- ============================================================================
-- 4. MEALS (RECIPES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meals (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    meal_type TEXT,
    kid_friendly_level INTEGER DEFAULT 5 CHECK (kid_friendly_level BETWEEN 1 AND 10),
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    notes TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    servings INTEGER DEFAULT 4,
    tags TEXT,
    ingredients TEXT,
    instructions TEXT,
    cuisine TEXT,
    image_url TEXT,
    source_url TEXT,
    top_comments TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    makes_leftovers BOOLEAN DEFAULT FALSE,
    leftover_servings INTEGER,
    leftover_days INTEGER,
    kid_rating INTEGER CHECK (kid_rating BETWEEN 1 AND 10),
    last_cooked DATE,
    times_cooked INTEGER DEFAULT 0,
    is_leftover BOOLEAN DEFAULT FALSE,
    original_meal_id INTEGER REFERENCES public.meals(id),
    calories INTEGER,
    protein_g DECIMAL(10, 2),
    carbs_g DECIMAL(10, 2),
    fat_g DECIMAL(10, 2),
    fiber_g DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_user_id ON public.meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_meal_type ON public.meals(meal_type);
CREATE INDEX IF NOT EXISTS idx_meals_cuisine ON public.meals(cuisine);
CREATE INDEX IF NOT EXISTS idx_meals_name ON public.meals(name);
CREATE INDEX IF NOT EXISTS idx_meals_is_favorite ON public.meals(is_favorite);

-- ============================================================================
-- 5. MEAL INGREDIENTS (junction table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meal_ingredients (
    id SERIAL PRIMARY KEY,
    meal_id INTEGER NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    ingredient_id INTEGER REFERENCES public.ingredients(id),
    component_type TEXT NOT NULL,
    quantity TEXT,
    is_optional BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_meal_ingredients_meal ON public.meal_ingredients(meal_id);

-- ============================================================================
-- 6. SCHEDULED MEALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_meals (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id INTEGER NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    meal_date DATE NOT NULL,
    meal_type TEXT,
    servings INTEGER DEFAULT 4,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_meals_user ON public.scheduled_meals(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meals_date ON public.scheduled_meals(meal_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_meals_meal ON public.scheduled_meals(meal_id);

-- ============================================================================
-- 8. SHOPPING ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shopping_items (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    category TEXT,
    quantity TEXT,
    is_purchased BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_items_user ON public.shopping_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_purchased ON public.shopping_items(is_purchased);

-- ============================================================================
-- 9. SCHOOL MENU ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_menu_items (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    menu_date DATE NOT NULL,
    meal_name TEXT NOT NULL,
    meal_type TEXT DEFAULT 'lunch' CHECK (meal_type IN ('lunch', 'breakfast', 'snack')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, menu_date, meal_name, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_school_menu_date ON public.school_menu_items(menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_school_menu_user ON public.school_menu_items(user_id);

-- ============================================================================
-- 10. SCHOOL MENU FEEDBACK
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_menu_feedback (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES public.school_menu_items(id) ON DELETE CASCADE,
    feedback_type TEXT CHECK (feedback_type IN ('disliked', 'allergic', 'wont_eat')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_feedback_item ON public.school_menu_feedback(menu_item_id);

-- ============================================================================
-- 11. LEFTOVERS INVENTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leftovers_inventory (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id INTEGER REFERENCES public.meals(id),
    meal_name TEXT NOT NULL,
    servings_remaining INTEGER NOT NULL,
    cooked_date DATE NOT NULL,
    expires_date DATE NOT NULL,
    notes TEXT,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leftovers_user ON public.leftovers_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_leftovers_expiration ON public.leftovers_inventory(expires_date);

-- ============================================================================
-- 12. MEAL HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meal_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id INTEGER NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    cooked_date DATE NOT NULL,
    meal_type TEXT,
    servings INTEGER DEFAULT 4,
    rating INTEGER CHECK (rating BETWEEN 1 AND 10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_history_user ON public.meal_history(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_history_date ON public.meal_history(cooked_date DESC);

-- ============================================================================
-- 13. MEAL FAVORITES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meal_favorites (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id INTEGER NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, meal_id)
);

-- ============================================================================
-- 14. BENTO ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bento_items (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    allergens TEXT,
    notes TEXT,
    prep_time_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bento_items_user ON public.bento_items(user_id);

-- ============================================================================
-- 15. BENTO PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bento_plans (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    child_name TEXT,
    compartment1_id INTEGER REFERENCES public.bento_items(id),
    compartment2_id INTEGER REFERENCES public.bento_items(id),
    compartment3_id INTEGER REFERENCES public.bento_items(id),
    compartment4_id INTEGER REFERENCES public.bento_items(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bento_plans_user ON public.bento_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_bento_plans_date ON public.bento_plans(plan_date);

-- ============================================================================
-- 16. RESTAURANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.restaurants (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    phone TEXT,
    website TEXT,
    cuisine_type TEXT,
    price_range TEXT,
    hours_data JSONB,
    happy_hour_info JSONB,
    outdoor_seating BOOLEAN DEFAULT FALSE,
    has_bar BOOLEAN DEFAULT FALSE,
    takes_reservations BOOLEAN DEFAULT FALSE,
    good_for_groups BOOLEAN DEFAULT FALSE,
    kid_friendly BOOLEAN DEFAULT FALSE,
    rating DECIMAL(2, 1),
    notes TEXT,
    tags TEXT,
    image_url TEXT,
    last_scraped TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_user ON public.restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON public.restaurants(cuisine_type);

-- ============================================================================
-- 17. SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'family', 'premium', 'lifetime')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')),
    price_monthly DECIMAL(10, 2),
    currency TEXT DEFAULT 'usd',
    trial_start DATE,
    trial_end DATE,
    current_period_start DATE,
    current_period_end DATE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON public.subscriptions(stripe_customer_id);

-- ============================================================================
-- 18. PAYMENT HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES public.subscriptions(id),
    stripe_payment_id TEXT UNIQUE,
    stripe_invoice_id TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'refunded')),
    description TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON public.payment_history(user_id);

-- ============================================================================
-- 19. PLAN FEATURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plan_features (
    id SERIAL PRIMARY KEY,
    plan_tier TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    limit_value INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_tier, feature_name)
);

INSERT INTO public.plan_features (plan_tier, feature_name, limit_value) VALUES
    ('free', 'max_recipes', 10),
    ('free', 'ai_recipe_parsing', 0),
    ('family', 'max_recipes', NULL),
    ('family', 'ai_recipe_parsing', 50),
    ('premium', 'max_recipes', NULL),
    ('premium', 'ai_recipe_parsing', NULL),
    ('lifetime', 'max_recipes', NULL),
    ('lifetime', 'ai_recipe_parsing', NULL)
ON CONFLICT (plan_tier, feature_name) DO NOTHING;

-- ============================================================================
-- 20. FEATURE USAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_usage (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature_name, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_user_date ON public.feature_usage(user_id, usage_date);

-- ============================================================================
-- 21. ERROR LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.error_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    component TEXT,
    url TEXT,
    user_agent TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON public.error_logs(user_id);

-- ============================================================================
-- 22. CSA BOXES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.csa_boxes (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    box_date DATE NOT NULL,
    farm_name TEXT,
    contents JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csa_boxes_user ON public.csa_boxes(user_id);
CREATE INDEX IF NOT EXISTS idx_csa_boxes_date ON public.csa_boxes(box_date DESC);

-- ============================================================================
-- 23. CSA BOX ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.csa_box_items (
    id SERIAL PRIMARY KEY,
    box_id INTEGER NOT NULL REFERENCES public.csa_boxes(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity TEXT,
    unit TEXT,
    category TEXT,
    used BOOLEAN DEFAULT FALSE,
    used_in_meal_id INTEGER REFERENCES public.meals(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 24. HOLIDAY PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.holiday_plans (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    holiday_name TEXT NOT NULL,
    holiday_date DATE NOT NULL,
    guest_count INTEGER,
    dietary_restrictions JSONB,
    menu JSONB,
    shopping_list JSONB,
    timeline JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holiday_plans_user ON public.holiday_plans(user_id);

-- ============================================================================
-- 25. USER PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    preferred_cuisines JSONB,
    dietary_restrictions JSONB,
    default_servings INTEGER DEFAULT 4,
    week_start_day TEXT DEFAULT 'Saturday',
    theme TEXT DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 26. FAMILY MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_members (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER,
    dietary_preferences TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);
