-- Add Metacritic score column to draft_picks table
ALTER TABLE public.draft_picks 
ADD COLUMN metacritic_score integer;