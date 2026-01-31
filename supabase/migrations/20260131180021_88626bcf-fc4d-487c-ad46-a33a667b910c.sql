-- Table pour stocker les informations du système de stats
CREATE TABLE public.stats_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  stats_message_id TEXT,
  stats_channel_id TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_update TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour tracker les visites
CREATE TABLE public.visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_hash TEXT,
  user_agent TEXT
);

-- Insérer la config par défaut
INSERT INTO public.stats_config (id) VALUES ('main');

-- Enable RLS
ALTER TABLE public.stats_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Policies pour permettre la lecture publique
CREATE POLICY "Allow public read stats_config" ON public.stats_config FOR SELECT USING (true);
CREATE POLICY "Allow public read visits" ON public.visits FOR SELECT USING (true);
CREATE POLICY "Allow public insert visits" ON public.visits FOR INSERT WITH CHECK (true);