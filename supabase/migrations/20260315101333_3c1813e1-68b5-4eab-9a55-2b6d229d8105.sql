
CREATE TABLE public.soutien_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);

ALTER TABLE public.soutien_config DISABLE ROW LEVEL SECURITY;
