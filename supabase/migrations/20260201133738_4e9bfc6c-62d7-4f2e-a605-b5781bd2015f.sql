-- Table pour stocker les sanctions (bans, mutes, warns)
CREATE TABLE public.sanctions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'ban', 'mute', 'kick', 'warn'
  reason TEXT,
  duration TEXT, -- pour les mutes temporaires
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  active BOOLEAN DEFAULT true
);

-- Table pour les rôles temporaires
CREATE TABLE public.temp_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les recherches rapides
CREATE INDEX idx_sanctions_guild_user ON public.sanctions(guild_id, user_id);
CREATE INDEX idx_sanctions_active ON public.sanctions(active);
CREATE INDEX idx_temp_roles_expires ON public.temp_roles(expires_at);