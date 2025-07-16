-- Fix auto-join permission issue by allowing email-based draft access
-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view drafts they participate in" ON public.drafts;

-- Create updated policy that allows access when user's email is in participants array
CREATE POLICY "Users can view drafts they participate in"
ON public.drafts
FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR 
  public.is_draft_participant(id)
  OR
  (auth.email() = ANY(participants))
);