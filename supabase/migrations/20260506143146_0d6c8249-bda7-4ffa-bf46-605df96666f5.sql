
-- Remove public read policy on submissions and lock down with restrictive service-role-only policy
DROP POLICY IF EXISTS "Allow public read" ON public.submissions;

-- Restrictive policy: deny all client access (service role bypasses RLS)
DROP POLICY IF EXISTS "Service role only - submissions" ON public.submissions;
CREATE POLICY "Service role only - submissions"
  ON public.submissions
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Remove submissions from Realtime publication to stop broadcasting PII
ALTER PUBLICATION supabase_realtime DROP TABLE public.submissions;

-- Enable RLS on soutien_config and add restrictive service-role-only policy
ALTER TABLE public.soutien_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only - soutien_config" ON public.soutien_config;
CREATE POLICY "Service role only - soutien_config"
  ON public.soutien_config
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);
