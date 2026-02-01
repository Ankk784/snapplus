-- Add antilink column to guild_config
ALTER TABLE public.guild_config 
ADD COLUMN IF NOT EXISTS antilink_enabled boolean DEFAULT false;