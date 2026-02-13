-- Fix 1.1: Make player_id deterministic (tie-break by id when created_at equal)
-- Fix 1.2: Return participants in same order as player_id (created_at ASC NULLS LAST, id ASC)

-- 1.1 make_multiplayer_pick_unified: add NULLS LAST, id ASC to row_number() ORDER BY
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

  -- Get player_id and participant_name: deterministic order (matches load_draft_unified participants order)
  WITH numbered_participants AS (
    SELECT 
      COALESCE(user_id, guest_participant_id, CASE WHEN is_ai THEN id ELSE NULL END) as participant_id,
      participant_name,
      row_number() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) as player_id
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

-- 1.2 load_draft_unified: return participants in same order as player_id (created_at ASC NULLS LAST, id ASC)
CREATE OR REPLACE FUNCTION public.load_draft_unified(p_draft_id uuid, p_participant_id uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_current_turn_participant_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone, participants_data jsonb, picks_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  draft_record public.drafts%ROWTYPE;
  v_participants_json jsonb;
  v_picks_json jsonb;
BEGIN
  -- Check access permissions
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Find the draft
  SELECT * INTO draft_record 
  FROM public.drafts 
  WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  
  -- Fetch ALL participants in same order as player_id (created_at ASC NULLS LAST, id ASC)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', dp.id,
      'draft_id', dp.draft_id,
      'user_id', dp.user_id,
      'guest_participant_id', dp.guest_participant_id,
      'participant_id', COALESCE(dp.user_id, dp.guest_participant_id, CASE WHEN dp.is_ai THEN dp.id ELSE NULL END),
      'participant_name', dp.participant_name,
      'status', dp.status,
      'is_host', dp.is_host,
      'is_ai', dp.is_ai,
      'joined_at', dp.joined_at,
      'created_at', dp.created_at
    )
    ORDER BY dp.created_at ASC NULLS LAST, dp.id ASC
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
$function$;
