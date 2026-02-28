INSERT INTO public.payment_config (id, paypal_email, ltc_address, price_standard, price_premium, price_lifetime)
VALUES ('secondary', NULL, NULL, '5€', '12€', '25€')
ON CONFLICT (id) DO NOTHING;