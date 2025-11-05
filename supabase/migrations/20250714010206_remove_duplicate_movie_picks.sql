-- Remove duplicate movie picks, keeping only the earliest one for each draft_id + movie_id combination
DELETE FROM public.draft_picks 
WHERE id NOT IN (
  SELECT DISTINCT ON (draft_id, movie_id) id
  FROM public.draft_picks
  ORDER BY draft_id, movie_id, created_at ASC
);

-- Now add the unique constraint to prevent future duplicates
ALTER TABLE public.draft_picks 
DROP CONSTRAINT IF EXISTS unique_movie_per_draft;

ALTER TABLE public.draft_picks 
ADD CONSTRAINT unique_movie_per_draft 
UNIQUE (draft_id, movie_id);