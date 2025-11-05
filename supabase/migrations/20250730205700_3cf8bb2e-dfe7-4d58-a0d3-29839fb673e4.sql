-- Fix the final remaining database functions with search_path security

-- Verify drafts table exists before creating functions that reference it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' AND table_name = 'drafts') THEN
    RAISE EXCEPTION 'Table public.drafts does not exist. Migration 20250701202547 must run first.';
  END IF;
END $$;

-- Fix start_multiplayer_draft function
CREATE OR REPLACE FUNCTION public.start_multiplayer_draft(p_draft_id uuid, p_guest_session_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_draft_record public.drafts%ROWTYPE;
  v_participants_list public.draft_participants[];
  v_shuffled_participants public.draft_participants[];
  v_turn_order jsonb := '[]'::jsonb;
  v_categories_count integer;
  v_participant_count integer;
  v_total_picks integer;
  v_current_direction integer := 1;
  v_current_round integer := 1;
  v_pick_number integer := 1;
  v_participant_index integer;
  v_first_turn_user_id uuid;
  v_has_access boolean := false;
  i integer;
  j integer;
BEGIN
  -- Set guest session context FIRST
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM public.set_guest_session_context(p_guest_session_id);
  END IF;

  -- Get the draft (bypass RLS for permission checking)
  PERFORM set_config('row_security', 'off', true);
  
  SELECT * INTO v_draft_record
  FROM public.drafts
  WHERE id = p_draft_id;
  
  PERFORM set_config('row_security', 'on', true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  -- Check permissions
  IF auth.uid() IS NOT NULL AND v_draft_record.user_id = auth.uid() THEN
    v_has_access := true;
  END IF;
  
  IF p_guest_session_id IS NOT NULL AND v_draft_record.guest_session_id = p_guest_session_id THEN
    v_has_access := true;
  END IF;
  
  PERFORM set_config('row_security', 'off', true);
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
  PERFORM set_config('row_security', 'on', true);

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Check if draft has already started
  IF v_draft_record.turn_order IS NOT NULL AND jsonb_array_length(v_draft_record.turn_order) > 0 THEN
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

  -- Get participants (bypass RLS)
  PERFORM set_config('row_security', 'off', true);
  SELECT array_agg(dp ORDER BY dp.created_at) INTO v_participants_list
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id;
  PERFORM set_config('row_security', 'on', true);

  IF v_participants_list IS NULL OR array_length(v_participants_list, 1) < 2 THEN
    RAISE EXCEPTION 'Need at least 2 participants to start draft';
  END IF;

  -- Shuffle participants using Fisher-Yates algorithm
  v_shuffled_participants := v_participants_list;
  FOR i IN REVERSE array_length(v_shuffled_participants, 1)..2 LOOP
    j := floor(random() * i)::integer + 1;
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

  -- Generate snake draft turn order
  FOR v_current_round IN 1..v_categories_count LOOP
    IF v_current_direction = 1 THEN
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
    
    v_current_direction := v_current_direction * -1;
  END LOOP;

  -- Get the first turn user ID
  v_first_turn_user_id := (v_turn_order->0->>'user_id')::uuid;

  -- Update the draft
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
$function$;

-- Fix can_access_draft function
CREATE OR REPLACE FUNCTION public.can_access_draft(p_draft_id uuid, p_participant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_draft_record public.drafts%ROWTYPE;
BEGIN
  -- Get draft record
  SELECT * INTO v_draft_record
  FROM public.drafts
  WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if participant is the draft owner
  IF v_draft_record.user_id = p_participant_id OR v_draft_record.guest_session_id = p_participant_id THEN
    RETURN true;
  END IF;
  
  -- Check if participant is in draft_participants
  IF EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id 
    AND (dp.user_id = p_participant_id OR dp.guest_participant_id = p_participant_id)
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$function$;

-- Fix start_multiplayer_draft_unified function
CREATE OR REPLACE FUNCTION public.start_multiplayer_draft_unified(p_draft_id uuid, p_participant_id uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_current_turn_participant_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_draft_record public.drafts%ROWTYPE;
  v_participants_list public.draft_participants[];
  v_shuffled_participants public.draft_participants[];
  v_turn_order jsonb := '[]'::jsonb;
  v_categories_count integer;
  v_participant_count integer;
  v_current_direction integer := 1;
  v_current_round integer := 1;
  v_pick_number integer := 1;
  v_participant_index integer;
  v_first_turn_participant_id uuid;
  v_current_participant_id uuid;
  i integer;
  j integer;
BEGIN
  -- Check access permissions
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'Access denied';
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

  -- Get participants
  SELECT array_agg(dp ORDER BY dp.created_at) INTO v_participants_list
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id;

  IF v_participants_list IS NULL OR array_length(v_participants_list, 1) < 2 THEN
    RAISE EXCEPTION 'Need at least 2 participants to start draft';
  END IF;

  -- Shuffle participants
  v_shuffled_participants := v_participants_list;
  FOR i IN REVERSE array_length(v_shuffled_participants, 1)..2 LOOP
    j := floor(random() * i)::integer + 1;
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

  -- Generate snake draft turn order
  FOR v_current_round IN 1..v_categories_count LOOP
    IF v_current_direction = 1 THEN
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
        
        v_pick_number := v_pick_number + 1;
      END LOOP;
    ELSE
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
        
        v_pick_number := v_pick_number + 1;
      END LOOP;
    END IF;
    
    v_current_direction := v_current_direction * -1;
  END LOOP;

  -- Get the first turn participant ID
  v_first_turn_participant_id := (v_turn_order->0->>'participant_id')::uuid;

  -- Update the draft
  UPDATE public.drafts
  SET 
    turn_order = v_turn_order,
    current_turn_user_id = v_first_turn_participant_id,
    current_turn_participant_id = v_first_turn_participant_id,
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
    v_draft_record.current_turn_participant_id,
    v_draft_record.is_complete,
    v_draft_record.turn_order,
    v_draft_record.draft_order,
    v_draft_record.created_at,
    v_draft_record.updated_at;
END;
$function$;