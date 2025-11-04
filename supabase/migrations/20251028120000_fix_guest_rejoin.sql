-- Fix guest rejoin behavior: re-associate existing participant by guest session or name
-- When a guest reconnects, prefer returning existing participant rather than inserting a new one.

-- Set search_path for this migration to allow PostgreSQL to resolve table types
-- (like drafts%ROWTYPE) during function creation
SET LOCAL search_path = 'public';

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
  draft_record drafts%ROWTYPE;
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


