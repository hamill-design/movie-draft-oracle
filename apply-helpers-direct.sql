-- Apply this directly in Supabase SQL Editor
-- Copy everything below and paste into: https://supabase.com/dashboard/project/zduruulowyopdstihfwk/sql/new

CREATE OR REPLACE FUNCTION get_actor_info(actor_name_search TEXT)
RETURNS TABLE (
  actor_name TEXT,
  actor_tmdb_id INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH actor_lookup AS (
    -- Try person_lifespans first (most accurate)
    SELECT pl.name, pl.tmdb_id
    FROM person_lifespans pl
    WHERE pl.name ILIKE actor_name_search
    
    UNION ALL
    
    -- Then try actor_name_aliases (handles variations)
    SELECT 
      COALESCE(
        (SELECT primary_name FROM actor_name_aliases 
         WHERE alias_name ILIKE actor_name_search OR primary_name ILIKE actor_name_search 
         LIMIT 1),
        actor_name_search
      ) as name,
      aa.tmdb_id
    FROM actor_name_aliases aa
    WHERE aa.primary_name ILIKE actor_name_search OR aa.alias_name ILIKE actor_name_search
  )
  SELECT 
    COALESCE(al.name, actor_name_search) as actor_name,
    al.tmdb_id
  FROM actor_lookup al
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_actor_spec_category(
  p_actor_name TEXT,
  p_category_name TEXT,
  p_movie_tmdb_ids INTEGER[],
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  actor_name TEXT,
  actor_tmdb_id INTEGER,
  category_name TEXT,
  success BOOLEAN
) AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_tmdb_id INTEGER;
BEGIN
  SELECT ai.actor_name, ai.actor_tmdb_id
  INTO v_actor_name, v_actor_tmdb_id
  FROM get_actor_info(p_actor_name) ai;
  
  IF v_actor_name IS NULL THEN
    v_actor_name := p_actor_name;
  END IF;
  
  INSERT INTO public.actor_spec_categories (
    actor_name,
    actor_tmdb_id,
    category_name,
    movie_tmdb_ids,
    description
  )
  VALUES (
    v_actor_name,
    v_actor_tmdb_id,
    p_category_name,
    p_movie_tmdb_ids,
    p_description
  )
  ON CONFLICT (actor_name, category_name) 
  DO UPDATE SET
    actor_tmdb_id = COALESCE(EXCLUDED.actor_tmdb_id, actor_spec_categories.actor_tmdb_id),
    movie_tmdb_ids = EXCLUDED.movie_tmdb_ids,
    description = COALESCE(EXCLUDED.description, actor_spec_categories.description),
    updated_at = now();
  
  RETURN QUERY
  SELECT 
    v_actor_name,
    v_actor_tmdb_id,
    p_category_name,
    TRUE as success;
END;
$$ LANGUAGE plpgsql;

-- Test: Add Mission Impossible category for Tom Cruise
SELECT add_actor_spec_category(
  'Tom Cruise',
  'Mission Impossible',
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],
  'Movies from the Mission Impossible franchise starring Tom Cruise'
);


