-- Sequel category: store TMDB collection-based sequel flag for spec draft pool rows
ALTER TABLE public.spec_draft_movies
  ADD COLUMN IF NOT EXISTS is_sequel BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.spec_draft_movies.is_sequel IS
  'True when TMDB reports another film in the same collection with an earlier release date (see fetch-movies isSequel).';
