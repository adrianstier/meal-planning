-- Migration: Fix meals.original_meal_id foreign key constraint
-- Date: 2026-02-04
--
-- Issue: The meals.original_meal_id column lacks proper ON DELETE handling.
-- The original schema defined it as: original_meal_id INTEGER REFERENCES public.meals(id)
-- This defaults to NO ACTION, which will cause errors when deleting a meal that
-- is referenced as an original_meal_id by leftover recipes.
--
-- Solution: Add ON DELETE SET NULL to preserve history. When the original meal
-- is deleted, leftover recipes will retain their data but lose the reference.
--
-- Note: Related indexes already exist in migration 20241221000001_database_improvements.sql:
--   - idx_meals_original_meal ON public.meals(original_meal_id)
--
-- Note: Performance indexes for common queries already exist in:
--   - 20260118000000_add_performance_indexes.sql (idx_meals_user_meal_type, idx_scheduled_meals_user_date, idx_leftovers_user_expires)
--   - 20241221000001_database_improvements.sql (compound indexes for user+date queries)
--
-- Note: kid_friendly_level NOT NULL constraint already added in:
--   - 20260203100000_add_not_null_constraints.sql (sets default 5, adds NOT NULL)

-- ============================================================================
-- FIX: meals.original_meal_id foreign key with ON DELETE SET NULL
-- ============================================================================

-- First, drop the existing constraint if it exists
-- The constraint name follows PostgreSQL's automatic naming convention: {table}_{column}_fkey
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meals_original_meal_id_fkey'
    AND table_name = 'meals'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.meals DROP CONSTRAINT meals_original_meal_id_fkey;
  END IF;
END $$;

-- Also check for any other FK constraint on this column (in case of non-standard naming)
DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  FOR constraint_rec IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'meals'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'original_meal_id'
  LOOP
    EXECUTE 'ALTER TABLE public.meals DROP CONSTRAINT ' || quote_ident(constraint_rec.constraint_name);
  END LOOP;
END $$;

-- Add the constraint with ON DELETE SET NULL
-- This ensures that when an original meal is deleted:
-- 1. The leftover recipe (referencing meal) is NOT deleted
-- 2. The original_meal_id is set to NULL, preserving the leftover recipe data
-- 3. The leftover recipe still has is_leftover = TRUE to identify it as a leftover recipe
ALTER TABLE public.meals
ADD CONSTRAINT meals_original_meal_id_fkey
FOREIGN KEY (original_meal_id)
REFERENCES public.meals(id)
ON DELETE SET NULL;

-- Add documentation comment
COMMENT ON COLUMN public.meals.original_meal_id IS 'Reference to original meal (for leftover recipes). Set to NULL if original is deleted. Used with is_leftover=TRUE to identify leftover recipes.';

-- ============================================================================
-- SUMMARY:
-- - Fixed meals.original_meal_id FK to use ON DELETE SET NULL
-- - Preserves leftover recipe history when original meal is deleted
-- - Performance indexes and kid_friendly_level constraints already exist
-- ============================================================================
