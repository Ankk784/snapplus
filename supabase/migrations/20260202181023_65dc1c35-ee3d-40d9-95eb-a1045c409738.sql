-- Table for IP bans
CREATE TABLE public.banned_ips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL,
  reason text,
  banned_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;

-- Only service_role can access
CREATE POLICY "Service role access"
ON public.banned_ips
FOR ALL
USING (false)
WITH CHECK (false);

-- Create index for fast lookups
CREATE INDEX idx_banned_ips_ip ON public.banned_ips(ip_address);