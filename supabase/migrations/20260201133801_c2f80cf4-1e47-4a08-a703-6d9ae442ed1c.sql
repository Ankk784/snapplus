-- Activer RLS sur sanctions et temp_roles
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_roles ENABLE ROW LEVEL SECURITY;

-- Politique: seul le service role peut accéder (via edge functions)
CREATE POLICY "Service role only - sanctions" ON public.sanctions FOR ALL USING (false);
CREATE POLICY "Service role only - temp_roles" ON public.temp_roles FOR ALL USING (false);