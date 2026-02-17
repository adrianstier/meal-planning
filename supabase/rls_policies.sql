-- ============================================================================
-- ROW LEVEL SECURITY POLICIES FOR MEAL PLANNING APP
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================================

-- Enable RLS on all user-owned tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_menu_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leftovers_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bento_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bento_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csa_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csa_box_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES
-- ============================================================================

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================================================
-- MEALS
-- ============================================================================

CREATE POLICY "Users can view own meals"
    ON public.meals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own meals"
    ON public.meals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meals"
    ON public.meals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals"
    ON public.meals FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- MEAL INGREDIENTS (based on meal ownership)
-- ============================================================================

CREATE POLICY "Users can view own meal ingredients"
    ON public.meal_ingredients FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.meals
        WHERE meals.id = meal_ingredients.meal_id
        AND meals.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own meal ingredients"
    ON public.meal_ingredients FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.meals
        WHERE meals.id = meal_ingredients.meal_id
        AND meals.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own meal ingredients"
    ON public.meal_ingredients FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.meals
        WHERE meals.id = meal_ingredients.meal_id
        AND meals.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own meal ingredients"
    ON public.meal_ingredients FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.meals
        WHERE meals.id = meal_ingredients.meal_id
        AND meals.user_id = auth.uid()
    ));

-- ============================================================================
-- SCHEDULED MEALS
-- ============================================================================

CREATE POLICY "Users can view own scheduled meals"
    ON public.scheduled_meals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scheduled meals"
    ON public.scheduled_meals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled meals"
    ON public.scheduled_meals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled meals"
    ON public.scheduled_meals FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- SHOPPING ITEMS
-- ============================================================================

CREATE POLICY "Users can manage own shopping items"
    ON public.shopping_items FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SCHOOL MENU
-- ============================================================================

CREATE POLICY "Users can manage own school menu items"
    ON public.school_menu_items FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own school menu feedback"
    ON public.school_menu_feedback FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- LEFTOVERS
-- ============================================================================

CREATE POLICY "Users can manage own leftovers"
    ON public.leftovers_inventory FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- MEAL HISTORY
-- ============================================================================

CREATE POLICY "Users can manage own meal history"
    ON public.meal_history FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- MEAL FAVORITES
-- ============================================================================

CREATE POLICY "Users can manage own favorites"
    ON public.meal_favorites FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- BENTO
-- ============================================================================

CREATE POLICY "Users can manage own bento items"
    ON public.bento_items FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own bento plans"
    ON public.bento_plans FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RESTAURANTS
-- ============================================================================

CREATE POLICY "Users can manage own restaurants"
    ON public.restaurants FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SUBSCRIPTIONS (read-only for users, service role can modify)
-- ============================================================================

CREATE POLICY "Users can view own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payment history"
    ON public.payment_history FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================================
-- FEATURE USAGE
-- ============================================================================

CREATE POLICY "Users can manage own feature usage"
    ON public.feature_usage FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- ERROR LOGS (users can create, view own)
-- ============================================================================

CREATE POLICY "Users can view own error logs"
    ON public.error_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create error logs"
    ON public.error_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CSA BOXES
-- ============================================================================

CREATE POLICY "Users can manage own CSA boxes"
    ON public.csa_boxes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own CSA box items"
    ON public.csa_box_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.csa_boxes
        WHERE csa_boxes.id = csa_box_items.box_id
        AND csa_boxes.user_id = auth.uid()
    ));

-- ============================================================================
-- HOLIDAY PLANS
-- ============================================================================

CREATE POLICY "Users can manage own holiday plans"
    ON public.holiday_plans FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- USER PREFERENCES
-- ============================================================================

CREATE POLICY "Users can manage own preferences"
    ON public.user_preferences FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FAMILY MEMBERS
-- ============================================================================

CREATE POLICY "Users can manage own family members"
    ON public.family_members FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PUBLIC REFERENCE TABLES (no user restriction)
-- ============================================================================

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
