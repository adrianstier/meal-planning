-- Performance indexes for common queries
-- Created: 2026-01-18

-- Compound index for filtering meals by user and type (common query pattern)
CREATE INDEX IF NOT EXISTS idx_meals_user_meal_type
ON public.meals(user_id, meal_type);

-- Index for ordering meals by creation date (for recent meals)
CREATE INDEX IF NOT EXISTS idx_meals_user_created
ON public.meals(user_id, created_at DESC);

-- Compound index for scheduled meals by user and date (week view queries)
CREATE INDEX IF NOT EXISTS idx_scheduled_meals_user_date
ON public.scheduled_meals(user_id, meal_date);

-- Index for leftovers inventory expiration queries
CREATE INDEX IF NOT EXISTS idx_leftovers_user_expires
ON public.leftovers_inventory(user_id, expires_date)
WHERE consumed_at IS NULL;

-- Index for shopping items by user and purchase status
CREATE INDEX IF NOT EXISTS idx_shopping_user_purchased
ON public.shopping_items(user_id, is_purchased);

-- Index for school menu items by date (calendar view)
CREATE INDEX IF NOT EXISTS idx_school_menu_user_date
ON public.school_menu_items(user_id, menu_date);

-- Index for restaurants by user and filters
CREATE INDEX IF NOT EXISTS idx_restaurants_user_cuisine
ON public.restaurants(user_id, cuisine_type);

-- Index for bento plans by user and date
CREATE INDEX IF NOT EXISTS idx_bento_plans_user_date
ON public.bento_plans(user_id, plan_date);

-- Analyze tables to update query planner statistics
ANALYZE public.meals;
ANALYZE public.scheduled_meals;
ANALYZE public.leftovers_inventory;
ANALYZE public.shopping_items;
ANALYZE public.school_menu_items;
ANALYZE public.restaurants;
ANALYZE public.bento_plans;
