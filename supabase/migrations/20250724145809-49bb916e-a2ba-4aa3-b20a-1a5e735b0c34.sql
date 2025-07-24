-- Allow NULL values in user_id column for guest participants
ALTER TABLE public.draft_participants ALTER COLUMN user_id DROP NOT NULL;