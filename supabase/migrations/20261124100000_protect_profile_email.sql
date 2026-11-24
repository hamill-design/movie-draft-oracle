-- ============================================================
-- A PLAYER CAN NO LONGER REWRITE THE EMAIL ON THEIR OWN PROFILE
--
-- THE HOLE (confirmed against the live database on 2026-11-23):
--   public.profiles lets every signed-in player update their own row, and the permission covers every column,
--   including `email`. A player could send one direct request from their browser and set their profile email to
--   anyone else's address. A few rules read that column to decide "is this invite for you?" (for example the
--   league invite rule), so they would then treat the player as that other person.
--
-- THE FIX: one small trigger on public.profiles.
--   A direct change to `email` from a signed-in player or a visitor is refused with a plain message. Nothing the
--   site does today writes that column from the browser (checked: src/, mobile/, supabase/functions/). The only
--   thing that does write it is handle_new_user(), the sign-up function, which runs as the database owner and passes
--   straight through, as do the service role (edge functions) and you in the Supabase dashboard / SQL editor.
--   Saving the same email again is harmless.
--
-- This is the email half of a larger guard (ban, break and display-name fields) that is written on its own branch
-- and parked for now; the two do not depend on each other and can both be applied later.
--
-- HOW IT TELLS WHO IS ASKING: inside the database's own functions the current user is the function owner
-- (postgres), while a direct request from the website or app runs as "authenticated" (signed in) or "anon" (not
-- signed in). The trigger function is deliberately NOT security definer, so it sees the real caller.
--
-- Safe to run at any time: it adds one trigger, changes no data and no permissions, and the live site never writes
-- this column from the browser. Safe to run twice. Independent of every other migration.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
-- NOT security definer on purpose: current_user must stay the role that is running the statement.
AS $$
BEGIN
  -- Only direct requests from a player or a visitor are checked; the database's own functions (as their owner), edge
  -- functions (service role) and you in the dashboard (postgres) pass straight through.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A profile row someone creates for themselves may only carry their own sign-in email (or none).
    IF NEW.email IS NOT NULL
       AND lower(NEW.email) IS DISTINCT FROM lower(COALESCE(auth.jwt() ->> 'email', '')) THEN
      RAISE EXCEPTION 'The email on your profile can only be changed by MovieDrafter, not from your own account.'
        USING ERRCODE = '42501', HINT = 'Change your sign-in email from your account settings.';
    END IF;
  ELSIF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'The email on your profile can only be changed by MovieDrafter, not from your own account.'
      USING ERRCODE = '42501', HINT = 'Change your sign-in email from your account settings.';
  END IF;

  RETURN NEW;
END;
$$;

-- Not something anyone calls: it only ever runs as a trigger.
REVOKE ALL ON FUNCTION public.protect_profile_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_email ON public.profiles;
CREATE TRIGGER protect_profile_email
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_email();
