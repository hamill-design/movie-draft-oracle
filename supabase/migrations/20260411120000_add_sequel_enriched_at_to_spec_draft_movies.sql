-- Track when TMDB collection-based sequel detection has run (NULL = not yet enriched; eligible for backfill)
ALTER TABLE public.spec_draft_movies
  ADD COLUMN IF NOT EXISTS sequel_enriched_at TIMESTAMPTZ;

COMMENT ON COLUMN public.spec_draft_movies.sequel_enriched_at IS
  'Set when is_sequel was computed from TMDB (fetch-movies search or enrich-spec-draft-sequels). NULL means pending backfill.';
