-- Heartbeats must not revive presence after clear_draft_presence (last_seen_at IS NULL).
-- load_draft_unified still sets last_seen_at when a player opens/reopens the draft.

CREATE OR REPLACE FUNCTION public.heartbeat_draft_presence(
  p_draft_id uuid,
  p_participant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.draft_participants dp
  SET last_seen_at = now()
  WHERE dp.draft_id = p_draft_id
    AND COALESCE(dp.is_ai, false) = false
    AND dp.last_seen_at IS NOT NULL
    AND (
      (auth.uid() IS NOT NULL AND dp.user_id = auth.uid())
      OR dp.guest_participant_id = p_participant_id
    );
END;
$$;
