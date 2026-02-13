-- Add player_id_to_display_row to load_draft_unified so the backend is the source of truth for which row each pick belongs in.
CREATE OR REPLACE FUNCTION public.load_draft_unified(p_draft_id uuid, p_participant_id uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_current_turn_participant_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone, participants_data jsonb, picks_data jsonb, draft_player_id_to_display_row jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  draft_record public.drafts%ROWTYPE;
  v_participants_json jsonb;
  v_picks_json jsonb;
  v_player_id_to_display_row jsonb;
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
  
  -- Build player_id -> display_row (0-based) from turn_order round 1 so client can place picks in correct rows
  IF draft_record.turn_order IS NULL OR jsonb_array_length(draft_record.turn_order) = 0 THEN
    v_player_id_to_display_row := NULL;
  ELSE
    WITH round1 AS (
      SELECT (elem->>'participant_id')::uuid AS participant_id,
             (elem->>'pick_number')::int AS pick_number
      FROM jsonb_array_elements(draft_record.turn_order) AS elem
      WHERE elem->>'round' = '1' OR (elem->>'round')::int = 1
    ),
    ordered AS (
      SELECT participant_id, (row_number() OVER (ORDER BY pick_number))::int - 1 AS display_index
      FROM round1
    ),
    numbered_participants AS (
      SELECT COALESCE(dp.user_id, dp.guest_participant_id, CASE WHEN dp.is_ai THEN dp.id END)::uuid AS participant_id,
             (row_number() OVER (ORDER BY dp.created_at ASC NULLS LAST, dp.id ASC))::int AS player_id
      FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id
    )
    SELECT jsonb_object_agg(np.player_id::text, o.display_index)
    INTO v_player_id_to_display_row
    FROM ordered o
    JOIN numbered_participants np ON np.participant_id = o.participant_id;
  END IF;
  
  -- Return the complete draft record with participants, picks, and player_id -> display row map
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
    v_picks_json,
    v_player_id_to_display_row;
END;
$function$;
