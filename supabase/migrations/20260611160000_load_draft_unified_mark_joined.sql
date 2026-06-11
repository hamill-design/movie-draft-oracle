-- load_draft_unified: mark the caller's own participant row as 'joined'
-- the first time they load a draft.
--
-- Companion to start_league_draft_rpc_v8: scheduled league drafts now
-- pre-create non-admin draft_participants rows with status='invited'
-- (instead of incorrectly pre-marking everyone 'joined' before they'd
-- actually shown up). Nothing previously transitioned 'invited' -> 'joined'
-- for these players, since league members navigate straight to /draft/:id
-- and never go through the invite-code join flow (which is what does that
-- transition for guests). Without this, every league member would be
-- permanently stuck showing "invited" in the lobby even after opening and
-- playing the draft.
--
-- can_access_draft already grants access purely based on the existence of
-- a draft_participants row for this user/guest (status is irrelevant to
-- access), so flipping 'invited' -> 'joined' here is purely a status
-- correction with no access-control implications. Only ever updates the
-- caller's own row, and only when it's currently 'invited'.
CREATE OR REPLACE FUNCTION public.load_draft_unified(p_draft_id uuid, p_participant_id uuid)
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
  draft_current_turn_participant_id uuid,
  draft_is_complete boolean,
  draft_turn_order jsonb,
  draft_draft_order text[],
  draft_created_at timestamp with time zone,
  draft_updated_at timestamp with time zone,
  draft_voting_ends_at timestamp with time zone,
  draft_allow_public_voting boolean,
  participants_data jsonb,
  picks_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  draft_record public.drafts%ROWTYPE;
  v_participants_json jsonb;
  v_picks_json jsonb;
BEGIN
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO draft_record
  FROM public.drafts
  WHERE id = p_draft_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  -- Mark this caller's own participant row as 'joined' (no-op if it's
  -- already 'joined'/'left', or if there's no row for them at all — e.g.
  -- the draft owner themselves, who isn't necessarily in
  -- draft_participants).
  UPDATE public.draft_participants
  SET status = 'joined'
  WHERE draft_id = p_draft_id
    AND status = 'invited'
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (guest_participant_id = p_participant_id)
    );

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
  ), '[]'::jsonb) INTO v_participants_json
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id;

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
    draft_record.voting_ends_at,
    COALESCE(draft_record.allow_public_voting, false),
    v_participants_json,
    v_picks_json;
END;
$$;
