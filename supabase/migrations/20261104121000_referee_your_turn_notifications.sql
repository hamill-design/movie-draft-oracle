-- ============================================================
-- "IT'S YOUR TURN" NOTIFICATIONS  (Phase 1 of docs/public-matchmaking-plan.md)
--
-- Slow drafts (long pick clock) only work if people are told when it is
-- their turn. This adds a 'your_turn' notification, created by a trigger
-- when the turn passes to a human on a referee-enabled draft whose pick
-- clock is an hour or longer. (Live drafts with short clocks skip it: the
-- player is already looking at the screen.)
--
-- Run AFTER 20261104120000_referee_foundation.sql.
--
-- Safety: a notification problem can never block a pick. The trigger
-- swallows its own errors.
-- ============================================================

-- Allow the new type. Drop whatever CHECK currently restricts notifications.type
-- (found by what it says, not by name), then add the extended one.
-- NOT VALID: only new rows are checked, so old rows can never block this migration.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%draft_invite%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('draft_invite', 'league_invite', 'upcoming_draft', 'your_turn')) NOT VALID;

CREATE OR REPLACE FUNCTION public.notify_your_turn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NEW.referee_enabled
       AND NOT COALESCE(NEW.is_complete, false)
       AND NEW.current_turn_participant_id IS NOT NULL
       AND COALESCE(NEW.pick_clock_seconds, 0) >= 3600
       AND EXISTS (
         SELECT 1 FROM public.draft_participants dp
         WHERE dp.draft_id = NEW.id
           AND dp.user_id = NEW.current_turn_participant_id
           AND NOT COALESCE(dp.is_ai, false)
       )
    THEN
      -- Don't pile up: a newer "your turn" replaces any unread older one for this draft.
      DELETE FROM public.notifications
      WHERE user_id = NEW.current_turn_participant_id
        AND type = 'your_turn'
        AND reference_id = NEW.id
        AND NOT is_read;

      INSERT INTO public.notifications (user_id, type, title, body, link, reference_id, metadata)
      VALUES (
        NEW.current_turn_participant_id,
        'your_turn',
        'It''s your turn to pick',
        COALESCE(NEW.title, 'Your draft'),
        '/draft/' || NEW.id::text,
        NEW.id,
        jsonb_build_object(
          'deadline_at', NEW.current_turn_deadline_at,
          'pick_number', NEW.current_pick_number
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_your_turn failed (pick unaffected): %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_your_turn ON public.drafts;
CREATE TRIGGER trg_notify_your_turn
  AFTER UPDATE ON public.drafts
  FOR EACH ROW
  WHEN (
    NEW.referee_enabled
    AND (
      OLD.current_pick_number IS DISTINCT FROM NEW.current_pick_number
      OR OLD.current_turn_participant_id IS DISTINCT FROM NEW.current_turn_participant_id
    )
  )
  EXECUTE FUNCTION public.notify_your_turn();
