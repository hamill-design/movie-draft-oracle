-- ============================================================
-- A PLAYER WHO COMES BACK IS NO LONGER "AWAY"
--
-- The pick-clock referee marks a human "Away" after two missed turns in a row, and from then on gives them a
-- 5-second clock and makes their picks for them. The only thing that cleared the flag was the player making a pick
-- themselves, but with 5 seconds per turn a player who had just reconnected (reopened the tab, got their wifi back)
-- often could not get a pick in before the referee made it for them, so they stayed Away and kept being auto-picked.
--
-- return_to_draft() is the fix. The draft screen calls it when an Away player is back (the screen was opened, the
-- tab came back to the front, or they clicked or pressed a key). It:
--   - clears their Away flag and their missed-turn strikes,
--   - and if it is their turn right now, replaces the short Away clock with a full pick clock, so they can actually
--     make the pick. It never shortens a deadline, and it leaves the turn alone while the referee is in the middle
--     of making that pick (the pick is already on its way).
-- Someone who has really left (no screen open) never calls it, so they stay Away exactly as before.
--
-- Same access rule as get_draft_clock(): signed-in players, and guests through their participant id.
--
-- Run AFTER 20261104120000_referee_foundation.sql. Safe to run twice.
-- ============================================================

CREATE OR REPLACE FUNCTION public.return_to_draft(
  p_draft_id uuid,
  p_participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft    public.drafts%ROWTYPE;
  v_part     public.draft_participants%ROWTYPE;
  v_now      timestamptz := clock_timestamp();
  v_deadline timestamptz;
  v_extended boolean := false;
BEGIN
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Lock the draft first, as the referee functions do, then look at the player.
  SELECT * INTO v_draft FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('cleared', false, 'extended', false);
  END IF;

  SELECT dp.* INTO v_part
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id
    AND NOT COALESCE(dp.is_ai, false)
    AND (
      (auth.uid() IS NOT NULL AND dp.user_id = auth.uid())
      OR dp.guest_participant_id = p_participant_id
    )
  LIMIT 1;

  IF NOT FOUND OR NOT (COALESCE(v_part.is_away, false) OR COALESCE(v_part.consecutive_auto_picks, 0) <> 0) THEN
    RETURN jsonb_build_object('cleared', false, 'extended', false);
  END IF;

  UPDATE public.draft_participants
  SET is_away = false,
      consecutive_auto_picks = 0
  WHERE id = v_part.id;

  -- Their turn right now (on the short Away clock): give them a full turn, unless the referee already took the pick.
  IF v_draft.referee_enabled
     AND NOT COALESCE(v_draft.is_complete, false)
     AND v_draft.pick_clock_seconds IS NOT NULL
     AND v_draft.current_turn_participant_id = COALESCE(v_part.user_id, v_part.guest_participant_id, v_part.id)
     AND (v_draft.referee_claim_until IS NULL OR v_draft.referee_claim_until <= v_now) THEN
    v_deadline := v_now + make_interval(secs => v_draft.pick_clock_seconds);
    IF v_draft.current_turn_deadline_at IS NULL OR v_deadline > v_draft.current_turn_deadline_at THEN
      -- Same turn, so the deadline trigger leaves this value alone.
      UPDATE public.drafts SET current_turn_deadline_at = v_deadline WHERE id = p_draft_id;
      v_extended := true;
    END IF;
  END IF;

  RETURN jsonb_build_object('cleared', true, 'extended', v_extended);
END;
$$;

REVOKE ALL ON FUNCTION public.return_to_draft(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.return_to_draft(uuid, uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
