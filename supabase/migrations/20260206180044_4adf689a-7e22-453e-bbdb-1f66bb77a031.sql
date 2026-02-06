-- Add LTC address column to payment_config
ALTER TABLE public.payment_config 
ADD COLUMN IF NOT EXISTS ltc_address TEXT;