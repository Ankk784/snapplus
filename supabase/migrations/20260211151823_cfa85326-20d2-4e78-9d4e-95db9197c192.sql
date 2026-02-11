
-- Add log channel columns to guild_config
ALTER TABLE public.guild_config 
  ADD COLUMN IF NOT EXISTS logs_category_id text,
  ADD COLUMN IF NOT EXISTS raid_logs_channel_id text,
  ADD COLUMN IF NOT EXISTS mod_logs_channel_id text,
  ADD COLUMN IF NOT EXISTS msg_logs_channel_id text,
  ADD COLUMN IF NOT EXISTS role_logs_channel_id text,
  ADD COLUMN IF NOT EXISTS voice_logs_channel_id text,
  ADD COLUMN IF NOT EXISTS boost_logs_channel_id text;
