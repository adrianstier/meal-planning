-- ============================================================================
-- MIGRATION: Database Improvements
-- Fixes identified issues from comprehensive code review
-- ============================================================================

-- ============================================================================
-- 1. FIX RATING CONSTRAINT INCONSISTENCY
-- Schema uses 1-10 for meal_history.rating but migration had 1-5
-- Standardize on 1-10 scale to match kid_rating
-- ============================================================================

-- Drop the incorrect constraint if it exists
ALTER TABLE public.meal_history
DROP CONSTRAINT IF EXISTS check_meal_history_rating_range;

-- Add correct constraint (1-10 scale)
ALTER TABLE public.meal_history
ADD CONSTRAINT check_meal_history_rating_range
CHECK (rating IS NULL OR (rating >= 1 AND rating <= 10));

-- ============================================================================
-- 2. ENABLE RLS ON REFERENCE TABLES
-- Reference tables need RLS enabled for policies to take effect
-- ============================================================================

ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- Re-create policies (DROP IF EXISTS pattern for idempotency)
DROP POLICY IF EXISTS "Anyone can view meal types" ON public.meal_types;
DROP POLICY IF EXISTS "Anyone can view ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Anyone can view plan features" ON public.plan_features;

CREATE POLICY "Anyone can view meal types"
    ON public.meal_types FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Anyone can view ingredients"
    ON public.ingredients FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Anyone can view plan features"
    ON public.plan_features FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================================
-- 3. ADD MISSING FOREIGN KEY INDEXES
-- Indexes on FK columns for JOIN performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_meal_ingredients_ingredient
    ON public.meal_ingredients(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_school_feedback_menu_item
    ON public.school_menu_feedback(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_leftovers_meal
    ON public.leftovers_inventory(meal_id);

CREATE INDEX IF NOT EXISTS idx_csa_items_meal
    ON public.csa_box_items(used_in_meal_id);

CREATE INDEX IF NOT EXISTS idx_bento_plans_compartment1
    ON public.bento_plans(compartment1_id);

CREATE INDEX IF NOT EXISTS idx_bento_plans_compartment2
    ON public.bento_plans(compartment2_id);

CREATE INDEX IF NOT EXISTS idx_bento_plans_compartment3
    ON public.bento_plans(compartment3_id);

CREATE INDEX IF NOT EXISTS idx_bento_plans_compartment4
    ON public.bento_plans(compartment4_id);

CREATE INDEX IF NOT EXISTS idx_meal_history_meal
    ON public.meal_history(meal_id);

CREATE INDEX IF NOT EXISTS idx_meals_original_meal
    ON public.meals(original_meal_id);

-- ============================================================================
-- 4. ADD COMPOUND INDEXES FOR USER-SCOPED DATE QUERIES
-- Most queries filter by user_id + date range
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_scheduled_meals_user_date
    ON public.scheduled_meals(user_id, meal_date);

CREATE INDEX IF NOT EXISTS idx_school_menu_user_date
    ON public.school_menu_items(user_id, menu_date DESC);

CREATE INDEX IF NOT EXISTS idx_leftovers_user_expiry
    ON public.leftovers_inventory(user_id, expires_date);

CREATE INDEX IF NOT EXISTS idx_bento_plans_user_date
    ON public.bento_plans(user_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_meal_history_user_date
    ON public.meal_history(user_id, cooked_date DESC);

CREATE INDEX IF NOT EXISTS idx_meals_user_favorite
    ON public.meals(user_id, is_favorite) WHERE is_favorite = true;

-- ============================================================================
-- 5. ADD CHECK CONSTRAINT FOR meal_ingredients.component_type
-- Validates component types to prevent data inconsistency
-- ============================================================================

ALTER TABLE public.meal_ingredients
ADD CONSTRAINT check_component_type_valid
CHECK (component_type IN ('main', 'protein', 'vegetable', 'starch', 'sauce', 'seasoning', 'garnish', 'side', 'topping', 'base', 'other'));

-- ============================================================================
-- 6. ADD TEXT LENGTH CONSTRAINTS
-- Prevent overly long text that causes UI issues
-- ============================================================================

ALTER TABLE public.meals
ADD CONSTRAINT check_meal_name_length
CHECK (length(name) <= 255);

ALTER TABLE public.meals
ADD CONSTRAINT check_meal_notes_length
CHECK (notes IS NULL OR length(notes) <= 10000);

ALTER TABLE public.restaurants
ADD CONSTRAINT check_restaurant_name_length
CHECK (length(name) <= 255);

ALTER TABLE public.restaurants
ADD CONSTRAINT check_restaurant_phone_format
CHECK (phone IS NULL OR length(phone) <= 20);

ALTER TABLE public.restaurants
ADD CONSTRAINT check_restaurant_website_length
CHECK (website IS NULL OR length(website) <= 500);

-- ============================================================================
-- 7. ADD MISSING TIMESTAMPS TO meal_ingredients
-- For audit trail
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'meal_ingredients'
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.meal_ingredients ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- 8. FIX TRIGGER TO HANDLE DUPLICATE USERNAMES
-- Appends UUID suffix if username already exists
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
    -- Start with email prefix or provided username
    base_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        split_part(NEW.email, '@', 1)
    );
    final_username := base_username;

    -- Check for duplicates and append suffix if needed
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
        counter := counter + 1;
        IF counter > 100 THEN
            -- Fallback to UUID suffix after 100 attempts
            final_username := base_username || '_' || substring(NEW.id::text, 1, 8);
            EXIT;
        END IF;
        final_username := base_username || counter::text;
    END LOOP;

    INSERT INTO public.profiles (id, username, email, display_name)
    VALUES (
        NEW.id,
        final_username,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. IMPROVE is_admin() FUNCTION PERFORMANCE
-- Cache result and add index on profiles.role
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role
    ON public.profiles(role) WHERE role = 'admin';

-- Optimize is_admin function with caching hint
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_admin_result BOOLEAN;
BEGIN
  -- Check if user is admin (uses indexed query)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO is_admin_result;

  RETURN COALESCE(is_admin_result, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- STABLE hint tells PostgreSQL the function returns same result
-- within a single statement, enabling query optimization

-- ============================================================================
-- 10. ADD PRICE_RANGE CONSTRAINT FOR RESTAURANTS
-- ============================================================================

ALTER TABLE public.restaurants
ADD CONSTRAINT check_price_range_valid
CHECK (price_range IS NULL OR price_range IN ('$', '$$', '$$$', '$$$$'));

-- ============================================================================
-- 11. ADD DELETE BEHAVIOR FOR LEFTOVERS WHEN MEAL IS DELETED
-- Set meal_id to NULL instead of orphaning record
-- ============================================================================

-- First drop existing FK if any
ALTER TABLE public.leftovers_inventory
DROP CONSTRAINT IF EXISTS leftovers_inventory_meal_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE public.leftovers_inventory
ADD CONSTRAINT leftovers_inventory_meal_id_fkey
FOREIGN KEY (meal_id) REFERENCES public.meals(id) ON DELETE SET NULL;

-- ============================================================================
-- 12. ENABLE pg_trgm EXTENSION FOR BETTER ILIKE SEARCH
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram indexes for search optimization
CREATE INDEX IF NOT EXISTS idx_meals_name_trgm
    ON public.meals USING GIST(name gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_meals_tags_trgm
    ON public.meals USING GIST(tags gist_trgm_ops);

-- ============================================================================
-- SUMMARY OF CHANGES:
-- 1. Fixed meal_history rating constraint to 1-10 (was 1-5)
-- 2. Enabled RLS on reference tables with read policies
-- 3. Added 10 missing FK indexes
-- 4. Added 6 compound indexes for user+date queries
-- 5. Added component_type validation constraint
-- 6. Added text length constraints on meals and restaurants
-- 7. Added created_at timestamp to meal_ingredients
-- 8. Fixed username duplicate handling in trigger
-- 9. Optimized is_admin() function with STABLE hint and index
-- 10. Added price_range validation for restaurants
-- 11. Fixed leftovers FK to SET NULL on meal delete
-- 12. Added trigram extension and indexes for search
-- ============================================================================
