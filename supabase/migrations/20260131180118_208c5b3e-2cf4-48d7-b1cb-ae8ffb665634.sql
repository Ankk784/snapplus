-- Activer les extensions nécessaires pour le cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Ajouter une policy pour permettre les updates depuis l'edge function (service role)
CREATE POLICY "Allow service role update stats_config" ON public.stats_config FOR UPDATE USING (true);