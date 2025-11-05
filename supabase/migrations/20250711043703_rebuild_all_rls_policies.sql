-- Completely rebuild RLS policies to eliminate all recursion issues

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view drafts they participate in" ON public.drafts;
DROP POLICY IF EXISTS "Users can insert their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can update drafts they host" ON public.drafts;
DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.drafts;

DROP POLICY IF EXISTS "Users can view participants of drafts they're in" ON public.draft_participants;
DROP POLICY IF EXISTS "Users can insert themselves as participants" ON public.draft_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.draft_participants;

-- Create simple, non-recursive policies for drafts
CREATE POLICY "Users can insert their own drafts"
ON public.drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
ON public.drafts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
ON public.drafts
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own drafts"
ON public.drafts
FOR SELECT
USING (auth.uid() = user_id);

-- Create simple policies for draft_participants
CREATE POLICY "Users can insert themselves as participants"
ON public.draft_participants
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation"
ON public.draft_participants
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view all participants"
ON public.draft_participants
FOR SELECT
USING (true);