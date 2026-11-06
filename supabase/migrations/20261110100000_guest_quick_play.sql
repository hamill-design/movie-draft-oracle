-- ============================================================
-- GUESTS CAN SEE QUICK PLAY
--
-- Signed-out visitors now see the Quick Play buttons and the open games on the homepage and
-- the Play page (as a reason to sign up). To know whether to show "Quick Start" they need to
-- ask "is Quick Match available?", which used to refuse anyone who wasn't signed in.
--
-- quick_match_available() now answers for everyone and never raises:
--   - false while public play is off, or "just me" for anyone who isn't the admin (guests included)
--   - false for a suspended account
--   - otherwise true when the admin has approved at least one Quick Match entry
-- It reveals nothing but that single yes/no.
--
-- Same name and arguments as before, so existing callers and tests are unaffected.
--
-- Run AFTER 20261109100000_claim_public_name.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.quick_match_available()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_mode text;
BEGIN
  SELECT s.mode INTO v_mode FROM public.public_play_settings s WHERE s.id;
  IF COALESCE(v_mode, 'off') = 'off'
     OR (v_mode = 'admin_only' AND (v_uid IS NULL OR NOT public.is_admin())) THEN
    RETURN false;
  END IF;

  IF v_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.is_banned AND (p.banned_until IS NULL OR p.banned_until > now())
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (SELECT 1 FROM public.quick_match_pool q WHERE q.enabled);
END;
$$;

REVOKE ALL ON FUNCTION public.quick_match_available() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quick_match_available() TO anon, authenticated, service_role;
