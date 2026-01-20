-- Allow unauthenticated/guest users to get an invite code when they have a draft id (e.g. from email link).
-- This is used by the join-by-email-invite flow so guests can join without signing in.
-- The draft id is already in the URL; exposing invite_code for that id is acceptable.
CREATE OR REPLACE FUNCTION public.get_invite_code_for_draft(p_draft_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT invite_code FROM public.drafts WHERE id = p_draft_id;
$$;
