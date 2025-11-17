-- Create spec_drafts table for spec draft templates
-- These are draft configurations that admins can create with pre-selected movies
CREATE TABLE IF NOT EXISTS public.spec_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,  -- Name of the spec draft (e.g., "Action Blockbusters 2020s")
  description TEXT,    -- Optional description
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create spec_draft_movies table to link movies to spec drafts
CREATE TABLE IF NOT EXISTS public.spec_draft_movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_draft_id UUID NOT NULL REFERENCES public.spec_drafts(id) ON DELETE CASCADE,
  movie_tmdb_id INTEGER NOT NULL,
  movie_title TEXT NOT NULL,
  movie_year INTEGER,
  movie_poster_path TEXT,
  movie_genres INTEGER[],  -- Array of TMDB genre IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(spec_draft_id, movie_tmdb_id)
);

-- Create spec_draft_movie_categories table to track which categories each movie can apply to
CREATE TABLE IF NOT EXISTS public.spec_draft_movie_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_draft_movie_id UUID NOT NULL REFERENCES public.spec_draft_movies(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  is_automated BOOLEAN DEFAULT false,  -- Whether this was auto-matched from genres
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(spec_draft_movie_id, category_name)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_spec_draft_movies_spec_draft_id 
  ON public.spec_draft_movies(spec_draft_id);

CREATE INDEX IF NOT EXISTS idx_spec_draft_movies_movie_tmdb_id 
  ON public.spec_draft_movies(movie_tmdb_id);

CREATE INDEX IF NOT EXISTS idx_spec_draft_movie_categories_spec_draft_movie_id 
  ON public.spec_draft_movie_categories(spec_draft_movie_id);

CREATE INDEX IF NOT EXISTS idx_spec_draft_movie_categories_category_name 
  ON public.spec_draft_movie_categories(category_name);

-- Enable RLS
ALTER TABLE public.spec_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_draft_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_draft_movie_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow public read, authenticated write (frontend enforces admin check)
CREATE POLICY "Spec drafts are publicly readable" 
  ON public.spec_drafts 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can modify spec drafts" 
  ON public.spec_drafts 
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Spec draft movies are publicly readable" 
  ON public.spec_draft_movies 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can modify spec draft movies" 
  ON public.spec_draft_movies 
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Spec draft movie categories are publicly readable" 
  ON public.spec_draft_movie_categories 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can modify spec draft movie categories" 
  ON public.spec_draft_movie_categories 
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_spec_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_spec_drafts_updated_at
BEFORE UPDATE ON public.spec_drafts
FOR EACH ROW
EXECUTE FUNCTION update_spec_drafts_updated_at();

