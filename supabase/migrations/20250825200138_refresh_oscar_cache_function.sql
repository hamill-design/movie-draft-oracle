-- Manual cache updates for known Oscar winners that are incorrectly marked as "none"
UPDATE oscar_cache 
SET oscar_status = 'winner', 
    awards_data = 'Academy Award Winner - Best Picture',
    updated_at = now()
WHERE movie_title = 'The English Patient' AND movie_year = 1996 AND oscar_status = 'none';

UPDATE oscar_cache 
SET oscar_status = 'winner',
    awards_data = 'Academy Award Winner - Best Picture', 
    updated_at = now()
WHERE movie_title = 'Titanic' AND movie_year = 1997 AND oscar_status = 'none';

UPDATE oscar_cache 
SET oscar_status = 'winner',
    awards_data = 'Academy Award Winner - Best Picture',
    updated_at = now() 
WHERE movie_title = 'Forrest Gump' AND movie_year = 1994 AND oscar_status = 'none';

UPDATE oscar_cache 
SET oscar_status = 'winner',
    awards_data = 'Academy Award Winner - Best Picture',
    updated_at = now()
WHERE movie_title = 'The Silence of the Lambs' AND movie_year = 1991 AND oscar_status = 'none';

UPDATE oscar_cache 
SET oscar_status = 'winner', 
    awards_data = 'Academy Award Winner - Best Picture',
    updated_at = now()
WHERE movie_title = 'Goodfellas' AND movie_year = 1990 AND oscar_status = 'none';

-- Add cache refresh function to identify and refresh questionable Oscar data
CREATE OR REPLACE FUNCTION refresh_oscar_cache_for_questionable_entries()
RETURNS TABLE (
  refreshed_count INTEGER,
  entries_found INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  total_entries INTEGER := 0;
  refreshed_entries INTEGER := 0;
BEGIN
  -- Count entries that likely should have Oscar data but are marked as 'none'
  SELECT COUNT(*) INTO total_entries
  FROM oscar_cache oc
  WHERE oc.oscar_status = 'none' 
    AND oc.movie_year BETWEEN 1990 AND 2020
    AND (
      -- Movies with high revenue that likely won or were nominated
      EXISTS (
        SELECT 1 FROM draft_picks dp 
        WHERE dp.movie_title = oc.movie_title 
          AND dp.movie_year = oc.movie_year
          AND dp.movie_revenue > 100000000
      )
      -- Or movies with high ratings that likely had Oscar presence
      OR EXISTS (
        SELECT 1 FROM draft_picks dp
        WHERE dp.movie_title = oc.movie_title
          AND dp.movie_year = oc.movie_year  
          AND (dp.imdb_rating > 8.0 OR dp.rt_critics_score > 85)
      )
    );

  -- Mark these entries for refresh by clearing their cache (they'll be re-fetched)
  WITH questionable_entries AS (
    SELECT oc.id
    FROM oscar_cache oc
    WHERE oc.oscar_status = 'none'
      AND oc.movie_year BETWEEN 1990 AND 2020
      AND (
        EXISTS (
          SELECT 1 FROM draft_picks dp 
          WHERE dp.movie_title = oc.movie_title 
            AND dp.movie_year = oc.movie_year
            AND dp.movie_revenue > 100000000
        )
        OR EXISTS (
          SELECT 1 FROM draft_picks dp
          WHERE dp.movie_title = oc.movie_title
            AND dp.movie_year = oc.movie_year  
            AND (dp.imdb_rating > 8.0 OR dp.rt_critics_score > 85)
        )
      )
  )
  UPDATE oscar_cache 
  SET updated_at = '1990-01-01'::timestamp  -- Force refresh by making it very old
  WHERE id IN (SELECT id FROM questionable_entries);
  
  GET DIAGNOSTICS refreshed_entries = ROW_COUNT;
  
  RETURN QUERY SELECT refreshed_entries, total_entries;
END;
$$;

-- Create function to get cache statistics  
CREATE OR REPLACE FUNCTION get_oscar_cache_stats()
RETURNS TABLE (
  total_entries INTEGER,
  winners INTEGER, 
  nominees INTEGER,
  none_status INTEGER,
  entries_needing_refresh INTEGER
)
LANGUAGE plpgsql  
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_entries,
    COUNT(CASE WHEN oscar_status = 'winner' THEN 1 END)::INTEGER as winners,
    COUNT(CASE WHEN oscar_status = 'nominee' THEN 1 END)::INTEGER as nominees, 
    COUNT(CASE WHEN oscar_status = 'none' THEN 1 END)::INTEGER as none_status,
    COUNT(CASE WHEN updated_at < (now() - INTERVAL '30 days') THEN 1 END)::INTEGER as entries_needing_refresh
  FROM oscar_cache;
END;
$$;