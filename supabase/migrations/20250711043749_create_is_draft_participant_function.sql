-- Create a security definer function to check if user is a participant
CREATE OR REPLACE FUNCTION public.is_draft_participant(draft_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = draft_id_param 
    AND dp.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update the drafts policy to use the function
DROP POLICY IF EXISTS "Users can view their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can view drafts they participate in" ON public.drafts;

CREATE POLICY "Users can view drafts they participate in"
ON public.drafts
FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR 
  public.is_draft_participant(id)
);