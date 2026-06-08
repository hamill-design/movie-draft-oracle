-- ============================================================
-- 1. Fix draft invite trigger: fire on 'joined' status too
--    (participants are inserted as 'joined' when they use an
--    invite code; 'invited' is reserved for future direct-invite)
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_draft_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.status IN ('invited', 'joined')
     AND NOT NEW.is_host
     AND NEW.user_id IS NOT NULL
  THEN
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

-- ============================================================
-- 2. Add is_multiplayer column to league_drafts
--    Used for scheduled (not-yet-started) drafts so the league
--    can communicate whether the session will be local or online.
-- ============================================================

ALTER TABLE public.league_drafts
  ADD COLUMN IF NOT EXISTS is_multiplayer BOOLEAN NOT NULL DEFAULT false;
