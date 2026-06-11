-- v2: point "Upcoming draft" notifications at the league's Schedule tab.
--
-- Previously linked to `/league/<id>` (the Standings tab by default), so
-- clicking the notification looked like it did nothing useful — it just
-- opened the regular league page with no obvious sign of the scheduled
-- draft. Now links to `/league/<id>?tab=schedule`, where the upcoming
-- draft card (and its "Open Draft Room" / "Details" actions) lives.
-- LeaguePage now reads `?tab=` to pick the initial tab (see LeaguePage.tsx).
CREATE OR REPLACE FUNCTION public.notify_upcoming_draft()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member     RECORD;
  v_league_name TEXT;
BEGIN
  -- When scheduled_at is cleared, remove existing notifications
  IF NEW.scheduled_at IS NULL THEN
    DELETE FROM public.notifications
    WHERE reference_id = NEW.id AND type = 'upcoming_draft';
    RETURN NEW;
  END IF;

  -- Only act when scheduled_at is in the future
  IF NEW.scheduled_at <= now() THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only re-notify when the time actually changed
  IF TG_OP = 'UPDATE' AND OLD.scheduled_at IS NOT DISTINCT FROM NEW.scheduled_at THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_league_name FROM public.leagues WHERE id = NEW.league_id;

  -- Remove stale notifications for this entry (e.g. rescheduled)
  DELETE FROM public.notifications
  WHERE reference_id = NEW.id AND type = 'upcoming_draft';

  FOR v_member IN
    SELECT user_id FROM public.league_members WHERE league_id = NEW.league_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, reference_id, metadata)
    VALUES (
      v_member.user_id,
      'upcoming_draft',
      'Upcoming draft in ' || COALESCE(v_league_name, 'your league'),
      'Scheduled for ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'Mon DD, YYYY'),
      '/league/' || NEW.league_id::TEXT || '?tab=schedule',
      NEW.id,
      jsonb_build_object('scheduled_at', NEW.scheduled_at)
    );
  END LOOP;

  RETURN NEW;
END;
$$;
