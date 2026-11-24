-- ============================================================
-- SAFE WAYS TO READ OTHER PEOPLE'S PROFILES (step 1 of 3 in the email lockdown)
--
-- THE PROBLEM
--   public.profiles has a rule, "Authenticated users can view any profile", so that league pages could show names
--   and avatars. It lets every signed-in user read every row, including `email`, the marketing opt-in flags and the
--   ban / cooldown columns. With public play, signed-in users are strangers.
--
-- WHAT THIS MIGRATION DOES
--   It ONLY ADDS three read functions. It changes no table, no rule and no existing function, so the live site
--   behaves exactly as before the moment it is applied. The screens are then moved onto these functions in the same
--   release, and a later migration (20261123150000_profiles_read_own_row_only.sql) closes the table.
--
--   Each function is SECURITY DEFINER with a fixed search_path, only for signed-in callers, only returns the columns
--   the screens actually need, and only for people the caller already has a reason to see:
--
--   1. get_league_profiles(league)   people in ONE league you belong to: name, avatar and (for current members)
--                                    email. Also names and avatars of people who posted in that league's chat and
--                                    have since left, so old messages keep their author. Not a member: no rows.
--                                    The email stays because the draft-invite screens add league mates by email;
--                                    it is only visible to people in the same league (see 20261123140000 for the
--                                    rule that stops anyone from simply joining a league).
--   2. get_draft_people(draft)       the signed-in people in ONE draft you are in (or own): avatar and email.
--                                    The email is left out for public tables, always, decided here on the server
--                                    (the screen used to decide it, and a failed lookup showed emails).
--   3. get_my_league_inviters()      the names (nothing else) of the people who invited you to a league.
--
-- Run BEFORE the code that calls these goes live, and BEFORE 20261123150000. Safe to run twice.
-- ============================================================


-- 1. People in a league --------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_league_profiles(p_league_id uuid)
RETURNS TABLE (user_id uuid, name text, avatar_url text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id,
         p.name,
         p.avatar_url,
         -- Only current members' emails. Someone who has left is a name and a picture on their old messages.
         CASE WHEN m.user_id IS NOT NULL THEN p.email END
  FROM public.profiles p
  LEFT JOIN public.league_members m
         ON m.user_id = p.id AND m.league_id = p_league_id
  WHERE auth.uid() IS NOT NULL
    AND public.is_league_member(p_league_id)
    AND (
      m.user_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.league_messages lm
        WHERE lm.league_id = p_league_id AND lm.user_id = p.id
      )
    );
$function$;


-- 2. People in a draft ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_draft_people(p_draft_id uuid)
RETURNS TABLE (user_id uuid, avatar_url text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id,
         p.avatar_url,
         -- Strangers must never see each other's addresses: a public table never returns one.
         CASE WHEN public.draft_is_public(p_draft_id) THEN NULL ELSE p.email END
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    -- the same door the draft room itself uses: the owner or someone seated in this draft
    AND public.can_access_draft(p_draft_id, auth.uid())
    AND p.id IN (
      SELECT dp.user_id FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id AND dp.user_id IS NOT NULL
    );
$function$;


-- 3. Who invited me to a league ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_league_inviters()
RETURNS TABLE (user_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id, p.name
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id IN (
      SELECT li.invited_by
      FROM public.league_invites li
      WHERE li.invited_user_id = auth.uid()
        AND li.status::text = 'pending'
        AND li.invited_by IS NOT NULL
    );
$function$;


-- Signed-in people only (never the signed-out "anon" role).
REVOKE ALL ON FUNCTION public.get_league_profiles(uuid)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_draft_people(uuid)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_league_inviters()   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_league_profiles(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_draft_people(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_league_inviters()   TO authenticated, service_role;
