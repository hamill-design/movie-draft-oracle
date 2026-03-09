-- Fix infinite recursion in draft_participants RLS (caused by policy referencing draft_participants again).
-- Prevent AI participants from casting votes (AI cannot vote; humans can still vote for AI).

-- 1) Replace draft_participants SELECT policy with one that does not self-reference.
--    Participants see: own row (user_id/guest), draft owner sees all, anyone sees when draft is public+complete.
DROP POLICY IF EXISTS "Users can view participants of drafts they're in" ON public.draft_participants;
CREATE POLICY "Users can view participants of drafts they're in"
ON public.draft_participants FOR SELECT
USING (
  user_id = auth.uid()
  OR guest_participant_id = public.current_guest_session()
  OR EXISTS (
    SELECT 1 FROM public.drafts d
    WHERE d.id = draft_participants.draft_id
    AND d.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.drafts d
    WHERE d.id = draft_participants.draft_id
    AND d.is_public = true
    AND d.is_complete = true
  )
);

-- 2) submit_draft_vote: reject when the voter is an AI participant (AI players cannot vote).
CREATE OR REPLACE FUNCTION public.submit_draft_vote(
  p_draft_id UUID,
  p_voted_participant_id UUID,
  p_voted_player_name TEXT,
  p_guest_session_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_draft public.drafts%ROWTYPE;
  v_voter_user_id UUID;
  v_voter_guest_id UUID;
  v_is_participant BOOLEAN := false;
  v_my_participant_id UUID;
  v_my_player_name TEXT;
  v_my_is_ai BOOLEAN;
  v_new_id UUID;
BEGIN
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM set_config('app.guest_session_id', p_guest_session_id::text, false);
  END IF;

  v_voter_user_id := auth.uid();
  v_voter_guest_id := p_guest_session_id;

  IF v_voter_user_id IS NULL AND v_voter_guest_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated and no guest session provided';
  END IF;

  SELECT * INTO v_draft FROM public.drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  IF v_draft.is_complete IS NOT TRUE THEN
    RAISE EXCEPTION 'Voting not allowed: draft is not complete';
  END IF;

  IF v_draft.voting_ends_at IS NOT NULL AND now() > v_draft.voting_ends_at THEN
    RAISE EXCEPTION 'Voting has closed';
  END IF;

  IF v_draft.is_multiplayer THEN
    IF v_voter_user_id IS NOT NULL THEN
      SELECT dp.id, dp.participant_name, COALESCE(dp.is_ai, false) INTO v_my_participant_id, v_my_player_name, v_my_is_ai
      FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id AND dp.user_id = v_voter_user_id
      LIMIT 1;
    ELSIF v_voter_guest_id IS NOT NULL THEN
      SELECT dp.id, dp.participant_name, COALESCE(dp.is_ai, false) INTO v_my_participant_id, v_my_player_name, v_my_is_ai
      FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id AND dp.guest_participant_id = v_voter_guest_id
      LIMIT 1;
    END IF;
    v_is_participant := (v_my_participant_id IS NOT NULL);

    IF v_is_participant AND v_my_is_ai THEN
      RAISE EXCEPTION 'AI players cannot vote';
    END IF;

    IF NOT v_is_participant AND NOT (v_draft.user_id = v_voter_user_id OR v_draft.guest_session_id = v_voter_guest_id) THEN
      IF NOT (v_draft.is_public AND v_draft.allow_public_voting) THEN
        RAISE EXCEPTION 'Voting not allowed';
      END IF;
    END IF;

    IF p_voted_participant_id IS NULL OR p_voted_player_name IS NOT NULL THEN
      RAISE EXCEPTION 'Multiplayer draft requires voted_participant_id';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.draft_participants dp WHERE dp.id = p_voted_participant_id AND dp.draft_id = p_draft_id) THEN
      RAISE EXCEPTION 'Invalid participant';
    END IF;

    IF v_is_participant AND v_my_participant_id = p_voted_participant_id THEN
      RAISE EXCEPTION 'You cannot vote for yourself';
    END IF;
  ELSE
    IF p_voted_player_name IS NULL OR p_voted_participant_id IS NOT NULL THEN
      RAISE EXCEPTION 'Local draft requires voted_player_name';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.draft_picks dp
      WHERE dp.draft_id = p_draft_id AND dp.player_name = p_voted_player_name
      LIMIT 1
    ) AND NOT (p_voted_player_name = ANY(v_draft.participants)) THEN
      RAISE EXCEPTION 'Invalid player name';
    END IF;

    IF v_draft.user_id = v_voter_user_id OR v_draft.guest_session_id = v_voter_guest_id THEN
      IF p_voted_player_name = ANY(v_draft.participants) THEN
        IF array_length(v_draft.participants, 1) = 1 AND v_draft.participants[1] = p_voted_player_name THEN
          RAISE EXCEPTION 'You cannot vote for yourself';
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_voter_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.draft_votes WHERE draft_id = p_draft_id AND voter_user_id = v_voter_user_id) THEN
      RAISE EXCEPTION 'You already voted';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.draft_votes WHERE draft_id = p_draft_id AND voter_guest_session_id = v_voter_guest_id) THEN
      RAISE EXCEPTION 'You already voted';
    END IF;
  END IF;

  INSERT INTO public.draft_votes (draft_id, voter_user_id, voter_guest_session_id, voted_participant_id, voted_player_name)
  VALUES (
    p_draft_id,
    v_voter_user_id,
    v_voter_guest_id,
    CASE WHEN v_draft.is_multiplayer THEN p_voted_participant_id ELSE NULL END,
    CASE WHEN v_draft.is_multiplayer THEN NULL ELSE p_voted_player_name END
  )
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;
