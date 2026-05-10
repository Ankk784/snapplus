CREATE TABLE public.site_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL UNIQUE,
  added_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only - site_channels"
ON public.site_channels
AS RESTRICTIVE
FOR ALL
USING (false)
WITH CHECK (false);