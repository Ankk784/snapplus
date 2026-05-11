CREATE TABLE public.logs_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL UNIQUE,
  added_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.logs_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only - logs_channels"
ON public.logs_channels AS RESTRICTIVE FOR ALL
USING (false) WITH CHECK (false);