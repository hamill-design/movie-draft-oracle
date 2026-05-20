-- Fix infinite recursion in league_members RLS policies.
--
-- Root cause: the league_members SELECT policy queries league_members
-- to check membership, causing Postgres to recurse infinitely.
-- Same problem that existed in draft_participants (fixed in 20250711043113).
--
-- Solution: a SECURITY DEFINER function that bypasses RLS when checking
-- membership, breaking the recursion chain. All policies that need to
-- check "is this user a league member?" use the function instead of a
-- direct SELECT on league_members.

-- ── Helper function ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_league_member(league_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = league_uuid AND user_id = auth.uid()
  );
$$;

-- ── Fix league_members SELECT (was self-referencing) ──────────────────────
DROP POLICY IF EXISTS "League members can view other members" ON public.league_members;

CREATE POLICY "League members can view other members"
ON public.league_members FOR SELECT
USING (public.is_league_member(league_id));

-- ── Fix leagues SELECT (member check now uses the safe function) ──────────
DROP POLICY IF EXISTS "League members can view their leagues" ON public.leagues;

CREATE POLICY "League members can view their leagues"
ON public.leagues FOR SELECT
USING (public.is_league_member(id));

-- ── Fix league_drafts SELECT ──────────────────────────────────────────────
DROP POLICY IF EXISTS "League members can view league drafts" ON public.league_drafts;

CREATE POLICY "League members can view league drafts"
ON public.league_drafts FOR SELECT
USING (public.is_league_member(league_id));

-- ── Fix league_invites SELECT ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Invited user can view their own invites" ON public.league_invites;

CREATE POLICY "Invited user can view their own invites"
ON public.league_invites FOR SELECT
USING (
  invited_user_id = auth.uid()
  OR invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  OR invited_by = auth.uid()
  OR public.is_league_member(league_id)
);
