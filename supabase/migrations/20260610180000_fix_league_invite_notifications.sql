-- ============================================================
-- LEAGUES: Fix missing in-app notifications for email invites
--
-- Bug: send-league-invitations never set invited_user_id, even
-- when the invited email belonged to a registered profile. The
-- trg_notify_league_invite trigger only fires when
-- NEW.invited_user_id IS NOT NULL, so:
--   1. No bell notification was ever created for league invites
--      (confirmed: zero rows of type 'league_invite' exist).
--   2. The invite never showed up in the recipient's "Pending
--      Invites" list on their Profile page (that query filters
--      on invited_user_id = auth.uid()).
--
-- The edge function (send-league-invitations) is updated
-- separately to resolve invited_email -> profiles.id and set
-- invited_user_id on insert. This migration adds a DB-level
-- fallback (resolve by email if invited_user_id is still null)
-- and retroactively fixes the one currently-valid pending
-- invite that was just sent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_league_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league_name TEXT;
  v_inviter_name TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := NEW.invited_user_id;

  -- Fallback: resolve by email if invited_user_id wasn't set
  -- (e.g. invite created before invited_user_id resolution existed).
  IF v_user_id IS NULL AND NEW.invited_email IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE lower(email) = lower(NEW.invited_email)
    LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_league_name FROM public.leagues WHERE id = NEW.league_id;
    SELECT name INTO v_inviter_name FROM public.profiles WHERE id = NEW.invited_by;

    INSERT INTO public.notifications (user_id, type, title, body, link, reference_id)
    VALUES (
      v_user_id,
      'league_invite',
      'You''ve been invited to a league',
      COALESCE(v_inviter_name, 'Someone') || ' invited you to ' || COALESCE(v_league_name, 'a league'),
      '/league/' || NEW.league_id::TEXT,
      NEW.league_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ── Retroactive fix: backfill invited_user_id + create the missing
--    notification for the one currently-valid pending email invite
--    (treehuggerhamill1@gmail.com -> "Picnic At Prospect Park",
--     league "The Master"). Expired pending invites are left as-is.
DO $$
DECLARE
  v_invite public.league_invites;
  v_user_id UUID;
  v_league_name TEXT;
  v_inviter_name TEXT;
BEGIN
  FOR v_invite IN
    SELECT *
    FROM public.league_invites
    WHERE status = 'pending'
      AND invited_user_id IS NULL
      AND invited_email IS NOT NULL
      AND expires_at > now()
  LOOP
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE lower(email) = lower(v_invite.invited_email)
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      UPDATE public.league_invites
      SET invited_user_id = v_user_id
      WHERE id = v_invite.id;

      SELECT name INTO v_league_name FROM public.leagues WHERE id = v_invite.league_id;
      SELECT name INTO v_inviter_name FROM public.profiles WHERE id = v_invite.invited_by;

      INSERT INTO public.notifications (user_id, type, title, body, link, reference_id)
      VALUES (
        v_user_id,
        'league_invite',
        'You''ve been invited to a league',
        COALESCE(v_inviter_name, 'Someone') || ' invited you to ' || COALESCE(v_league_name, 'a league'),
        '/league/' || v_invite.league_id::TEXT,
        v_invite.league_id
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
