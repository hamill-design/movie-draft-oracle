-- Create actor_spec_categories table for actor-specific categories
-- This allows admins to create custom categories tied to specific actors
-- Example: Tom Cruise -> "Mission Impossible" category with specific movie IDs

CREATE TABLE IF NOT EXISTS public.actor_spec_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_name TEXT NOT NULL,  -- e.g., "Tom Cruise"
  actor_tmdb_id INTEGER,     -- Optional: for more precise matching via TMDB ID
  category_name TEXT NOT NULL,  -- e.g., "Mission Impossible"
  movie_tmdb_ids INTEGER[] NOT NULL,  -- Array of TMDB movie IDs that qualify
  description TEXT,  -- Optional description of the category
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(actor_name, category_name)  -- One category per actor (can have multiple categories per actor)
);

-- Create index for faster lookups by actor name
CREATE INDEX IF NOT EXISTS idx_actor_spec_categories_actor_name 
  ON public.actor_spec_categories(actor_name);

-- Create index for faster lookups by actor TMDB ID
CREATE INDEX IF NOT EXISTS idx_actor_spec_categories_actor_tmdb_id 
  ON public.actor_spec_categories(actor_tmdb_id) 
  WHERE actor_tmdb_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.actor_spec_categories ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (app needs to read these)
CREATE POLICY "Actor spec categories are publicly readable" 
  ON public.actor_spec_categories 
  FOR SELECT 
  USING (true);

-- Create policy to restrict modifications (admin can manage in Supabase Studio)
-- For now, allow all operations - you can restrict this later if needed
CREATE POLICY "Allow admin modifications" 
  ON public.actor_spec_categories 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_actor_spec_categories_updated_at
BEFORE UPDATE ON public.actor_spec_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_oscar_cache_updated_at();

-- Example: Add Tom Cruise Mission Impossible category
-- You'll need to populate the actual TMDB IDs for Mission Impossible movies
-- INSERT INTO public.actor_spec_categories (actor_name, category_name, movie_tmdb_ids, description)
-- VALUES (
--   'Tom Cruise',
--   'Mission Impossible',
--   ARRAY[954, 1585, 56292, 177677, 353081, 575264],  -- Example IDs, replace with actual
--   'Movies from the Mission Impossible franchise'
-- );


