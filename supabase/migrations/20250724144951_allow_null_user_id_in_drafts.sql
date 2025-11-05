-- Allow NULL values in user_id column for guest sessions
ALTER TABLE public.drafts ALTER COLUMN user_id DROP NOT NULL;