CREATE TABLE IF NOT EXISTS public.join_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, role_id)
);

ALTER TABLE public.join_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access join_roles"
ON public.join_roles
FOR ALL
USING (true)
WITH CHECK (true);