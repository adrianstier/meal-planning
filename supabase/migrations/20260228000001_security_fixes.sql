-- ============================================================================
-- SECURITY FIXES MIGRATION
-- Created: 2026-02-28
-- Addresses CRITICAL, HIGH, and MEDIUM security issues across the database.
-- ============================================================================

-- ============================================================================
-- CRITICAL: soft_delete_meal() lacks user authorization
-- Any authenticated user could delete any other user's meals.
-- Fix: Add auth.uid() check and SET search_path = public.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_meal(meal_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.meals
  SET deleted_at = NOW()
  WHERE id = meal_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meal not found or not owned by current user';
  END IF;
END;
$$;

-- ============================================================================
-- CRITICAL: restore_meal() lacks user authorization
-- Any authenticated user could restore any other user's meals.
-- Fix: Add auth.uid() check and SET search_path = public.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.restore_meal(meal_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.meals
  SET deleted_at = NULL
  WHERE id = meal_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meal not found or not owned by current user';
  END IF;
END;
$$;

-- ============================================================================
-- CRITICAL: cleanup_soft_deleted_records() has no authorization
-- Any authenticated user could permanently delete ALL soft-deleted records
-- across all users.
-- Fix: Restrict to admin users only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records(days_old INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Only admins can run this cleanup function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only admins can run cleanup_soft_deleted_records';
  END IF;

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
$$;

-- ============================================================================
-- HIGH: is_admin() missing SET search_path
-- Without search_path, a malicious schema could shadow the profiles table.
-- Fix: Recreate with SET search_path = public.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Check if current user has admin role';

-- ============================================================================
-- HIGH: handle_new_user() missing SET search_path
-- This is a SECURITY DEFINER trigger function that writes to profiles.
-- Without search_path, it is vulnerable to search_path injection.
-- Fix: Recreate with SET search_path = public.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================================================
-- HIGH: feature_usage RLS too permissive
-- The FOR ALL policy lets users manipulate their own usage counters,
-- potentially bypassing feature limits.
-- Fix: Split into SELECT (for users) and INSERT/UPDATE (for service role).
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own feature usage" ON public.feature_usage;

-- Users can read their own usage data
CREATE POLICY "Users can view own feature usage"
    ON public.feature_usage FOR SELECT
    USING (auth.uid() = user_id);

-- Only service role can insert usage records (via edge functions)
CREATE POLICY "Service role can insert feature usage"
    ON public.feature_usage FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Only service role can update usage records (via edge functions)
CREATE POLICY "Service role can update feature usage"
    ON public.feature_usage FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Only service role can delete usage records
CREATE POLICY "Service role can delete feature usage"
    ON public.feature_usage FOR DELETE
    TO service_role
    USING (true);

-- ============================================================================
-- HIGH: is_account_locked() exposed to authenticated users
-- This function checks login attempts and should only be accessible
-- from server-side (service role), not from client-side authenticated calls.
-- Fix: Revoke from authenticated, ensure service_role can still access.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.is_account_locked(TEXT, INTEGER, INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_account_locked(TEXT, INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.is_account_locked(TEXT, INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- MEDIUM: check_rate_limit functions missing SET search_path
-- These are SECURITY DEFINER functions that interact with the rate_limits
-- table and are vulnerable to search_path injection.
-- Fix: Recreate all three with SET search_path = public.
-- ============================================================================

-- check_rate_limit (from 20260203100001 / 20260203100002)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_now TIMESTAMPTZ := NOW();
  v_window_duration INTERVAL := (p_window_seconds || ' seconds')::INTERVAL;
BEGIN
  -- Atomically insert a new record or do nothing if exists
  INSERT INTO rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 0, v_now)
  ON CONFLICT (user_id, endpoint) DO NOTHING;

  -- Now lock and read the record (guaranteed to exist)
  SELECT window_start, request_count
  INTO v_window_start, v_current_count
  FROM rate_limits
  WHERE user_id = p_user_id AND endpoint = p_endpoint
  FOR UPDATE;

  -- Check if current window has expired
  IF v_now >= v_window_start + v_window_duration THEN
    -- Reset the window and set count to 1
    UPDATE rate_limits
    SET request_count = 1, window_start = v_now
    WHERE user_id = p_user_id AND endpoint = p_endpoint;
    RETURN TRUE;
  END IF;

  -- Window is still active, check if limit is exceeded
  IF v_current_count >= p_limit THEN
    RETURN FALSE;
  END IF;

  -- Increment counter
  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND endpoint = p_endpoint;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION check_rate_limit IS 'Atomically checks and increments rate limit counter. Returns TRUE if allowed, FALSE if exceeded.';

-- get_rate_limit_retry_after
CREATE OR REPLACE FUNCTION get_rate_limit_retry_after(
  p_user_id UUID,
  p_endpoint TEXT,
  p_window_seconds INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_window_duration INTERVAL := (p_window_seconds || ' seconds')::INTERVAL;
  v_retry_after INTEGER;
BEGIN
  SELECT window_start
  INTO v_window_start
  FROM rate_limits
  WHERE user_id = p_user_id AND endpoint = p_endpoint;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate seconds until window resets
  v_retry_after := EXTRACT(EPOCH FROM (v_window_start + v_window_duration - v_now))::INTEGER;

  IF v_retry_after < 0 THEN
    RETURN 0;
  END IF;

  RETURN v_retry_after;
END;
$$;

COMMENT ON FUNCTION get_rate_limit_retry_after IS 'Returns seconds until rate limit window resets.';

-- cleanup_old_rate_limits
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < NOW() - (p_older_than_hours || ' hours')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Removes old rate limit records. Call periodically via cron.';

-- ============================================================================
-- MEDIUM: agent_tasks missing DELETE policy
-- Users cannot delete their own completed/cancelled tasks.
-- Fix: Add DELETE policy scoped to user's own tasks.
-- ============================================================================

CREATE POLICY "Users can delete own tasks"
  ON agent_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HIGH: RLS SELECT policies don't filter soft-deleted records
-- Soft-deleted records remain visible via SELECT policies on meals,
-- scheduled_meals, and restaurants. This exposes records that were
-- logically deleted by the user.
-- Fix: Drop existing SELECT policies and recreate with deleted_at IS NULL.
-- ============================================================================

-- meals: update SELECT policy to filter soft-deleted records
DROP POLICY IF EXISTS "Users can view own meals" ON public.meals;
CREATE POLICY "Users can view own meals"
    ON public.meals FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

-- scheduled_meals: update SELECT policy to filter soft-deleted records
DROP POLICY IF EXISTS "Users can view own scheduled meals" ON public.scheduled_meals;
CREATE POLICY "Users can view own scheduled meals"
    ON public.scheduled_meals FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

-- restaurants: update SELECT policy to filter soft-deleted records
DROP POLICY IF EXISTS "Users can manage own restaurants" ON public.restaurants;

-- Replace the overly broad FOR ALL policy with granular per-operation policies
CREATE POLICY "Users can view own restaurants"
    ON public.restaurants FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create own restaurants"
    ON public.restaurants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own restaurants"
    ON public.restaurants FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own restaurants"
    ON public.restaurants FOR DELETE
    USING (auth.uid() = user_id);
