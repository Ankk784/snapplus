-- Table pour les tickets de support
CREATE TABLE public.tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    subject TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by TEXT
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY "Service role only - tickets" ON public.tickets
    FOR ALL USING (false);

-- Table pour les notes sur les utilisateurs
CREATE TABLE public.user_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY "Service role only - user_notes" ON public.user_notes
    FOR ALL USING (false);

-- Table pour la configuration des logs
CREATE TABLE public.guild_config (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL UNIQUE,
    logs_channel_id TEXT,
    welcome_channel_id TEXT,
    welcome_message TEXT,
    goodbye_message TEXT,
    captcha_enabled BOOLEAN DEFAULT false,
    captcha_channel_id TEXT,
    captcha_role_id TEXT,
    antiraid_enabled BOOLEAN DEFAULT false,
    antiraid_max_joins INTEGER DEFAULT 10,
    antiraid_timeframe INTEGER DEFAULT 60,
    ticket_category_id TEXT,
    ticket_support_role_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guild_config ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY "Service role only - guild_config" ON public.guild_config
    FOR ALL USING (false);

-- Table pour les logs d'actions
CREATE TABLE public.mod_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    user_id TEXT,
    moderator_id TEXT,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mod_logs ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY "Service role only - mod_logs" ON public.mod_logs
    FOR ALL USING (false);

-- Ajouter des index pour les performances
CREATE INDEX idx_tickets_guild_id ON public.tickets(guild_id);
CREATE INDEX idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX idx_user_notes_guild_user ON public.user_notes(guild_id, user_id);
CREATE INDEX idx_mod_logs_guild_id ON public.mod_logs(guild_id);
CREATE INDEX idx_mod_logs_user_id ON public.mod_logs(user_id);
CREATE INDEX idx_guild_config_guild_id ON public.guild_config(guild_id);