-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('draft_invite', 'league_invite', 'upcoming_draft')),
  title        TEXT        NOT NULL,
  body         TEXT,
  link         TEXT,
  reference_id UUID,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  is_read      BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Trigger: draft_participants INSERT → draft_invite notification ──────────
CREATE OR REPLACE FUNCTION public.notify_draft_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.status = 'invited' AND NOT NEW.is_host AND NEW.user_id IS NOT NULL THEN
    SELECT title INTO v_title FROM public.drafts WHERE id = NEW.draft_id;

    INSERT INTO public.notifications (user_id, type, title, body, link, reference_id)
    VALUES (
      NEW.user_id,
      'draft_invite',
      'You''ve been invited to a draft',
      COALESCE(v_title, 'A new draft'),
      '/join-draft/' || NEW.draft_id::TEXT,
      NEW.draft_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_draft_invite
  AFTER INSERT ON public.draft_participants
  FOR EACH ROW EXECUTE FUNCTION public.notify_draft_invite();

-- ── Trigger: league_invites INSERT → league_invite notification ─────────────
CREATE OR REPLACE FUNCTION public.notify_league_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league_name TEXT;
  v_inviter_name TEXT;
BEGIN
  IF NEW.invited_user_id IS NOT NULL THEN
    SELECT name INTO v_league_name FROM public.leagues WHERE id = NEW.league_id;
    SELECT name INTO v_inviter_name FROM public.profiles WHERE id = NEW.invited_by;

    INSERT INTO public.notifications (user_id, type, title, body, link, reference_id)
    VALUES (
      NEW.invited_user_id,
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

CREATE TRIGGER trg_notify_league_invite
  AFTER INSERT ON public.league_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_league_invite();

-- ── Trigger: league_drafts scheduled_at set/changed → upcoming_draft notification ──
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
      '/league/' || NEW.league_id::TEXT,
      NEW.id,
      jsonb_build_object('scheduled_at', NEW.scheduled_at)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_upcoming_draft
  AFTER INSERT OR UPDATE OF scheduled_at ON public.league_drafts
  FOR EACH ROW EXECUTE FUNCTION public.notify_upcoming_draft();
