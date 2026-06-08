-- Allow the draft owner to add in-app participants (and trigger notify_draft_invite)
-- for invited users who already have accounts. Called after createMultiplayerDraft
-- so the notification bell fires even though draft_participants rows aren't created
-- by create_multiplayer_draft_unified itself.
CREATE OR REPLACE FUNCTION public.invite_users_to_draft_by_email(
  p_draft_id UUID,
  p_emails   TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_uid      UUID;
  v_name     TEXT;
BEGIN
  -- Caller must own the draft
  IF NOT EXISTS (
    SELECT 1 FROM public.drafts WHERE id = p_draft_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the draft owner can invite participants';
  END IF;

  -- For each email that belongs to a registered user (other than the host),
  -- add a draft_participants row so notify_draft_invite fires.
  FOR v_uid, v_name IN
    SELECT p.id, COALESCE(p.name, p.email)
    FROM   public.profiles p
    WHERE  p.email = ANY(p_emails)
      AND  p.id   != auth.uid()
  LOOP
    INSERT INTO public.draft_participants
      (draft_id, user_id, participant_name, status, is_host, is_ai, joined_at)
    VALUES
      (p_draft_id, v_uid, v_name, 'invited', FALSE, FALSE, now())
    ON CONFLICT (draft_id, user_id) DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;
