# Actor Spec Categories - Quick Guide

## Overview
Actor spec categories allow you to create custom categories tied to specific actors. For example, "Mission Impossible" for Tom Cruise, where only specific movies from that franchise are eligible.

## Files Created

1. **Migration**: `supabase/migrations/20251113130000_add_actor_spec_category_helpers.sql`
   - Contains helper functions for easy management
   - Run this in Supabase SQL Editor to add the functions

2. **Quick Reference**: `add-actor-spec-category.sql`
   - Examples and templates for adding categories
   - Copy/paste ready queries

## Quick Start

### Step 1: Apply the Helper Functions Migration

Go to Supabase SQL Editor and run:
```
supabase/migrations/20251113130000_add_actor_spec_category_helpers.sql
```

This creates:
- `get_actor_info(actor_name)` - Looks up actor in person_lifespans and actor_name_aliases
- `add_actor_spec_category(...)` - Easy function to add/update categories

### Step 2: Add Your First Category

**Easiest Method** (using the helper function):
```sql
SELECT add_actor_spec_category(
  'Tom Cruise',
  'Mission Impossible',
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],
  'Movies from the Mission Impossible franchise'
);
```

**Manual Method** (more control):
```sql
WITH actor_info AS (
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
  COALESCE(ai.actor_name, 'Tom Cruise'),
  ai.actor_tmdb_id,
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
```

## How It Works

### Actor Lookup Priority
1. **person_lifespans** - Most accurate, has TMDB ID (mainly for deceased/classic actors)
2. **actor_name_aliases** - Handles name variations (e.g., "Jimmy Stewart" → "James Stewart")
3. **Direct name** - Falls back to the name you provide (TMDB ID will be NULL)

### Category Matching
- When a user creates a draft with theme="people" and option="Tom Cruise"
- If "Mission Impossible" is in their selected categories
- Only movies with TMDB IDs in the array will be eligible for that category

## Finding TMDB Movie IDs

1. Go to https://www.themoviedb.org/
2. Search for the movie
3. The ID is in the URL: `https://www.themoviedb.org/movie/954` → ID is `954`

For franchises, collect all movie IDs into an array: `ARRAY[954, 1585, 956, ...]`

## Helper Functions

### `get_actor_info(actor_name TEXT)`
Looks up actor information from all available sources.

**Example:**
```sql
SELECT * FROM get_actor_info('Tom Cruise');
-- Returns: actor_name, actor_tmdb_id
```

### `add_actor_spec_category(...)`
One-line function to add or update a category.

**Parameters:**
- `p_actor_name` - Actor name (will auto-lookup TMDB ID)
- `p_category_name` - Category name
- `p_movie_tmdb_ids` - Array of TMDB movie IDs
- `p_description` - Optional description

**Example:**
```sql
SELECT add_actor_spec_category(
  'Tom Cruise',
  'Mission Impossible',
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],
  'Movies from the Mission Impossible franchise'
);
```

## Viewing Existing Categories

```sql
-- View all categories
SELECT * FROM actor_spec_categories ORDER BY actor_name, category_name;

-- View categories for specific actor
SELECT * FROM actor_spec_categories WHERE actor_name ILIKE '%Tom Cruise%';

-- Summary view
SELECT 
  actor_name,
  actor_tmdb_id,
  COUNT(*) as category_count,
  array_agg(category_name) as categories
FROM actor_spec_categories
GROUP BY actor_name, actor_tmdb_id
ORDER BY actor_name;
```

## Examples

### Mission Impossible (Tom Cruise)
```sql
SELECT add_actor_spec_category(
  'Tom Cruise',
  'Mission Impossible',
  ARRAY[954, 1585, 956, 56292, 177677, 353081, 575264],
  'Movies from the Mission Impossible franchise'
);
```

### Fast & Furious (Vin Diesel)
```sql
-- First, find the movie IDs on TMDB, then:
SELECT add_actor_spec_category(
  'Vin Diesel',
  'Fast & Furious',
  ARRAY[movie_id1, movie_id2, ...],  -- Replace with actual IDs
  'Movies from the Fast & Furious franchise'
);
```

## Notes

- `actor_tmdb_id` is optional - the system works with just actor names
- The helper functions automatically try to find TMDB IDs from existing tables
- If an actor isn't in `person_lifespans` or `actor_name_aliases`, you can still add categories with just the name
- The `ON CONFLICT` clause handles updates gracefully - running the same query twice won't create duplicates

