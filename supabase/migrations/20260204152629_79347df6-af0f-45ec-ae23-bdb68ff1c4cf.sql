-- Add stats_interval column to stats_config
ALTER TABLE public.stats_config 
ADD COLUMN IF NOT EXISTS stats_interval_seconds integer DEFAULT 30;