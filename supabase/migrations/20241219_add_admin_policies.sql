-- ============================================================================
-- ADMIN ROLE SUPPORT FOR MEAL PLANNING APP
-- Adds admin role check and policies for administrative access
-- ============================================================================

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add admin column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

-- Admin policies for error_logs (admins can view all)
CREATE POLICY "Admins can view all error logs"
    ON public.error_logs FOR SELECT
    USING (public.is_admin());

-- Admin policies for feature_usage (admins can view all)
CREATE POLICY "Admins can view all feature usage"
    ON public.feature_usage FOR SELECT
    USING (public.is_admin());

-- Admin policies for subscriptions (admins can manage all)
CREATE POLICY "Admins can manage all subscriptions"
    ON public.subscriptions FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Admin policies for payment_history (admins can view all)
CREATE POLICY "Admins can view all payment history"
    ON public.payment_history FOR SELECT
    USING (public.is_admin());

-- Grant execute permission on is_admin function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Check if current user has admin role';
