-- Create spec_draft_categories table for custom categories per spec draft
-- These are custom categories that admins can create for each spec draft
CREATE TABLE IF NOT EXISTS public.spec_draft_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_draft_id UUID NOT NULL REFERENCES public.spec_drafts(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(spec_draft_id, category_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_spec_draft_categories_spec_draft_id 
  ON public.spec_draft_categories(spec_draft_id);

-- Enable RLS
ALTER TABLE public.spec_draft_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow public read, authenticated write (frontend enforces admin check)
CREATE POLICY "Spec draft categories are publicly readable" 
  ON public.spec_draft_categories 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can modify spec draft categories" 
  ON public.spec_draft_categories 
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_spec_draft_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_spec_draft_categories_updated_at
BEFORE UPDATE ON public.spec_draft_categories
FOR EACH ROW
EXECUTE FUNCTION update_spec_draft_categories_updated_at();

