CREATE OR REPLACE FUNCTION public.start_multiplayer_draft_unified(p_draft_id uuid, p_participant_id uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_current_turn_participant_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone)
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
  v_first_turn_participant_id uuid;
  v_current_participant_id uuid;
  i integer;
  j integer;
BEGIN
  -- Check access permissions using unified function
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'You do not have permission to start this draft';
  END IF;

  -- Get the draft
  SELECT * INTO v_draft_record
  FROM public.drafts
  WHERE id = p_draft_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  -- Check if draft has already started
  IF v_draft_record.turn_order IS NOT NULL AND jsonb_array_length(v_draft_record.turn_order) > 0 THEN
    -- Draft already started, just return current state
    RAISE LOG 'Draft already started, returning current state';
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
      v_draft_record.current_turn_participant_id,
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

  -- Shuffle participants for randomized order using Fisher-Yates algorithm
  v_shuffled_participants := v_participants_list;
  FOR i IN REVERSE array_length(v_shuffled_participants, 1)..2 LOOP
    j := floor(random() * i)::integer + 1;
    -- Swap elements using array slice assignment
    IF i != j THEN
      DECLARE
        temp_participant public.draft_participants;
      BEGIN
        temp_participant := v_shuffled_participants[i];
        v_shuffled_participants[i] := v_shuffled_participants[j];
        v_shuffled_participants[j] := temp_participant;
      END;
    END IF;
  END LOOP;

  -- Calculate totals
  v_categories_count := array_length(v_draft_record.categories, 1);
  v_participant_count := array_length(v_shuffled_participants, 1);
  v_total_picks := v_categories_count * v_participant_count;

  RAISE LOG 'Starting draft with % participants, % categories, % total picks', 
    v_participant_count, v_categories_count, v_total_picks;

  -- Generate proper snake draft turn order
  FOR v_current_round IN 1..v_categories_count LOOP
    IF v_current_direction = 1 THEN
      -- Forward direction: 1, 2, 3, 4...
      FOR v_participant_index IN 1..v_participant_count LOOP
        v_current_participant_id := COALESCE(
          v_shuffled_participants[v_participant_index].user_id, 
          v_shuffled_participants[v_participant_index].guest_participant_id
        );
        
        v_turn_order := v_turn_order || jsonb_build_object(
          'pick_number', v_pick_number,
          'round', v_current_round,
          'participant_id', v_current_participant_id,
          'participant_name', v_shuffled_participants[v_participant_index].participant_name,
          'player_id', v_participant_index
        );
        
        RAISE LOG 'Round %, Pick %, Direction: FORWARD, Participant: % (%)', 
          v_current_round, v_pick_number, v_shuffled_participants[v_participant_index].participant_name, v_current_participant_id;
        
        v_pick_number := v_pick_number + 1;
      END LOOP;
    ELSE
      -- Backward direction (snake): 4, 3, 2, 1...
      FOR v_participant_index IN REVERSE v_participant_count..1 LOOP
        v_current_participant_id := COALESCE(
          v_shuffled_participants[v_participant_index].user_id, 
          v_shuffled_participants[v_participant_index].guest_participant_id
        );
        
        v_turn_order := v_turn_order || jsonb_build_object(
          'pick_number', v_pick_number,
          'round', v_current_round,
          'participant_id', v_current_participant_id,
          'participant_name', v_shuffled_participants[v_participant_index].participant_name,
          'player_id', v_participant_index
        );
        
        RAISE LOG 'Round %, Pick %, Direction: BACKWARD, Participant: % (%)', 
          v_current_round, v_pick_number, v_shuffled_participants[v_participant_index].participant_name, v_current_participant_id;
        
        v_pick_number := v_pick_number + 1;
      END LOOP;
    END IF;
    
    -- Flip direction for next round (snake draft)
    v_current_direction := v_current_direction * -1;
  END LOOP;

  -- Get the first turn participant ID
  v_first_turn_participant_id := (v_turn_order->0->>'participant_id')::uuid;

  RAISE LOG 'Generated turn order with % picks, first turn: %', 
    jsonb_array_length(v_turn_order), v_first_turn_participant_id;

  -- Validate turn order balance
  DECLARE
    participant_pick_counts jsonb;
  BEGIN
    SELECT jsonb_object_agg(participant_id, pick_count) INTO participant_pick_counts
    FROM (
      SELECT 
        (turn_item->>'participant_id')::uuid as participant_id,
        COUNT(*) as pick_count
      FROM jsonb_array_elements(v_turn_order) as turn_item
      GROUP BY (turn_item->>'participant_id')::uuid
    ) participant_counts;
    
    RAISE LOG 'Turn order validation - pick counts per participant: %', participant_pick_counts;
  END;

  -- Update the draft with turn order and first turn
  UPDATE public.drafts
  SET 
    turn_order = v_turn_order,
    current_turn_user_id = v_first_turn_participant_id, -- Keep for compatibility
    current_turn_participant_id = v_first_turn_participant_id,
    current_pick_number = 1,
    updated_at = now()
  WHERE id = p_draft_id
  RETURNING * INTO v_draft_record;

  RAISE LOG 'Successfully started draft: %', p_draft_id;

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
    v_draft_record.current_turn_participant_id,
    v_draft_record.is_complete,
    v_draft_record.turn_order,
    v_draft_record.draft_order,
    v_draft_record.created_at,
    v_draft_record.updated_at;
END;
$function$