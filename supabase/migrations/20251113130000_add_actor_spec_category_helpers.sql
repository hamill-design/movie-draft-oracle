-- Helper functions and queries for managing actor_spec_categories
-- This migration provides utilities to easily add actor spec categories
-- with automatic lookup from person_lifespans and actor_name_aliases

-- ============================================================================
-- HELPER FUNCTION: Get actor info from all available sources
-- ============================================================================
-- This function tries to find actor information in this order:
-- 1. person_lifespans (most accurate, has TMDB ID)
-- 2. actor_name_aliases (handles name variations)
-- 3. Returns NULL if not found (you can still add with just the name)

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

-- ============================================================================
-- HELPER FUNCTION: Add or update actor spec category with auto-lookup
-- ============================================================================
-- Usage: SELECT add_actor_spec_category('Tom Cruise', 'Mission Impossible', 
--        ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264], 
--        'Movies from the Mission Impossible franchise');

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
  -- Get actor info using the helper function
  SELECT ai.actor_name, ai.actor_tmdb_id
  INTO v_actor_name, v_actor_tmdb_id
  FROM get_actor_info(p_actor_name) ai;
  
  -- If not found, use the provided name
  IF v_actor_name IS NULL THEN
    v_actor_name := p_actor_name;
  END IF;
  
  -- Insert or update the spec category
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
  
  -- Return the result
  RETURN QUERY
  SELECT 
    v_actor_name,
    v_actor_tmdb_id,
    p_category_name,
    TRUE as success;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXAMPLE: Add Mission Impossible category for Tom Cruise
-- ============================================================================
-- TMDB Movie IDs for Mission Impossible franchise:
-- Mission: Impossible (1996) - 954
-- Mission: Impossible 2 (2000) - 1585
-- Mission: Impossible III (2006) - 956
-- Mission: Impossible - Ghost Protocol (2011) - 56292
-- Mission: Impossible - Rogue Nation (2015) - 177677
-- Mission: Impossible - Fallout (2018) - 353081
-- Mission: Impossible - Dead Reckoning Part One (2023) - 575264

SELECT add_actor_spec_category(
  'Tom Cruise',
  'Mission Impossible',
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],
  'Movies from the Mission Impossible franchise starring Tom Cruise'
);

-- ============================================================================
-- QUERY TEMPLATES FOR MANUAL ENTRY
-- ============================================================================

-- Template 1: Using the helper function (recommended)
-- SELECT add_actor_spec_category(
--   'Actor Name',           -- Actor name (will auto-lookup TMDB ID if available)
--   'Category Name',        -- Your spec category name
--   ARRAY[movie_id1, movie_id2, ...],  -- Array of TMDB movie IDs
--   'Description'           -- Optional description
-- );

-- Template 2: Direct insert with auto-lookup
-- WITH actor_info AS (
--   SELECT ai.actor_name, ai.actor_tmdb_id
--   FROM get_actor_info('Actor Name') ai
-- )
-- INSERT INTO public.actor_spec_categories (
--   actor_name,
--   actor_tmdb_id,
--   category_name,
--   movie_tmdb_ids,
--   description
-- )
-- SELECT 
--   COALESCE(ai.actor_name, 'Actor Name'),
--   ai.actor_tmdb_id,
--   'Category Name',
--   ARRAY[movie_id1, movie_id2, ...],
--   'Description'
-- FROM actor_info ai
-- ON CONFLICT (actor_name, category_name) 
-- DO UPDATE SET
--   actor_tmdb_id = COALESCE(EXCLUDED.actor_tmdb_id, actor_spec_categories.actor_tmdb_id),
--   movie_tmdb_ids = EXCLUDED.movie_tmdb_ids,
--   description = COALESCE(EXCLUDED.description, actor_spec_categories.description),
--   updated_at = now();

-- Template 3: Simple insert (no lookup, just use name)
-- INSERT INTO public.actor_spec_categories (
--   actor_name,
--   category_name,
--   movie_tmdb_ids,
--   description
-- ) VALUES (
--   'Actor Name',
--   'Category Name',
--   ARRAY[movie_id1, movie_id2, ...],
--   'Description'
-- )
-- ON CONFLICT (actor_name, category_name) 
-- DO UPDATE SET
--   movie_tmdb_ids = EXCLUDED.movie_tmdb_ids,
--   description = EXCLUDED.description,
--   updated_at = now();

