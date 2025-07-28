-- Add is_public column to drafts table
ALTER TABLE public.drafts 
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance on public drafts
CREATE INDEX idx_drafts_is_public ON public.drafts(is_public) WHERE is_public = true;

-- Add RLS policy to allow public read access for public drafts
CREATE POLICY "Public drafts are viewable by everyone" 
ON public.drafts 
FOR SELECT 
USING (is_public = true);

-- Add RLS policy to allow public read access for picks from public drafts
CREATE POLICY "Public draft picks are viewable by everyone" 
ON public.draft_picks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.drafts d 
  WHERE d.id = draft_picks.draft_id AND d.is_public = true
));