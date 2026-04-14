-- Rich text for public /special-draft/:slug landing pages (crawlable movie blurbs)
ALTER TABLE public.spec_draft_movies
  ADD COLUMN IF NOT EXISTS movie_overview TEXT,
  ADD COLUMN IF NOT EXISTS seo_blurb TEXT;

COMMENT ON COLUMN public.spec_draft_movies.movie_overview IS
  'Optional TMDB-style synopsis; shown on theme landing pages (truncated) when seo_blurb is empty.';
COMMENT ON COLUMN public.spec_draft_movies.seo_blurb IS
  'Optional curated line or paragraph for theme pages; overrides movie_overview when set.';
