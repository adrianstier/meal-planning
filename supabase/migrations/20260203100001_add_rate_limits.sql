-- Rate Limiting Database Tables
-- Migration: Add rate limiting table and check function

-- ============================================
-- Rate Limits Table
-- ============================================
-- Tracks API request counts per user per endpoint within time windows
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, endpoint)
);

-- Index for efficient cleanup of old records
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limit records
CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own rate limit records
CREATE POLICY "Users can create own rate limits"
  ON rate_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own rate limit records
CREATE POLICY "Users can update own rate limits"
  ON rate_limits FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own rate limit records
CREATE POLICY "Users can delete own rate limits"
  ON rate_limits FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Rate Limit Check Function
-- ============================================
-- Atomically checks and increments rate limit counter
-- Returns TRUE if request is allowed, FALSE if rate limit exceeded
--
-- Parameters:
--   p_user_id: The user's UUID
--   p_endpoint: The endpoint being rate limited (e.g., 'agent', 'suggest-meal')
--   p_limit: Maximum requests allowed in the time window
--   p_window_seconds: Length of the time window in seconds
--
-- Usage:
--   SELECT check_rate_limit('user-uuid', 'agent', 30, 60);
--   -- Returns TRUE if under limit, FALSE if exceeded

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
  -- Try to get existing rate limit record
  SELECT window_start, request_count
  INTO v_window_start, v_current_count
  FROM rate_limits
  WHERE user_id = p_user_id AND endpoint = p_endpoint
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No existing record, create new one
    INSERT INTO rate_limits (user_id, endpoint, request_count, window_start)
    VALUES (p_user_id, p_endpoint, 1, v_now);
    RETURN TRUE;
  END IF;

  -- Check if current window has expired
  IF v_now >= v_window_start + v_window_duration THEN
    -- Reset the window
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
-- Helper Function to Get Retry-After
-- ============================================
-- Returns the number of seconds until the rate limit window resets
-- Returns 0 if no active rate limit or if already expired

CREATE OR REPLACE FUNCTION get_rate_limit_retry_after(
  p_user_id UUID,
  p_endpoint TEXT,
  p_window_seconds INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================
-- Cleanup Function
-- ============================================
-- Optional function to clean up old rate limit records
-- Can be called periodically via a cron job

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE rate_limits IS 'Tracks API request counts per user per endpoint for rate limiting';
COMMENT ON FUNCTION check_rate_limit IS 'Atomically checks and increments rate limit counter. Returns TRUE if allowed, FALSE if exceeded.';
COMMENT ON FUNCTION get_rate_limit_retry_after IS 'Returns seconds until rate limit window resets.';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Removes old rate limit records. Call periodically via cron.';
