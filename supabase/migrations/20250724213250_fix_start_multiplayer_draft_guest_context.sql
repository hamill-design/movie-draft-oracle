-- Fix the start_multiplayer_draft function to set guest session context first
CREATE OR REPLACE FUNCTION public.start_multiplayer_draft(p_draft_id uuid, p_guest_session_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_draft_record public.drafts;
  v_participants_list public.draft_participants[];
  v_shuffled_participants public.draft_participants[];
  v_turn_order jsonb := '[]'::jsonb;
  v_categories_count integer;
  v_participant_count integer;
  v_total_picks integer;
  v_current_direction integer := 1; -- 1 for forward, -1 for backward
  v_current_round integer := 1;
  v_pick_number integer := 1;
  v_participant_index integer;
  v_first_turn_user_id uuid;
  v_has_access boolean := false;
  i integer;
  j integer;
BEGIN
  -- Set guest session context FIRST, before any queries
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM public.set_guest_session_context(p_guest_session_id);
  END IF;

  -- Get the draft
  SELECT * INTO v_draft_record
  FROM public.drafts
  WHERE id = p_draft_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  -- Verify access permissions explicitly
  -- 1. Owner access (authenticated user)
  IF auth.uid() IS NOT NULL AND v_draft_record.user_id = auth.uid() THEN
    v_has_access := true;
  END IF;
  
  -- 2. Owner access (guest session)
  IF p_guest_session_id IS NOT NULL AND v_draft_record.guest_session_id = p_guest_session_id THEN
    v_has_access := true;
  END IF;
  
  -- 3. Host participant access
  IF EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id 
    AND dp.is_host = true
    AND (
      (auth.uid() IS NOT NULL AND dp.user_id = auth.uid()) OR
      (p_guest_session_id IS NOT NULL AND dp.guest_participant_id = p_guest_session_id)
    )
  ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'You do not have permission to start this draft';
  END IF;

  -- Check if draft has already started
  IF v_draft_record.turn_order IS NOT NULL AND jsonb_array_length(v_draft_record.turn_order) > 0 THEN
    -- Draft already started, just return current state
    RETURN QUERY SELECT 
      v_draft_record.id,
      v_draft_record.user_id,
      v_draft_record.guest_session_id,
      v_draft_record.title,
      v_draft_record.theme,
      v_draft_record.option,
      v_draft_record.categories,
      v_draft_record.participants,
      v_draft_record.is_multiplayer,
      v_draft_record.invite_code,
      v_draft_record.current_pick_number,
      v_draft_record.current_turn_user_id,
      v_draft_record.is_complete,
      v_draft_record.turn_order,
      v_draft_record.draft_order,
      v_draft_record.created_at,
      v_draft_record.updated_at;
    RETURN;
  END IF;

  -- Get participants ordered by join time
  SELECT array_agg(dp ORDER BY dp.created_at) INTO v_participants_list
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id;

  IF v_participants_list IS NULL OR array_length(v_participants_list, 1) < 2 THEN
    RAISE EXCEPTION 'Need at least 2 participants to start draft';
  END IF;

  -- Shuffle participants for randomized order
  v_shuffled_participants := v_participants_list;
  FOR i IN 1..array_length(v_shuffled_participants, 1) LOOP
    j := floor(random() * array_length(v_shuffled_participants, 1))::integer + 1;
    -- Swap elements
    IF i != j THEN
      v_shuffled_participants := array_replace(v_shuffled_participants, v_shuffled_participants[i], v_shuffled_participants[j]);
    END IF;
  END LOOP;

  -- Calculate totals
  v_categories_count := array_length(v_draft_record.categories, 1);
  v_participant_count := array_length(v_shuffled_participants, 1);
  v_total_picks := v_categories_count * v_participant_count;

  -- Generate snake draft turn order
  FOR v_current_round IN 1..v_categories_count LOOP
    IF v_current_direction = 1 THEN
      -- Forward direction
      FOR v_participant_index IN 1..v_participant_count LOOP
        v_turn_order := v_turn_order || jsonb_build_object(
          'pick_number', v_pick_number,
          'round', v_current_round,
          'user_id', COALESCE(v_shuffled_participants[v_participant_index].user_id, v_shuffled_participants[v_participant_index].guest_participant_id),
          'participant_name', v_shuffled_participants[v_participant_index].participant_name,
          'player_id', v_participant_index
        );
        v_pick_number := v_pick_number + 1;
      END LOOP;
    ELSE
      -- Backward direction (snake)
      FOR v_participant_index IN REVERSE v_participant_count..1 LOOP
        v_turn_order := v_turn_order || jsonb_build_object(
          'pick_number', v_pick_number,
          'round', v_current_round,
          'user_id', COALESCE(v_shuffled_participants[v_participant_index].user_id, v_shuffled_participants[v_participant_index].guest_participant_id),
          'participant_name', v_shuffled_participants[v_participant_index].participant_name,
          'player_id', v_participant_index
        );
        v_pick_number := v_pick_number + 1;
      END LOOP;
    END IF;
    
    -- Flip direction for next round (snake draft)
    v_current_direction := v_current_direction * -1;
  END LOOP;

  -- Get the first turn user ID
  v_first_turn_user_id := (v_turn_order->0->>'user_id')::uuid;

  -- Update the draft with turn order and first turn
  UPDATE public.drafts
  SET 
    turn_order = v_turn_order,
    current_turn_user_id = v_first_turn_user_id,
    current_pick_number = 1,
    updated_at = now()
  WHERE id = p_draft_id
  RETURNING * INTO v_draft_record;

  -- Return the updated draft
  RETURN QUERY SELECT 
    v_draft_record.id,
    v_draft_record.user_id,
    v_draft_record.guest_session_id,
    v_draft_record.title,
    v_draft_record.theme,
    v_draft_record.option,
    v_draft_record.categories,
    v_draft_record.participants,
    v_draft_record.is_multiplayer,
    v_draft_record.invite_code,
    v_draft_record.current_pick_number,
    v_draft_record.current_turn_user_id,
    v_draft_record.is_complete,
    v_draft_record.turn_order,
    v_draft_record.draft_order,
    v_draft_record.created_at,
    v_draft_record.updated_at;
END;
$function$