-- Supprimer les doublons (garder seulement le premier)
DELETE FROM public.submissions a
USING public.submissions b
WHERE a.id > b.id 
AND a.phone = b.phone;

-- Ajouter une contrainte unique sur le numéro de téléphone
ALTER TABLE public.submissions ADD CONSTRAINT submissions_phone_unique UNIQUE (phone);