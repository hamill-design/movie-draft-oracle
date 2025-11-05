-- Fix infinite recursion in draft_participants RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants of drafts they're in" ON public.draft_participants;

-- Create a corrected policy that checks via the drafts table instead
CREATE POLICY "Users can view participants of drafts they're in"
ON public.draft_participants
FOR SELECT
USING (
  (user_id = auth.uid()) 
  OR 
  (EXISTS (
    SELECT 1 FROM public.drafts d 
    WHERE d.id = draft_participants.draft_id 
    AND d.user_id = auth.uid()
  ))
);