-- Create oscar_cache table to store Oscar status for movies
CREATE TABLE public.oscar_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tmdb_id INTEGER NOT NULL UNIQUE,
  movie_title TEXT NOT NULL,
  movie_year INTEGER,
  oscar_status TEXT NOT NULL DEFAULT 'none', -- 'winner', 'nominee', 'none'
  awards_data TEXT, -- Store raw awards data from OMDb
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups by tmdb_id
CREATE INDEX idx_oscar_cache_tmdb_id ON public.oscar_cache (tmdb_id);

-- Create index for movie title and year lookups
CREATE INDEX idx_oscar_cache_title_year ON public.oscar_cache (movie_title, movie_year);

-- Enable RLS (this is a cache table, so we can make it readable by everyone)
ALTER TABLE public.oscar_cache ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read from the cache
CREATE POLICY "Oscar cache is readable by everyone" 
ON public.oscar_cache 
FOR SELECT 
USING (true);

-- Only allow system/functions to insert/update cache entries
CREATE POLICY "Only functions can modify oscar cache" 
ON public.oscar_cache 
FOR ALL 
USING (false);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_oscar_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_oscar_cache_updated_at
BEFORE UPDATE ON public.oscar_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_oscar_cache_updated_at();