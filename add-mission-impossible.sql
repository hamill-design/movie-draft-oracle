-- Add Mission Impossible category for Tom Cruise
-- TMDB Movie IDs for Mission Impossible franchise:
-- Mission: Impossible (1996) - 954
-- Mission: Impossible 2 (2000) - 1585
-- Mission: Impossible III (2006) - 956
-- Mission: Impossible - Ghost Protocol (2011) - 56292
-- Mission: Impossible - Rogue Nation (2015) - 177677
-- Mission: Impossible - Fallout (2018) - 353081
-- Mission: Impossible - Dead Reckoning Part One (2023) - 575264

INSERT INTO public.actor_spec_categories (
  actor_name,
  category_name,
  movie_tmdb_ids,
  description
) VALUES (
  'Tom Cruise',
  'Mission Impossible',
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],
  'Movies from the Mission Impossible franchise starring Tom Cruise'
)
ON CONFLICT (actor_name, category_name) 
DO UPDATE SET
  movie_tmdb_ids = EXCLUDED.movie_tmdb_ids,
  description = EXCLUDED.description,
  updated_at = now();

