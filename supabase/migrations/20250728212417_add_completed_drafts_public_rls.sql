-- Add RLS policies to make completed drafts publicly viewable

-- Policy for drafts table: Anyone can view completed drafts
CREATE POLICY "Anyone can view completed drafts" 
ON public.drafts 
FOR SELECT 
USING (is_complete = true);

-- Policy for draft_picks table: Anyone can view picks from completed drafts
CREATE POLICY "Anyone can view picks from completed drafts" 
ON public.draft_picks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.drafts d 
  WHERE d.id = draft_picks.draft_id 
  AND d.is_complete = true
));