CREATE TABLE IF NOT EXISTS public.site_whitelist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  added_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only - site_whitelist"
ON public.site_whitelist
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);