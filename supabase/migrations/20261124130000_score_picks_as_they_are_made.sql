-- ============================================================
-- SCORE PICKS AS THEY ARE MADE (so Final Scores opens in seconds, not after a long wait)
--
-- THE PROBLEM
--   A pick's score (the number on the Final Scores page) is worked out by looking the film up (critic and audience
--   ratings, box office). Until now that only happened when someone OPENED the Final Scores page, one film at a time,
--   about 2 seconds each: a 20-pick draft meant roughly 40 seconds of "Loading...". The server only scored RATED
--   games, and only after they finished.
--
-- WHAT THIS ADDS
--   One function the minute job uses: referee_list_unscored_picks(). It lists the films picked in the last 6 hours
--   that still have no score, newest first, one row per film (a film is scored for every draft that picked it). The
--   scheduled job scores a few of them each minute, so by the time a draft ends most picks already have their score.
--   The server also scores each bot or auto pick right after it is made.
--
-- It is for the scheduled job only (the service role): players and visitors cannot call it. It only reads. Nothing
-- existing is changed. Safe to run twice. Without it nothing breaks: the job logs that the list is missing and the
-- Final Scores page scores what is left, as before.
-- ============================================================

CREATE OR REPLACE FUNCTION public.referee_list_unscored_picks(p_limit integer DEFAULT 12)
RETURNS TABLE(movie_id integer, movie_title text, movie_year integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pk.movie_id,
         (array_agg(pk.movie_title ORDER BY pk.created_at DESC))[1],
         (array_agg(pk.movie_year  ORDER BY pk.created_at DESC))[1]
  FROM public.draft_picks pk
  WHERE pk.calculated_score IS NULL
    AND pk.created_at > now() - interval '6 hours'
  GROUP BY pk.movie_id
  ORDER BY max(pk.created_at) DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50));
$$;

REVOKE ALL ON FUNCTION public.referee_list_unscored_picks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referee_list_unscored_picks(integer) TO service_role;
