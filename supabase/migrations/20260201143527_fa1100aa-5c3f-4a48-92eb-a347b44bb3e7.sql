-- Create bot_licenses table for license/token system
CREATE TABLE public.bot_licenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id text NOT NULL UNIQUE,
    license_key text NOT NULL UNIQUE,
    activated_by text NOT NULL,
    activated_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean NOT NULL DEFAULT true,
    plan_type text NOT NULL DEFAULT 'standard',
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_licenses ENABLE ROW LEVEL SECURITY;

-- Service role only policy
CREATE POLICY "Service role only - bot_licenses"
ON public.bot_licenses
FOR ALL
TO authenticated
USING (false);

-- Create index for fast lookups
CREATE INDEX idx_bot_licenses_guild_id ON public.bot_licenses(guild_id);
CREATE INDEX idx_bot_licenses_license_key ON public.bot_licenses(license_key);

-- Add valid_licenses table for storing generated license keys that can be redeemed
CREATE TABLE public.valid_licenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key text NOT NULL UNIQUE,
    plan_type text NOT NULL DEFAULT 'standard',
    duration_days integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    redeemed boolean NOT NULL DEFAULT false,
    redeemed_by text,
    redeemed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.valid_licenses ENABLE ROW LEVEL SECURITY;

-- Service role only policy
CREATE POLICY "Service role only - valid_licenses"
ON public.valid_licenses
FOR ALL
TO authenticated
USING (false);