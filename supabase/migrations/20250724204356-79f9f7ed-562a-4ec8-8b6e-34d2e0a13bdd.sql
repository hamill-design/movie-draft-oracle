-- Create a function to load draft with guest session support
CREATE OR REPLACE FUNCTION public.load_draft_with_guest_access(
  p_draft_id uuid,
  p_guest_session_id uuid DEFAULT NULL
)
RETURNS TABLE(
  draft_id uuid,
  draft_user_id uuid,
  draft_guest_session_id uuid,
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
  draft_draft_order text[],
  draft_created_at timestamp with time zone,
  draft_updated_at timestamp with time zone,
  participants_data jsonb,
  picks_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  draft_record public.drafts;
  v_participants_json jsonb;
  v_picks_json jsonb;
  v_has_access boolean := false;
BEGIN
  -- Set the guest session context if provided
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM public.set_guest_session_context(p_guest_session_id);
  END IF;
  
  -- Find the draft
  SELECT * INTO draft_record 
  FROM public.drafts 
  WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  
  -- Check access permissions
  -- 1. Owner access (authenticated user)
  IF auth.uid() IS NOT NULL AND draft_record.user_id = auth.uid() THEN
    v_has_access := true;
  END IF;
  
  -- 2. Owner access (guest session)
  IF p_guest_session_id IS NOT NULL AND draft_record.guest_session_id = p_guest_session_id THEN
    v_has_access := true;
  END IF;
  
  -- 3. Participant access (authenticated user)
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.user_id = auth.uid()
  ) THEN
    v_has_access := true;
  END IF;
  
  -- 4. Participant access (guest session)
  IF p_guest_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.guest_participant_id = p_guest_session_id
  ) THEN
    v_has_access := true;
  END IF;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'You do not have access to this draft';
  END IF;
  
  -- Fetch participants as JSON
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', dp.id,
      'draft_id', dp.draft_id,
      'user_id', dp.user_id,
      'guest_participant_id', dp.guest_participant_id,
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
    draft_record.is_complete,
    draft_record.turn_order,
    draft_record.draft_order,
    draft_record.created_at,
    draft_record.updated_at,
    v_participants_json,
    v_picks_json;
END;
$function$