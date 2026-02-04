-- Add soft delete support to main tables
-- Created: 2026-01-18

-- Add deleted_at column to meals table
ALTER TABLE public.meals
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deleted_at column to scheduled_meals table
ALTER TABLE public.scheduled_meals
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deleted_at column to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deleted_at column to bento_items table
ALTER TABLE public.bento_items
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deleted_at column to bento_plans table
ALTER TABLE public.bento_plans
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient soft delete filtering
CREATE INDEX IF NOT EXISTS idx_meals_not_deleted
ON public.meals(user_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_meals_not_deleted
ON public.scheduled_meals(user_id, meal_date)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_not_deleted
ON public.restaurants(user_id)
WHERE deleted_at IS NULL;

-- Create a view for active (non-deleted) meals
CREATE OR REPLACE VIEW public.active_meals AS
SELECT * FROM public.meals
WHERE deleted_at IS NULL;

-- Create a view for active (non-deleted) scheduled meals
CREATE OR REPLACE VIEW public.active_scheduled_meals AS
SELECT * FROM public.scheduled_meals
WHERE deleted_at IS NULL;

-- Create a view for active (non-deleted) restaurants
CREATE OR REPLACE VIEW public.active_restaurants AS
SELECT * FROM public.restaurants
WHERE deleted_at IS NULL;

-- Function to soft delete a meal
CREATE OR REPLACE FUNCTION public.soft_delete_meal(meal_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.meals
  SET deleted_at = NOW()
  WHERE id = meal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted meal
CREATE OR REPLACE FUNCTION public.restore_meal(meal_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.meals
  SET deleted_at = NULL
  WHERE id = meal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to permanently delete old soft-deleted records (cleanup job)
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Delete old soft-deleted meals
  DELETE FROM public.meals
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Delete old soft-deleted scheduled meals
  DELETE FROM public.scheduled_meals
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Delete old soft-deleted restaurants
  DELETE FROM public.restaurants
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on new columns
COMMENT ON COLUMN public.meals.deleted_at IS 'Timestamp when the record was soft-deleted. NULL means active.';
COMMENT ON COLUMN public.scheduled_meals.deleted_at IS 'Timestamp when the record was soft-deleted. NULL means active.';
COMMENT ON COLUMN public.restaurants.deleted_at IS 'Timestamp when the record was soft-deleted. NULL means active.';
