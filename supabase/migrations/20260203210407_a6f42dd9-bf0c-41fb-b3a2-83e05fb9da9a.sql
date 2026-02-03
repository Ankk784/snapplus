-- Fix linter: remove overly permissive UPDATE policy on stats_config
DROP POLICY IF EXISTS "Allow service role update stats_config" ON public.stats_config;

-- Fix linter: avoid WITH CHECK (true) on visits insert policy while keeping it public
DROP POLICY IF EXISTS "Allow public insert visits" ON public.visits;
CREATE POLICY "Allow public insert visits"
ON public.visits
FOR INSERT
WITH CHECK (
  user_agent IS NOT NULL
  AND char_length(user_agent) > 0
  AND char_length(user_agent) <= 1024
);