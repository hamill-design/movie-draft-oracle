-- Fix circular RLS dependency on leagues + league_members.
--
-- Problem: inserting the first league_member (the admin) requires
-- SELECTing from leagues to verify admin_id, but the leagues SELECT
-- policy requires the user to already be in league_members — a deadlock.
--
-- Fix 1: allow admins to SELECT their own league by admin_id directly.
-- Fix 2: drop the duplicate league_members INSERT policy that caused the
--         circular check; the simpler "user inserts themselves" policy is
--         sufficient for self-join, and invites use SECURITY DEFINER RPCs.

-- Allow league admin to always see leagues they created (breaks the cycle).
CREATE POLICY "League admin can view leagues they created"
ON public.leagues FOR SELECT
USING (admin_id = auth.uid());

-- Drop the circular admin INSERT policy on league_members.
-- The remaining "Users can insert themselves as members" policy covers
-- the creation case; RPC functions cover all other invite flows.
DROP POLICY IF EXISTS "League admin can insert any member" ON public.league_members;
