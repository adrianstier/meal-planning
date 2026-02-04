-- Fix Rate Limits Security Issues
-- Migration: Remove dangerous RLS policies and fix race condition

-- ============================================
-- 1. Remove UPDATE and DELETE policies
-- ============================================
-- Users should NOT be able to modify their own rate limit records
-- Only the SECURITY DEFINER functions should modify these records

DROP POLICY IF EXISTS "Users can update own rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Users can delete own rate limits" ON rate_limits;

-- ============================================
-- 2. Fix Race Condition in check_rate_limit()
-- ============================================
-- The original function had a race condition where concurrent first
-- requests could both find "NOT FOUND" and try to INSERT, causing
-- duplicate key violations.
--
-- Fix: Use INSERT ... ON CONFLICT to atomically handle the first request

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_now TIMESTAMPTZ := NOW();
  v_window_duration INTERVAL := (p_window_seconds || ' seconds')::INTERVAL;
BEGIN
  -- Atomically insert a new record or do nothing if exists
  -- This prevents the race condition where concurrent requests
  -- both find "NOT FOUND" and try to INSERT
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
    -- Rate limit exceeded
    RETURN FALSE;
  END IF;

  -- Increment counter
  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND endpoint = p_endpoint;

  RETURN TRUE;
END;
$$;

-- ============================================
-- Comments
-- ============================================
COMMENT ON FUNCTION check_rate_limit IS 'Atomically checks and increments rate limit counter. Fixed race condition using INSERT ON CONFLICT. Returns TRUE if allowed, FALSE if exceeded.';
