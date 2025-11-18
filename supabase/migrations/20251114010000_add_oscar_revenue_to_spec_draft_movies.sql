-- Add oscar_status and revenue columns to spec_draft_movies for better category automation
ALTER TABLE public.spec_draft_movies 
ADD COLUMN IF NOT EXISTS oscar_status TEXT,
ADD COLUMN IF NOT EXISTS revenue BIGINT;

-- Add index for faster oscar status lookups
CREATE INDEX IF NOT EXISTS idx_spec_draft_movies_oscar_status 
  ON public.spec_draft_movies(oscar_status) 
  WHERE oscar_status IS NOT NULL;

-- Add index for revenue lookups
CREATE INDEX IF NOT EXISTS idx_spec_draft_movies_revenue 
  ON public.spec_draft_movies(revenue) 
  WHERE revenue IS NOT NULL;

