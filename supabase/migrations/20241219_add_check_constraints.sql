-- Migration: Add CHECK constraints for data integrity
-- This migration adds validation constraints to ensure data quality

-- Add CHECK constraint for servings (must be positive)
ALTER TABLE public.meals
ADD CONSTRAINT check_meals_servings_positive
CHECK (servings IS NULL OR servings > 0);

-- Add CHECK constraint for cook_time_minutes (must be non-negative)
ALTER TABLE public.meals
ADD CONSTRAINT check_meals_cook_time_non_negative
CHECK (cook_time_minutes IS NULL OR cook_time_minutes >= 0);

-- Add CHECK constraint for prep_time_minutes (must be non-negative)
ALTER TABLE public.meals
ADD CONSTRAINT check_meals_prep_time_non_negative
CHECK (prep_time_minutes IS NULL OR prep_time_minutes >= 0);

-- Add CHECK constraint for times_cooked (must be non-negative)
ALTER TABLE public.meals
ADD CONSTRAINT check_meals_times_cooked_non_negative
CHECK (times_cooked IS NULL OR times_cooked >= 0);

-- Add CHECK constraint for leftover_servings (must be positive)
ALTER TABLE public.meals
ADD CONSTRAINT check_meals_leftover_servings_positive
CHECK (leftover_servings IS NULL OR leftover_servings > 0);

-- Add CHECK constraint for leftover_days (must be positive)
ALTER TABLE public.meals
ADD CONSTRAINT check_meals_leftover_days_positive
CHECK (leftover_days IS NULL OR leftover_days > 0);

-- Add CHECK constraint for calories (must be non-negative)
ALTER TABLE public.meals
ADD CONSTRAINT check_meals_calories_non_negative
CHECK (calories IS NULL OR calories >= 0);

-- Add CHECK constraint for scheduled_meals servings
ALTER TABLE public.scheduled_meals
ADD CONSTRAINT check_scheduled_meals_servings_positive
CHECK (servings IS NULL OR servings > 0);

-- Add CHECK constraint for leftovers_inventory servings_remaining
ALTER TABLE public.leftovers_inventory
ADD CONSTRAINT check_leftovers_servings_positive
CHECK (servings_remaining IS NULL OR servings_remaining > 0);

-- Add CHECK constraint for meal_history rating
ALTER TABLE public.meal_history
ADD CONSTRAINT check_meal_history_rating_range
CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- Add CHECK constraint for bento_items prep_time_minutes
ALTER TABLE public.bento_items
ADD CONSTRAINT check_bento_items_prep_time_non_negative
CHECK (prep_time_minutes IS NULL OR prep_time_minutes >= 0);

-- Add meal_type validation for meals table
ALTER TABLE public.meals
ADD CONSTRAINT check_meals_meal_type_valid
CHECK (meal_type IS NULL OR meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'));

-- Add meal_type validation for scheduled_meals table
ALTER TABLE public.scheduled_meals
ADD CONSTRAINT check_scheduled_meals_meal_type_valid
CHECK (meal_type IS NULL OR meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'));
