-- Allow host (caller) to make picks on behalf of AI when they are a guest.
-- When p_caller_participant_id is provided and p_participant_id is an AI in this draft,
-- check access using the caller's ID so guest hosts can act for AI.
CREATE OR REPLACE FUNCTION public.make_multiplayer_pick_unified(
  p_draft_id uuid, 
  p_participant_id uuid, 
  p_movie_id integer, 
  p_movie_title text, 
  p_movie_year integer, 
  p_movie_genre text, 
  p_category text, 
  p_poster_path text DEFAULT NULL::text,
  p_caller_participant_id uuid DEFAULT NULL::uuid
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
  v_draft_current_turn_id UUID;
  v_is_complete BOOLEAN := false;
  v_total_picks INTEGER;
  v_participant_count INTEGER;
  v_categories_count INTEGER;
  v_player_id INTEGER;
  v_participant_name TEXT;
  v_is_ai_pick boolean;
  v_access_check_id uuid;
BEGIN
  -- When making a pick on behalf of an AI: use caller's ID for access check
  SELECT EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.id = p_participant_id AND dp.is_ai = true
  ) INTO v_is_ai_pick;

  IF v_is_ai_pick AND p_caller_participant_id IS NOT NULL THEN
    v_access_check_id := p_caller_participant_id;
  ELSE
    v_access_check_id := p_participant_id;
  END IF;

  -- Check access permissions (caller must have access when acting for AI)
  IF NOT public.can_access_draft(p_draft_id, v_access_check_id) THEN
    RETURN QUERY SELECT false, 'You do not have access to this draft'::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;

  -- Get current draft state (include current_turn_participant_id for fallback)
  SELECT 
    d.current_pick_number, 
    d.turn_order,
    array_length(d.categories, 1),
    d.current_turn_participant_id
  INTO 
    v_current_pick_number, 
    v_turn_order,
    v_categories_count,
    v_draft_current_turn_id
  FROM public.drafts d
  WHERE d.id = p_draft_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Draft not found'::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;

  -- Verify it's the participant's turn: from turn_order for current_pick_number
  SELECT COALESCE((turn_order_item->>'participant_id')::UUID, (turn_order_item->>'user_id')::UUID)
  INTO v_next_turn_participant_id
  FROM public.drafts,
       jsonb_array_elements(turn_order) AS turn_order_item
  WHERE id = p_draft_id
    AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;

  -- Fallback: if no row (e.g. pick_number type mismatch) use draft's current_turn_participant_id
  IF v_next_turn_participant_id IS NULL THEN
    v_next_turn_participant_id := v_draft_current_turn_id;
  END IF;

  -- Allow when turn_order says it's their turn, or when draft says it's their turn (AI fallback)
  IF v_next_turn_participant_id IS DISTINCT FROM p_participant_id THEN
    IF NOT (v_is_ai_pick AND v_draft_current_turn_id IS NOT DISTINCT FROM p_participant_id) THEN
      RETURN QUERY SELECT false, 'Not your turn'::TEXT, v_current_pick_number, v_next_turn_participant_id;
      RETURN;
    END IF;
  END IF;

  -- Get player_id and participant_name based on participant type
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

  IF v_player_id IS NULL OR v_participant_name IS NULL THEN
    RETURN QUERY SELECT false, format('Participant not found: %s', p_participant_id)::TEXT, v_current_pick_number, NULL::UUID;
    RETURN;
  END IF;

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

  v_current_pick_number := v_current_pick_number + 1;

  SELECT COUNT(*) INTO v_participant_count
  FROM public.draft_participants
  WHERE draft_id = p_draft_id;

  v_total_picks := v_participant_count * v_categories_count;

  IF v_current_pick_number > v_total_picks THEN
    v_is_complete := true;
    v_next_turn_participant_id := NULL;
  ELSE
    SELECT COALESCE((turn_order_item->>'participant_id')::UUID, (turn_order_item->>'user_id')::UUID)
    INTO v_next_turn_participant_id
    FROM public.drafts,
         jsonb_array_elements(turn_order) AS turn_order_item
    WHERE id = p_draft_id
      AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;
  END IF;

  UPDATE public.drafts 
  SET 
    current_pick_number = v_current_pick_number,
    current_turn_user_id = v_next_turn_participant_id,
    current_turn_participant_id = v_next_turn_participant_id,
    is_complete = v_is_complete,
    updated_at = now()
  WHERE id = p_draft_id;

  RETURN QUERY SELECT true, 'Pick successful'::TEXT, v_current_pick_number, v_next_turn_participant_id;
END;
$function$;
