-- Table pour les compteurs (counters)
CREATE TABLE public.counters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  counter_type TEXT NOT NULL DEFAULT 'members',
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id, channel_id)
);

-- Table pour les rôles de soutien
CREATE TABLE public.support_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  nolog BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id, role_id)
);

-- Table pour les salons photos uniquement
CREATE TABLE public.piconly_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id, channel_id)
);

-- Ajouter des colonnes à guild_config
ALTER TABLE public.guild_config 
ADD COLUMN IF NOT EXISTS hide_no_permission_reply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS showpic_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS showpic_channel_id TEXT;

-- Enable RLS
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piconly_channels ENABLE ROW LEVEL SECURITY;

-- Policies (service role only)
CREATE POLICY "Service role only - counters" ON public.counters AS RESTRICTIVE FOR ALL USING (false);
CREATE POLICY "Service role only - support_roles" ON public.support_roles AS RESTRICTIVE FOR ALL USING (false);
CREATE POLICY "Service role only - piconly_channels" ON public.piconly_channels AS RESTRICTIVE FOR ALL USING (false);