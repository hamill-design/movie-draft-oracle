-- Add poster_path column to draft_picks table
ALTER TABLE public.draft_picks 
ADD COLUMN poster_path TEXT;