-- Add extended moderation settings to guild_config
ALTER TABLE public.guild_config 
ADD COLUMN IF NOT EXISTS antilink_type text DEFAULT 'invites',
ADD COLUMN IF NOT EXISTS antilink_sanction text DEFAULT 'delete',
ADD COLUMN IF NOT EXISTS antilink_ignored_channels text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS antispam_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS antispam_max_messages integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS antispam_timeframe integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS antispam_sanction text DEFAULT 'mute',
ADD COLUMN IF NOT EXISTS public_allowed_channels text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS public_denied_channels text[] DEFAULT '{}';