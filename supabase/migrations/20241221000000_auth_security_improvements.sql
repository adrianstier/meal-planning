-- ============================================================================
-- AUTH SECURITY IMPROVEMENTS MIGRATION
-- Run this in Supabase SQL Editor to apply security fixes
-- ============================================================================

-- ============================================================================
-- 1. ADD MISSING PROFILE POLICIES
-- ============================================================================

-- Allow users to insert their own profile (fallback if trigger fails)
-- Note: This is idempotent - will not error if policy exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile"
            ON public.profiles FOR INSERT
            WITH CHECK (auth.uid() = id);
    END IF;
END
$$;

-- Allow users to delete their own profile (GDPR compliance)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND policyname = 'Users can delete own profile'
    ) THEN
        CREATE POLICY "Users can delete own profile"
            ON public.profiles FOR DELETE
            USING (auth.uid() = id);
    END IF;
END
$$;

-- ============================================================================
-- 2. LOGIN ATTEMPTS TRACKING TABLE
-- ============================================================================

-- Create table to track failed login attempts for account lockout
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
    ON public.login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
    ON public.login_attempts(ip_address, created_at DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can access login attempts (for security)
-- No user policies - this is admin-only data

-- ============================================================================
-- 3. RATE LIMIT TRACKING TABLE (for distributed rate limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'ai_parse', 'api_call', etc.
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, action_type, window_start)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_window
    ON public.rate_limits(user_id, action_type, window_start DESC);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limit status
CREATE POLICY "Users can view own rate limits"
    ON public.rate_limits FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================================
-- 4. FUNCTION TO CHECK AND INCREMENT RATE LIMIT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_max_requests INTEGER DEFAULT 10,
    p_window_minutes INTEGER DEFAULT 1
)
RETURNS TABLE(
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_current_count INTEGER;
BEGIN
    -- Calculate window start (rounded to minute)
    v_window_start := date_trunc('minute', NOW());

    -- Get current count for this window
    SELECT request_count INTO v_current_count
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND window_start >= NOW() - (p_window_minutes || ' minutes')::INTERVAL
    ORDER BY window_start DESC
    LIMIT 1;

    -- If no record or count is below limit
    IF v_current_count IS NULL THEN
        -- Insert new record
        INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
        VALUES (p_user_id, p_action_type, v_window_start, 1)
        ON CONFLICT (user_id, action_type, window_start)
        DO UPDATE SET request_count = rate_limits.request_count + 1
        RETURNING request_count INTO v_current_count;

        RETURN QUERY SELECT
            true,
            p_max_requests - v_current_count,
            v_window_start + (p_window_minutes || ' minutes')::INTERVAL;
    ELSIF v_current_count < p_max_requests THEN
        -- Increment existing record
        UPDATE public.rate_limits
        SET request_count = request_count + 1
        WHERE user_id = p_user_id
          AND action_type = p_action_type
          AND window_start >= NOW() - (p_window_minutes || ' minutes')::INTERVAL;

        RETURN QUERY SELECT
            true,
            p_max_requests - v_current_count - 1,
            v_window_start + (p_window_minutes || ' minutes')::INTERVAL;
    ELSE
        -- Rate limit exceeded
        RETURN QUERY SELECT
            false,
            0,
            v_window_start + (p_window_minutes || ' minutes')::INTERVAL;
    END IF;
END;
$$;

-- ============================================================================
-- 5. FUNCTION TO LOG LOGIN ATTEMPT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_login_attempt(
    p_email TEXT,
    p_success BOOLEAN,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.login_attempts (email, success, ip_address, user_agent)
    VALUES (p_email, p_success, p_ip_address, p_user_agent);
END;
$$;

-- ============================================================================
-- 6. FUNCTION TO CHECK IF ACCOUNT IS LOCKED
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_account_locked(
    p_email TEXT,
    p_max_attempts INTEGER DEFAULT 5,
    p_lockout_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_failed_count INTEGER;
BEGIN
    -- Count failed attempts in the lockout window
    SELECT COUNT(*) INTO v_failed_count
    FROM public.login_attempts
    WHERE email = p_email
      AND success = false
      AND created_at >= NOW() - (p_lockout_minutes || ' minutes')::INTERVAL;

    RETURN v_failed_count >= p_max_attempts;
END;
$$;

-- ============================================================================
-- 7. CLEANUP OLD DATA (scheduled job)
-- ============================================================================

-- Function to clean up old login attempts and rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_auth_tracking()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete login attempts older than 30 days
    DELETE FROM public.login_attempts
    WHERE created_at < NOW() - INTERVAL '30 days';

    -- Delete rate limit records older than 1 hour
    DELETE FROM public.rate_limits
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;

-- Note: Schedule this to run periodically using pg_cron or a Supabase Edge Function
-- Example with pg_cron (if enabled):
-- SELECT cron.schedule('cleanup-auth-tracking', '0 * * * *', 'SELECT public.cleanup_auth_tracking()');

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked TO authenticated;
-- log_login_attempt should only be called by service role
GRANT EXECUTE ON FUNCTION public.log_login_attempt TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_auth_tracking TO service_role;
