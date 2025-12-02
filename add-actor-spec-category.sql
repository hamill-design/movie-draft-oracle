-- ============================================================================
-- QUICK REFERENCE: How to Add Actor Spec Categories
-- ============================================================================
-- This file contains examples and templates for adding actor spec categories
-- Run these queries in Supabase SQL Editor

-- ============================================================================
-- METHOD 1: Using the helper function (EASIEST - Recommended)
-- ============================================================================
-- The add_actor_spec_category function automatically:
-- - Looks up actor in person_lifespans
-- - Falls back to actor_name_aliases
-- - Uses provided name if not found
-- - Handles updates if category already exists

SELECT add_actor_spec_category(
  'Tom Cruise',                    -- Actor name
  'Mission Impossible',            -- Category name
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],  -- Movie IDs
  'Movies from the Mission Impossible franchise'  -- Description
);

-- ============================================================================
-- METHOD 2: Direct insert with auto-lookup (More control)
-- ============================================================================

WITH actor_info AS (
  -- Automatically looks up actor in person_lifespans and actor_name_aliases
  SELECT ai.actor_name, ai.actor_tmdb_id
  FROM get_actor_info('Tom Cruise') ai
)
INSERT INTO public.actor_spec_categories (
  actor_name,
  actor_tmdb_id,
  category_name,
  movie_tmdb_ids,
  description
)
SELECT 
  COALESCE(ai.actor_name, 'Tom Cruise'),  -- Use looked-up name or fallback
  ai.actor_tmdb_id,                       -- TMDB ID if found (NULL if not)
  'Mission Impossible',
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],
  'Movies from the Mission Impossible franchise'
FROM actor_info ai
ON CONFLICT (actor_name, category_name) 
DO UPDATE SET
  actor_tmdb_id = COALESCE(EXCLUDED.actor_tmdb_id, actor_spec_categories.actor_tmdb_id),
  movie_tmdb_ids = EXCLUDED.movie_tmdb_ids,
  description = COALESCE(EXCLUDED.description, actor_spec_categories.description),
  updated_at = now();

-- ============================================================================
-- METHOD 3: Simple insert (No lookup, just use name)
-- ============================================================================
-- Use this if you don't need TMDB ID lookup

INSERT INTO public.actor_spec_categories (
  actor_name,
  category_name,
  movie_tmdb_ids,
  description
) VALUES (
  'Tom Cruise',
  'Mission Impossible',
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],
  'Movies from the Mission Impossible franchise'
)
ON CONFLICT (actor_name, category_name) 
DO UPDATE SET
  movie_tmdb_ids = EXCLUDED.movie_tmdb_ids,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- HELPER QUERIES: Check if actor exists before adding
-- ============================================================================

-- Check if actor exists in person_lifespans
SELECT name, tmdb_id 
FROM person_lifespans 
WHERE name ILIKE '%Tom Cruise%';

-- Check if actor exists in actor_name_aliases
SELECT primary_name, alias_name, tmdb_id
FROM actor_name_aliases
WHERE primary_name ILIKE '%Tom Cruise%' OR alias_name ILIKE '%Tom Cruise%';

-- Use the helper function to get actor info
SELECT * FROM get_actor_info('Tom Cruise');

-- ============================================================================
-- EXAMPLES: Other popular actor/category combinations
-- ============================================================================

-- Example: Add "Fast & Furious" category for Vin Diesel
-- (Replace with actual TMDB movie IDs)
-- SELECT add_actor_spec_category(
--   'Vin Diesel',
--   'Fast & Furious',
--   ARRAY[movie_id1, movie_id2, ...],
--   'Movies from the Fast & Furious franchise'
-- );

-- Example: Add "Marvel Cinematic Universe" for Robert Downey Jr.
-- SELECT add_actor_spec_category(
--   'Robert Downey Jr.',
--   'Marvel Cinematic Universe',
--   ARRAY[movie_id1, movie_id2, ...],
--   'MCU movies featuring Robert Downey Jr. as Iron Man'
-- );

-- ============================================================================
-- HOW TO FIND TMDB MOVIE IDs
-- ============================================================================
-- 1. Go to https://www.themoviedb.org/
-- 2. Search for the movie
-- 3. The ID is in the URL: https://www.themoviedb.org/movie/954 → ID is 954
-- 
-- For franchises, search for each movie individually and collect the IDs
-- into an array: ARRAY[954, 1585, 956, ...]

-- ============================================================================
-- VIEW EXISTING ENTRIES
-- ============================================================================

-- View all actor spec categories
SELECT * FROM actor_spec_categories ORDER BY actor_name, category_name;

-- View categories for a specific actor
SELECT * FROM actor_spec_categories WHERE actor_name ILIKE '%Tom Cruise%';

-- View all categories (grouped by actor)
SELECT 
  actor_name,
  actor_tmdb_id,
  COUNT(*) as category_count,
  array_agg(category_name) as categories
FROM actor_spec_categories
GROUP BY actor_name, actor_tmdb_id
ORDER BY actor_name;

