-- Create bot_owners table for server-specific owners
CREATE TABLE public.bot_owners (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id text NOT NULL,
    user_id text NOT NULL,
    added_by text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (guild_id, user_id)
);

-- Enable RLS
ALTER TABLE public.bot_owners ENABLE ROW LEVEL SECURITY;

-- Service role only policy
CREATE POLICY "Service role only - bot_owners"
ON public.bot_owners
AS RESTRICTIVE
FOR ALL
USING (false);