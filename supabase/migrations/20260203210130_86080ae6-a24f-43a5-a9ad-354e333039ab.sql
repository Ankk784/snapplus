-- Allow multiple submissions with the same phone number by removing the unique constraint
ALTER TABLE public.submissions
DROP CONSTRAINT IF EXISTS submissions_phone_unique;