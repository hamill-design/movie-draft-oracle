-- ============================================================
-- ONLY A LEAGUE'S CREATOR CAN ADD THEMSELVES TO IT (step 2 of 3 in the email lockdown; recommended, independent)
--
-- THE PROBLEM
--   league_members has an INSERT rule, "Users can insert themselves as members", whose only test is
--   user_id = auth.uid(). So any signed-in user can add THEMSELVES to ANY league if they know its id, with no
--   invite. And league ids are not secret: the league_standings / league_season_standings views list them for
--   everyone, even signed-out visitors. Once inside a league a person can read its chat and, through
--   get_league_profiles(), the emails of its members. That would be a back door around the email lockdown.
--
-- THE FIX
--   The only place the app inserts into league_members directly is createLeague(), which adds the league's creator
--   as its first member (role 'admin') right after creating the league. Everyone else joins through the
--   accept_league_invite / accept_league_invite_by_token functions, which are SECURITY DEFINER and so are not
--   affected by this rule. So the rule is narrowed to exactly that case: you may insert yourself only into a league
--   you are the admin of.
--
-- Nothing in the website, the mobile app or the live production site (main) inserts any other way (checked in
-- src/, mobile/ and supabase/functions/). Safe to apply at any time, before or after the other two. Safe to run twice.
-- ============================================================

DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.league_members;
DROP POLICY IF EXISTS "League creators can add themselves as first member" ON public.league_members;

CREATE POLICY "League creators can add themselves as first member"
  ON public.league_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_members.league_id AND l.admin_id = auth.uid()
    )
  );
