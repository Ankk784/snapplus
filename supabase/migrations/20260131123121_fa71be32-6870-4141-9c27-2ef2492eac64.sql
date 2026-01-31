-- Table pour stocker les soumissions en attente
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  phone TEXT NOT NULL,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Pas de RLS car c'est géré par les edge functions
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre la lecture publique (pour le realtime)
CREATE POLICY "Allow public read" ON public.submissions FOR SELECT USING (true);

-- Activer le realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;