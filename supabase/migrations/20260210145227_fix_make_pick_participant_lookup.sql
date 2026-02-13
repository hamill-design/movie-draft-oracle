-- Fix make_multiplayer_pick_unified to handle participant lookup failures
-- This ensures that if participant_id doesn't match, we get a clear error
CREATE OR REPLACE FUNCTION public.make_multiplayer_pick_unified(
  p_draft_id uuid, 
  p_participant_id uuid, 
  p_movie_id integer, 
  p_movie_title text, 
  p_movie_year integer, 
  p_movie_genre text, 
  p_category text, 
  p_poster_path text DEFAULT NULL::text
)
 RETURNS TABLE(success boolean, message text, new_pick_number integer, next_turn_participant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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

  -- Verify it's the participant's turn (check both new and legacy field names)
  SELECT COALESCE((turn_order_item->>'participant_id')::UUID, (turn_order_item->>'user_id')::UUID)
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
  -- For AI participants, use row id; otherwise use user_id or guest_participant_id
  WITH numbered_participants AS (
    SELECT 
      COALESCE(user_id, guest_participant_id, CASE WHEN is_ai THEN id ELSE NULL END) as participant_id,
      participant_name,
      row_number() OVER (ORDER BY created_at ASC) as player_id
    FROM public.draft_participants
    WHERE draft_id = p_draft_id
  )
  SELECT player_id, participant_name INTO v_player_id, v_participant_name
  FROM numbered_participants
  WHERE participant_id = p_participant_id;

  -- Check if participant was found
  IF v_player_id IS NULL OR v_participant_name IS NULL THEN
    RETURN QUERY SELECT false, format('Participant not found: %s', p_participant_id)::TEXT, v_current_pick_number, NULL::UUID;
    RETURN;
  END IF;

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
    -- Find next turn participant (check both new and legacy field names)
    SELECT COALESCE((turn_order_item->>'participant_id')::UUID, (turn_order_item->>'user_id')::UUID)
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
$function$;
