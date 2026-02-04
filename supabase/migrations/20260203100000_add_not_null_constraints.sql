-- Migration: Add NOT NULL constraints for data integrity
-- Date: 2026-02-03
-- This migration adds NOT NULL constraints to columns that have DEFAULT values
-- but currently allow NULL, improving data consistency.

-- ============================================
-- Issue #20: kid_friendly_level allows NULL
-- ============================================
-- The kid_friendly_level column has DEFAULT 5 and CHECK (1-10) but allows NULL.
-- This is inconsistent - if we have a default, NULL should not be allowed.
-- Application code already defaults to 5 when NULL, so this formalizes that.

-- Step 1: Update any existing NULL values to the default (5)
-- This ensures backwards compatibility with existing data
UPDATE meals
SET kid_friendly_level = 5
WHERE kid_friendly_level IS NULL;

UPDATE ingredients
SET kid_friendly_level = 5
WHERE kid_friendly_level IS NULL;

-- Step 2: Add NOT NULL constraint to meals table
ALTER TABLE meals
ALTER COLUMN kid_friendly_level SET NOT NULL;

-- Step 3: Add NOT NULL constraint to ingredients table
ALTER TABLE ingredients
ALTER COLUMN kid_friendly_level SET NOT NULL;

-- ============================================
-- Issue #21: Review denormalized data in leftovers_inventory
-- ============================================
-- The leftovers_inventory table has both meal_id (FK) and meal_name (TEXT).
-- This is intentional denormalization for the following reasons:
-- 1. meal_id is NULLABLE - leftovers can exist without being linked to a recipe
-- 2. meal_name serves as a fallback when meal_id is NULL (custom leftovers)
-- 3. meal_name preserves history if the original meal is deleted
--
-- The application code correctly uses JOINs and falls back to meal_name:
--   meal_name: item.meal?.name || item.meal_name
--
-- No structural changes needed - just documenting the design decision.

COMMENT ON TABLE leftovers_inventory IS 'Tracks leftover portions from cooked meals. meal_id is optional for custom entries.';
COMMENT ON COLUMN leftovers_inventory.meal_id IS 'Optional FK to meals. NULL for custom leftovers not linked to a recipe.';
COMMENT ON COLUMN leftovers_inventory.meal_name IS 'Denormalized meal name. Used as fallback when meal_id is NULL or meal deleted. Queries should prefer JOIN result.';

-- ============================================
-- Comments for kid_friendly_level
-- ============================================
COMMENT ON COLUMN meals.kid_friendly_level IS 'Kid-friendliness rating 1-10 (10 = most kid friendly). Default: 5';
COMMENT ON COLUMN ingredients.kid_friendly_level IS 'Kid-friendliness rating 1-10 (10 = most kid friendly). Default: 5';
