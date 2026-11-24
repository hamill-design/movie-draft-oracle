-- ============================================================
-- !!  DO NOT RUN THIS UNTIL THE NEW CODE IS LIVE ON PRODUCTION (main)  !!
--
-- CLOSE THE PROFILES TABLE (step 3 of 3 in the email lockdown)
--
-- After this runs, a signed-in user can read ONLY THEIR OWN row in public.profiles. Nobody can read another
-- person's email, marketing opt-in, ban or cooldown through the table any more. Other people's names and avatars
-- come from the functions in 20261123130000_profile_read_functions.sql.
--
-- WHY IT MUST WAIT
--   The live production site (main) shares this database and still reads other people's profiles straight from the
--   table (league members, league chat, invites, the draft room). The moment this runs, those screens would show
--   blank names and no avatars, and league member lists would lose their emails. So the order is:
--     1. run 20261123130000_profile_read_functions.sql
--     2. put the code that uses the new functions on main (and Staging)
--     3. only then run this file
--
-- WHAT KEEPS WORKING
--   - Your own profile: the Profile page, the header avatar, saving your name and photo (own row).
--   - Everything that goes through a SECURITY DEFINER function: public play, the leaderboard, player cards, drafts,
--     invites by email, league standings (views owned by postgres), notifications, the admin tools.
--   - The league_invites rule that matches an invite to YOUR email (it reads only your own row).
--   - The edge functions (they use the service key).
--
-- TO UNDO (for example if a screen turns out to still need the table):
--   CREATE POLICY "Authenticated users can view any profile" ON public.profiles FOR SELECT TO authenticated USING (true);
--
-- Safe to run twice.
-- ============================================================

-- Refuse to run if the replacement functions are not there yet.
DO $$
BEGIN
  IF to_regprocedure('public.get_league_profiles(uuid)') IS NULL
     OR to_regprocedure('public.get_draft_people(uuid)') IS NULL
     OR to_regprocedure('public.get_my_league_inviters()') IS NULL THEN
    RAISE EXCEPTION 'Run 20261123130000_profile_read_functions.sql first: the screens need those functions before the profiles table is closed.';
  END IF;
END $$;

-- The broad rule that let every signed-in user read every profile (names, emails, ban flags, everything).
DROP POLICY IF EXISTS "Authenticated users can view any profile" ON public.profiles;

-- Make sure the own-row rule is in place (it already exists on the live database).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

-- Check: only own-row read rules may remain on the table. If someone added another broad SELECT rule, say so loudly.
DO $$
DECLARE
  v_other text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO v_other
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
    AND cmd IN ('SELECT', 'ALL')
    AND policyname <> 'Users can view their own profile'
    AND coalesce(qual, '') !~ 'auth\.uid\(\)';
  IF v_other IS NOT NULL THEN
    RAISE WARNING 'These rules on public.profiles still let people read rows that are not their own: %', v_other;
  END IF;
END $$;
