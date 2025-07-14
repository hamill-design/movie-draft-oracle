-- Add unique constraint to prevent duplicate movies in draft_picks
-- This will prevent the same movie from being picked twice in the same draft
ALTER TABLE public.draft_picks 
ADD CONSTRAINT unique_movie_per_draft 
UNIQUE (draft_id, movie_id);