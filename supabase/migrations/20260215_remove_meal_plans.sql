-- Remove unused meal_plans table and its FK from scheduled_meals
-- The meal_plans table has zero references in application code.
-- All weekly planning uses scheduled_meals directly.

ALTER TABLE public.scheduled_meals DROP COLUMN IF EXISTS meal_plan_id;
DROP TABLE IF EXISTS public.meal_plans CASCADE;
