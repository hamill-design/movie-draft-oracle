-- ============================================================
-- LEAGUES: Let invited (not-yet-member) users preview the league
--
-- Bug: clicking the "You've been invited to a league" notification
-- links to /league/<id>, but the leagues SELECT RLS policy only
-- allows is_league_member(id). An invited user who hasn't accepted
-- yet gets a null league row -> "League not found."
--
-- Fix: add an additional permissive SELECT policy so a user with a
-- pending, non-expired invite can read basic league info (name etc.)
-- needed to render an "Accept / Decline" preview screen.
-- ============================================================

CREATE POLICY "Invited users can preview the league"
ON public.leagues FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.league_invites li
    WHERE li.league_id = leagues.id
      AND li.invited_user_id = auth.uid()
      AND li.status = 'pending'
      AND li.expires_at > now()
  )
);
