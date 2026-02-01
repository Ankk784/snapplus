-- Create payment_config table for PayPal settings
CREATE TABLE public.payment_config (
    id text PRIMARY KEY DEFAULT 'main',
    paypal_email text,
    price_standard text DEFAULT '5€',
    price_premium text DEFAULT '12€',
    price_lifetime text DEFAULT '25€',
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

-- Service role only policy
CREATE POLICY "Service role only - payment_config"
ON public.payment_config
FOR ALL
TO authenticated
USING (false);

-- Insert default row
INSERT INTO public.payment_config (id) VALUES ('main');