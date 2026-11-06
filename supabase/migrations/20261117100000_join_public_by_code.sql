-- ============================================================
-- Join a public table with its code
--
-- Every table has an 8-character code (the same one private drafts show as "Join Code"), and the homepage's
-- "Join a Draft" box takes it. Until now that box used the private-draft join, which only checks that the draft
-- exists and has not started. For a public table that skipped everything the table join enforces: seats
-- (a full table took one more person), blocks between players, the hourly join limits, the public display name,
-- the seat held for an invited email, and the account requirement.
--
-- Now a code that belongs to a public table goes through join_public_table (the same door the Play page and the
-- invite link use), after giving the player a public name from their settings if they don't have one yet (the
-- same step the Play page runs). Signed-out visitors are asked to sign in. Private drafts are untouched: this is
-- the live function (20260923120000) with one added step.
--
-- Run AFTER 20261116100000_host_controls.sql.
-- ============================================================

-- Join by code: attach invited emails to their row, and lock new joiners out once started.
CREATE OR REPLACE FUNCTION public.join_draft_by_invite_code_guest(
  invite_code_param text,
  participant_name_param text,
  p_guest_session_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  participant_id uuid,
  draft_id uuid,
  draft_title text,
  draft_theme text,
  draft_option text,
  draft_categories text[],
  draft_participants text[],
  draft_is_multiplayer boolean,
  draft_invite_code text,
  draft_current_pick_number integer,
  draft_current_turn_user_id uuid,
  draft_is_complete boolean,
  draft_turn_order jsonb,
  draft_created_at timestamp with time zone,
  draft_updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  draft_record public.drafts%ROWTYPE;
  existing_participant_id UUID;
  new_participant_id UUID;
  final_participant_name TEXT;
  counter INTEGER := 0;
BEGIN
  -- Validate inputs
  IF invite_code_param IS NULL OR length(trim(invite_code_param)) != 8 OR NOT (trim(invite_code_param) ~ '^[A-Z0-9]{8}$') THEN
    RAISE EXCEPTION 'Invalid invite code format';
  END IF;

  IF participant_name_param IS NULL OR trim(participant_name_param) = '' OR length(trim(participant_name_param)) > 50 THEN
    RAISE EXCEPTION 'Participant name must be between 1 and 50 characters';
  END IF;

  -- Attach guest session to context if provided
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM public.set_guest_session_context(p_guest_session_id);
  END IF;

  -- Find draft
  SELECT * INTO draft_record
  FROM public.drafts
  WHERE invite_code = trim(invite_code_param) AND is_multiplayer = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF draft_record.is_complete THEN
    RAISE EXCEPTION 'Draft is already complete';
  END IF;

  -- A public table's code is another way to find the table: it follows the table rules. That means an account
  -- (never a guest), a public display name, a free seat, nobody at the table who has blocked this player, the
  -- join limits, and the seat held for an invited email. join_public_table checks all of that and raises a
  -- plain-English reason, so the code can never get anyone in who the table would have turned away.
  IF draft_record.lobby_visibility = 'public' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Sign in to join a public table';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.public_name IS NOT NULL) THEN
      PERFORM public.claim_public_name();
    END IF;
    PERFORM public.join_public_table(draft_record.id);

    SELECT dp.id INTO new_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.user_id = auth.uid();

    RETURN QUERY SELECT
      new_participant_id,
      draft_record.id,
      draft_record.title,
      draft_record.theme,
      draft_record.option,
      draft_record.categories,
      draft_record.participants,
      draft_record.is_multiplayer,
      draft_record.invite_code,
      draft_record.current_pick_number,
      draft_record.current_turn_user_id,
      draft_record.is_complete,
      draft_record.turn_order,
      draft_record.created_at,
      draft_record.updated_at;
    RETURN;
  END IF;

  -- 0) An invited email holder who enters the code must attach to their invited
  --    row (never get a second one).
  IF auth.uid() IS NOT NULL AND public._is_current_user_invited(draft_record.id) THEN
    PERFORM public.claim_draft_invite(draft_record.id);
  END IF;

  -- 1) If authenticated user already a participant, return that
  IF auth.uid() IS NOT NULL THEN
    SELECT dp.id INTO existing_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.user_id = auth.uid();

    IF existing_participant_id IS NOT NULL THEN
      RETURN QUERY SELECT 
        existing_participant_id,
        draft_record.id,
        draft_record.title,
        draft_record.theme,
        draft_record.option,
        draft_record.categories,
        draft_record.participants,
        draft_record.is_multiplayer,
        draft_record.invite_code,
        draft_record.current_pick_number,
        draft_record.current_turn_user_id,
        draft_record.is_complete,
        draft_record.turn_order,
        draft_record.created_at,
        draft_record.updated_at;
      RETURN;
    END IF;
  END IF;

  -- 2) If guest session matches an existing participant, return that
  IF p_guest_session_id IS NOT NULL THEN
    SELECT dp.id INTO existing_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.guest_participant_id = p_guest_session_id;

    IF existing_participant_id IS NOT NULL THEN
      RETURN QUERY SELECT 
        existing_participant_id,
        draft_record.id,
        draft_record.title,
        draft_record.theme,
        draft_record.option,
        draft_record.categories,
        draft_record.participants,
        draft_record.is_multiplayer,
        draft_record.invite_code,
        draft_record.current_pick_number,
        draft_record.current_turn_user_id,
        draft_record.is_complete,
        draft_record.turn_order,
        draft_record.created_at,
        draft_record.updated_at;
      RETURN;
    END IF;
  END IF;

  -- 3) Name-based re-association for guests: if a guest with this name exists, rebind to new session
  IF p_guest_session_id IS NOT NULL THEN
    SELECT dp.id INTO existing_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id
      AND dp.user_id IS NULL
      AND dp.participant_name = trim(participant_name_param)
    LIMIT 1;

    IF existing_participant_id IS NOT NULL THEN
      UPDATE public.draft_participants
      SET guest_participant_id = p_guest_session_id,
          status = 'joined',
          joined_at = NOW()
      WHERE id = existing_participant_id
      RETURNING id INTO existing_participant_id;

      RETURN QUERY SELECT 
        existing_participant_id,
        draft_record.id,
        draft_record.title,
        draft_record.theme,
        draft_record.option,
        draft_record.categories,
        draft_record.participants,
        draft_record.is_multiplayer,
        draft_record.invite_code,
        draft_record.current_pick_number,
        draft_record.current_turn_user_id,
        draft_record.is_complete,
        draft_record.turn_order,
        draft_record.created_at,
        draft_record.updated_at;
      RETURN;
    END IF;
  END IF;

  -- Turn order is fixed at start, so only existing participants / invitees
  -- (handled above) may come back in after that.
  IF draft_record.turn_order IS NOT NULL AND jsonb_array_length(draft_record.turn_order) > 0 THEN
    RAISE EXCEPTION 'Draft already started';
  END IF;

  -- 4) Otherwise, insert a new participant with a de-duplicated name
  final_participant_name := trim(participant_name_param);
  WHILE EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.participant_name = final_participant_name
  ) LOOP
    counter := counter + 1;
    final_participant_name := trim(participant_name_param) || ' (' || counter || ')';
  END LOOP;

  INSERT INTO public.draft_participants (
    draft_id,
    user_id,
    guest_participant_id,
    participant_name,
    status,
    joined_at
  ) VALUES (
    draft_record.id,
    auth.uid(),
    p_guest_session_id,
    final_participant_name,
    'joined',
    NOW()
  ) RETURNING id INTO new_participant_id;

  RETURN QUERY SELECT 
    new_participant_id,
    draft_record.id,
    draft_record.title,
    draft_record.theme,
    draft_record.option,
    draft_record.categories,
    draft_record.participants,
    draft_record.is_multiplayer,
    draft_record.invite_code,
    draft_record.current_pick_number,
    draft_record.current_turn_user_id,
    draft_record.is_complete,
    draft_record.turn_order,
    draft_record.created_at,
    draft_record.updated_at;
END;
$function$;
