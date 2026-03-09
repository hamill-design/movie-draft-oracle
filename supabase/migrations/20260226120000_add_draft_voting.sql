-- Draft Voting: allow_public_voting, voting_ends_at, draft_votes table, RPCs, RLS

-- Add columns to drafts
ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS allow_public_voting BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voting_ends_at TIMESTAMPTZ NULL;

-- Create draft_votes table
CREATE TABLE public.draft_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  voter_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  voter_guest_session_id UUID REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  voted_participant_id UUID REFERENCES public.draft_participants(id) ON DELETE CASCADE,
  voted_player_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT draft_votes_one_voter CHECK (
    (voter_user_id IS NOT NULL AND voter_guest_session_id IS NULL)
    OR (voter_user_id IS NULL AND voter_guest_session_id IS NOT NULL)
  ),
  CONSTRAINT draft_votes_one_target CHECK (
    (voted_participant_id IS NOT NULL AND voted_player_name IS NULL)
    OR (voted_participant_id IS NULL AND voted_player_name IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_draft_votes_draft_user ON public.draft_votes (draft_id, voter_user_id) WHERE voter_user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_draft_votes_draft_guest ON public.draft_votes (draft_id, voter_guest_session_id) WHERE voter_guest_session_id IS NOT NULL;
CREATE INDEX idx_draft_votes_draft_id ON public.draft_votes (draft_id);

ALTER TABLE public.draft_votes ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT draft_votes when user can see the draft and it's complete
CREATE POLICY "Select draft_votes when draft visible and complete"
ON public.draft_votes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.drafts d
    WHERE d.id = draft_votes.draft_id
    AND d.is_complete = true
    AND (
      d.is_public = true
      OR d.user_id = auth.uid()
      OR d.guest_session_id = public.current_guest_session()
      OR public.can_access_draft(d.id, COALESCE(auth.uid(), d.guest_session_id)) = true
      OR EXISTS (SELECT 1 FROM public.draft_participants dp WHERE dp.draft_id = d.id AND (dp.user_id = auth.uid() OR dp.guest_participant_id = public.current_guest_session()))
    )
  )
);

-- RLS: INSERT only via RPC (SECURITY DEFINER); no direct INSERT policy for clients to avoid bypassing validation
-- So we do not create an INSERT policy; all inserts go through submit_draft_vote RPC.

-- Allow public read of draft_participants for public complete drafts (so public voters can see participant list)
DROP POLICY IF EXISTS "Users can view participants of drafts they're in" ON public.draft_participants;
CREATE POLICY "Users can view participants of drafts they're in"
ON public.draft_participants FOR SELECT
USING (
  user_id = auth.uid()
  OR guest_participant_id = public.current_guest_session()
  OR EXISTS (
    SELECT 1 FROM public.draft_participants dp2
    WHERE dp2.draft_id = draft_participants.draft_id
    AND (dp2.user_id = auth.uid() OR dp2.guest_participant_id = public.current_guest_session())
  )
  OR EXISTS (
    SELECT 1 FROM public.drafts d
    WHERE d.id = draft_participants.draft_id
    AND d.is_public = true
    AND d.is_complete = true
  )
);

-- RPC: submit_draft_vote (SECURITY DEFINER, sets guest context, validates voting_ends_at and self-vote)
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
  v_new_id UUID;
BEGIN
  -- Set guest context if provided
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

  -- Voting allowed if: participant/owner OR (public draft and allow_public_voting)
  IF v_draft.is_multiplayer THEN
    IF v_voter_user_id IS NOT NULL THEN
      SELECT dp.id, dp.participant_name INTO v_my_participant_id, v_my_player_name
      FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id AND dp.user_id = v_voter_user_id
      LIMIT 1;
    ELSIF v_voter_guest_id IS NOT NULL THEN
      SELECT dp.id, dp.participant_name INTO v_my_participant_id, v_my_player_name
      FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id AND dp.guest_participant_id = v_voter_guest_id
      LIMIT 1;
    END IF;
    v_is_participant := (v_my_participant_id IS NOT NULL);

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

    -- Self-vote check (participants only)
    IF v_is_participant AND v_my_participant_id = p_voted_participant_id THEN
      RAISE EXCEPTION 'You cannot vote for yourself';
    END IF;
  ELSE
    -- Local draft: validate voted_player_name
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

    -- For local we don't have a clear "current player" from session unless we pass it; treat as participant only if user owns draft
    IF v_draft.user_id = v_voter_user_id OR v_draft.guest_session_id = v_voter_guest_id THEN
      -- Owner could be a "participant" in local draft; check if voted_player_name is in their participants
      IF p_voted_player_name = ANY(v_draft.participants) THEN
        -- Could be self if they have only one name; for local, participant list is the names - we don't store which name is "me"
        -- Plan says: local voter is participant if "associated with a player name". For single-owner local draft, owner is all participants.
        -- So we skip strict self-vote for local when we can't map 1:1, or we require client to pass "my name" for local. Plan says exclude in UI.
        -- For RPC we can check: if draft.participants has one element and it equals p_voted_player_name and voter is owner, reject.
        IF array_length(v_draft.participants, 1) = 1 AND v_draft.participants[1] = p_voted_player_name THEN
          RAISE EXCEPTION 'You cannot vote for yourself';
        END IF;
      END IF;
    END IF;
  END IF;

  -- Already voted?
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

-- RPC: enable_draft_voting (host only)
CREATE OR REPLACE FUNCTION public.enable_draft_voting(
  p_draft_id UUID,
  p_public BOOLEAN,
  p_duration_minutes INTEGER,
  p_guest_session_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_draft public.drafts%ROWTYPE;
  v_owner BOOLEAN := false;
BEGIN
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM set_config('app.guest_session_id', p_guest_session_id::text, false);
  END IF;

  IF p_duration_minutes NOT IN (5, 60, 1440) THEN
    RAISE EXCEPTION 'Invalid duration: use 5, 60, or 1440 minutes';
  END IF;

  SELECT * INTO v_draft FROM public.drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  IF v_draft.is_complete IS NOT TRUE THEN
    RAISE EXCEPTION 'Draft is not complete';
  END IF;

  v_owner := (v_draft.user_id = auth.uid() OR v_draft.guest_session_id = public.current_guest_session());
  IF NOT v_owner THEN
    IF EXISTS (SELECT 1 FROM public.draft_participants dp WHERE dp.draft_id = p_draft_id AND dp.is_host AND (dp.user_id = auth.uid() OR dp.guest_participant_id = public.current_guest_session())) THEN
      v_owner := true;
    END IF;
  END IF;
  IF NOT v_owner THEN
    RAISE EXCEPTION 'Only the host can enable voting';
  END IF;

  UPDATE public.drafts
  SET
    voting_ends_at = now() + (p_duration_minutes || ' minutes')::interval,
    allow_public_voting = p_public,
    is_public = CASE WHEN p_public THEN true ELSE is_public END,
    updated_at = now()
  WHERE id = p_draft_id;
END;
$$;
