-- Fix infinite recursion in drafts RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view drafts they participate in" ON public.drafts;

-- Create a corrected policy that properly references the drafts table
CREATE POLICY "Users can view drafts they participate in"
ON public.drafts
FOR SELECT
USING (
  (user_id = auth.uid()) 
  OR 
  (EXISTS (
    SELECT 1 FROM public.draft_participants dp 
    WHERE dp.draft_id = drafts.id 
    AND dp.user_id = auth.uid()
  ))
);