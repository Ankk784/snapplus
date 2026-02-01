-- Table pour stocker la configuration des bots white-label par serveur
CREATE TABLE public.guild_bot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id text NOT NULL UNIQUE,
  bot_token text,
  bot_public_key text,
  bot_application_id text,
  bot_name text,
  configured_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guild_bot_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access (tokens are sensitive)
CREATE POLICY "Service role only - guild_bot_config"
ON public.guild_bot_config
AS RESTRICTIVE
FOR ALL
USING (false);

-- Add comment
COMMENT ON TABLE public.guild_bot_config IS 'Stores white-label bot configurations per guild';