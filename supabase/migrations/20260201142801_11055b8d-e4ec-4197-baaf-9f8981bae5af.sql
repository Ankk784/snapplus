-- Table pour les acheteurs du bot (buyers)
CREATE TABLE public.bot_buyers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_id)
);

-- Table pour les commandes désactivées par serveur
CREATE TABLE public.disabled_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  disabled_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id, command_name)
);

-- Enable RLS
ALTER TABLE public.bot_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disabled_commands ENABLE ROW LEVEL SECURITY;

-- Policies (service role only)
CREATE POLICY "Service role only - bot_buyers" ON public.bot_buyers AS RESTRICTIVE FOR ALL USING (false);
CREATE POLICY "Service role only - disabled_commands" ON public.disabled_commands AS RESTRICTIVE FOR ALL USING (false);