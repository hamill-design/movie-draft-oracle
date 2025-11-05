-- Phase 1: Database Schema Unification

-- Add unified participant ID column to drafts table
ALTER TABLE public.drafts 
ADD COLUMN current_turn_participant_id UUID;

-- Create unified permission function
CREATE OR REPLACE FUNCTION public.can_access_draft(p_draft_id UUID, p_participant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_draft_record public.drafts;
  v_has_access BOOLEAN := false;
BEGIN
  -- Get draft record
  SELECT * INTO v_draft_record
  FROM public.drafts
  WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if participant is the draft owner (user_id or guest_session_id)
  IF v_draft_record.user_id = p_participant_id OR v_draft_record.guest_session_id = p_participant_id THEN
    RETURN true;
  END IF;
  
  -- Check if participant is in draft_participants (user_id or guest_participant_id)
  IF EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id 
    AND (dp.user_id = p_participant_id OR dp.guest_participant_id = p_participant_id)
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Update start_multiplayer_draft function to use unified approach
CREATE OR REPLACE FUNCTION public.start_multiplayer_draft_unified(p_draft_id uuid, p_participant_id uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_current_turn_participant_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
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

  -- Generate snake draft turn order using unified participant IDs
  FOR v_current_round IN 1..v_categories_count LOOP
    IF v_current_direction = 1 THEN
      -- Forward direction
      FOR v_participant_index IN 1..v_participant_count LOOP
        v_turn_order := v_turn_order || jsonb_build_object(
          'pick_number', v_pick_number,
          'round', v_current_round,
          'participant_id', COALESCE(v_shuffled_participants[v_participant_index].user_id, v_shuffled_participants[v_participant_index].guest_participant_id),
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
          'participant_id', COALESCE(v_shuffled_participants[v_participant_index].user_id, v_shuffled_participants[v_participant_index].guest_participant_id),
          'participant_name', v_shuffled_participants[v_participant_index].participant_name,
          'player_id', v_participant_index
        );
        v_pick_number := v_pick_number + 1;
      END LOOP;
    END IF;
    
    -- Flip direction for next round (snake draft)
    v_current_direction := v_current_direction * -1;
  END LOOP;

  -- Get the first turn participant ID
  v_first_turn_participant_id := (v_turn_order->0->>'participant_id')::uuid;

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
$$;

-- Update make_multiplayer_pick function to use unified approach
CREATE OR REPLACE FUNCTION public.make_multiplayer_pick_unified(p_draft_id uuid, p_participant_id uuid, p_movie_id integer, p_movie_title text, p_movie_year integer, p_movie_genre text, p_category text, p_poster_path text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text, new_pick_number integer, next_turn_participant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_current_pick_number INTEGER;
  v_turn_order JSONB;
  v_next_turn_participant_id UUID;
  v_is_complete BOOLEAN := false;
  v_total_picks INTEGER;
  v_participant_count INTEGER;
  v_categories_count INTEGER;
  v_player_id INTEGER;
  v_participant_name TEXT;
BEGIN
  -- Check access permissions
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RETURN QUERY SELECT false, 'You do not have access to this draft'::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;

  -- Get current draft state
  SELECT 
    current_pick_number, 
    turn_order,
    array_length(categories, 1)
  INTO 
    v_current_pick_number, 
    v_turn_order,
    v_categories_count
  FROM public.drafts 
  WHERE id = p_draft_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Draft not found'::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;

  -- Verify it's the participant's turn
  SELECT (turn_order_item->>'participant_id')::UUID
  INTO v_next_turn_participant_id
  FROM public.drafts,
       jsonb_array_elements(turn_order) AS turn_order_item
  WHERE id = p_draft_id
    AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;

  IF v_next_turn_participant_id != p_participant_id THEN
    RETURN QUERY SELECT false, 'Not your turn'::TEXT, v_current_pick_number, v_next_turn_participant_id;
    RETURN;
  END IF;

  -- Get player_id and participant_name based on participant type
  WITH numbered_participants AS (
    SELECT 
      COALESCE(user_id, guest_participant_id) as participant_id,
      participant_name,
      row_number() OVER (ORDER BY created_at ASC) as player_id
    FROM public.draft_participants
    WHERE draft_id = p_draft_id
  )
  SELECT player_id, participant_name INTO v_player_id, v_participant_name
  FROM numbered_participants
  WHERE participant_id = p_participant_id;

  -- Insert the pick
  INSERT INTO public.draft_picks (
    draft_id,
    player_id,
    player_name,
    movie_id,
    movie_title,
    movie_year,
    movie_genre,
    category,
    pick_order,
    poster_path
  ) VALUES (
    p_draft_id,
    v_player_id,
    v_participant_name,
    p_movie_id,
    p_movie_title,
    p_movie_year,
    p_movie_genre,
    p_category,
    v_current_pick_number,
    p_poster_path
  );

  -- Calculate next turn
  v_current_pick_number := v_current_pick_number + 1;
  
  -- Get participant count to determine total picks
  SELECT COUNT(*) INTO v_participant_count
  FROM public.draft_participants
  WHERE draft_id = p_draft_id;
  
  v_total_picks := v_participant_count * v_categories_count;

  -- Check if draft is complete
  IF v_current_pick_number > v_total_picks THEN
    v_is_complete := true;
    v_next_turn_participant_id := NULL;
  ELSE
    -- Find next turn participant
    SELECT (turn_order_item->>'participant_id')::UUID
    INTO v_next_turn_participant_id
    FROM public.drafts,
         jsonb_array_elements(turn_order) AS turn_order_item
    WHERE id = p_draft_id
      AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;
  END IF;

  -- Update draft state
  UPDATE public.drafts 
  SET 
    current_pick_number = v_current_pick_number,
    current_turn_user_id = v_next_turn_participant_id, -- Keep for compatibility
    current_turn_participant_id = v_next_turn_participant_id,
    is_complete = v_is_complete,
    updated_at = now()
  WHERE id = p_draft_id;

  -- Return success
  RETURN QUERY SELECT true, 'Pick successful'::TEXT, v_current_pick_number, v_next_turn_participant_id;
END;
$$;

-- Update load_draft_with_guest_access to use unified approach
CREATE OR REPLACE FUNCTION public.load_draft_unified(p_draft_id uuid, p_participant_id uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_current_turn_participant_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone, participants_data jsonb, picks_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  draft_record public.drafts;
  v_participants_json jsonb;
  v_picks_json jsonb;
BEGIN
  -- Check access permissions
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'You do not have access to this draft';
  END IF;
  
  -- Find the draft
  SELECT * INTO draft_record 
  FROM public.drafts 
  WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  
  -- Fetch participants as JSON
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', dp.id,
      'draft_id', dp.draft_id,
      'user_id', dp.user_id,
      'guest_participant_id', dp.guest_participant_id,
      'participant_id', COALESCE(dp.user_id, dp.guest_participant_id),
      'participant_name', dp.participant_name,
      'status', dp.status,
      'is_host', dp.is_host,
      'joined_at', dp.joined_at,
      'created_at', dp.created_at
    )
  ), '[]'::jsonb) INTO v_participants_json
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id;
  
  -- Fetch picks as JSON
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', dpi.id,
      'draft_id', dpi.draft_id,
      'player_id', dpi.player_id,
      'player_name', dpi.player_name,
      'movie_id', dpi.movie_id,
      'movie_title', dpi.movie_title,
      'movie_year', dpi.movie_year,
      'movie_genre', dpi.movie_genre,
      'category', dpi.category,
      'pick_order', dpi.pick_order,
      'poster_path', dpi.poster_path,
      'created_at', dpi.created_at,
      'movie_budget', dpi.movie_budget,
      'movie_revenue', dpi.movie_revenue,
      'rt_critics_score', dpi.rt_critics_score,
      'rt_audience_score', dpi.rt_audience_score,
      'imdb_rating', dpi.imdb_rating,
      'metacritic_score', dpi.metacritic_score,
      'oscar_status', dpi.oscar_status,
      'calculated_score', dpi.calculated_score,
      'scoring_data_complete', dpi.scoring_data_complete
    ) ORDER BY dpi.pick_order
  ), '[]'::jsonb) INTO v_picks_json
  FROM public.draft_picks dpi
  WHERE dpi.draft_id = p_draft_id;
  
  -- Return the complete draft record with participants and picks
  RETURN QUERY SELECT 
    draft_record.id,
    draft_record.user_id,
    draft_record.guest_session_id,
    draft_record.title,
    draft_record.theme,
    draft_record.option,
    draft_record.categories,
    draft_record.participants,
    draft_record.is_multiplayer,
    draft_record.invite_code,
    draft_record.current_pick_number,
    draft_record.current_turn_user_id,
    draft_record.current_turn_participant_id,
    draft_record.is_complete,
    draft_record.turn_order,
    draft_record.draft_order,
    draft_record.created_at,
    draft_record.updated_at,
    v_participants_json,
    v_picks_json;
END;
$$;