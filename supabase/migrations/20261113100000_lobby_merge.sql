-- ============================================================
-- One lobby for every draft (public and private)
-- ============================================================
-- The public waiting room and the normal pre-draft screen become one screen. It needs two things
-- from the database that only one side had:
--
--   1. Public tables now say who is online (the green dot the private screen already had).
--   2. Private drafts get an optional "I'm ready" toggle. It is only a signal: the host can still
--      start whenever they like, and nothing in the draft depends on it.
--
-- Nothing here changes how a private draft loads, starts or runs. The two new functions are
-- separate from load_draft_unified / start_multiplayer_draft_unified on purpose.
-- ============================================================

-- ── 1. Public tables: who is online ──────────────────────────
-- Same function as before (supabase/migrations/20261106100000_quick_match.sql) plus one field per player.
-- "Online" means the same thing as on the private screen: their open draft page checked in within 30 seconds.

CREATE OR REPLACE FUNCTION public.get_table_info(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._assert_public_play(false);
  d     public.drafts%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id;
  IF NOT FOUND OR d.lobby_visibility <> 'public' THEN RAISE EXCEPTION 'Table not found'; END IF;

  RETURN jsonb_build_object(
    'draft_id', d.id,
    'title', d.title,
    'theme', d.theme,
    'option', d.option,
    'categories', to_jsonb(d.categories),
    'status', public._table_status(d),
    'cancel_reason', d.cancel_reason,
    'match_source', d.match_source,
    'is_quick', d.match_source = 'quick',
    'table_size', d.table_size,
    'pick_clock_seconds', d.pick_clock_seconds,
    'speed', CASE WHEN d.pick_clock_seconds <= 120 THEN 'live' ELSE 'slow' END,
    'scheduled_start_at', d.scheduled_start_at,
    'fill_deadline_at', d.fill_deadline_at,
    'rated', d.rated,
    'host_handoff_count', d.host_handoff_count,
    'ready_check_expires_at', d.ready_check_expires_at,
    'server_now', clock_timestamp(),
    'i_joined', EXISTS (SELECT 1 FROM public.draft_participants m WHERE m.draft_id = d.id AND m.user_id = v_uid),
    'i_am_host', EXISTS (SELECT 1 FROM public.draft_participants m WHERE m.draft_id = d.id AND m.user_id = v_uid AND m.is_host),
    'participants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', dp.user_id,
        'name', CASE WHEN dp.is_ai THEN dp.participant_name ELSE COALESCE(pr.public_name, 'Player') END,
        'avatar_url', CASE WHEN dp.is_ai THEN NULL ELSE pr.avatar_url END,
        'is_host', dp.is_host,
        'is_ai', COALESCE(dp.is_ai, false),
        'ready', dp.ready_at IS NOT NULL,
        'online', (NOT COALESCE(dp.is_ai, false)) AND COALESCE(dp.last_seen_at > now() - interval '30 seconds', false),
        'is_me', dp.user_id = v_uid
      ) ORDER BY dp.joined_at NULLS LAST, dp.created_at)
      FROM public.draft_participants dp
      LEFT JOIN public.profiles pr ON pr.id = dp.user_id
      WHERE dp.draft_id = d.id
    ), '[]'::jsonb)
  );
END;
$$;

-- ── 2. Private drafts: an optional "I'm ready" ───────────────
-- Works for signed-in players, email invitees and guests, the same way the presence heartbeat does:
-- the caller proves they belong to the draft with can_access_draft, and can only change their own row.
-- Public tables have their own Ready button (set_lobby_ready), which also starts Quick Play games.

CREATE OR REPLACE FUNCTION public.set_participant_ready(
  p_draft_id uuid,
  p_participant_id uuid,
  p_ready boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ready boolean := COALESCE(p_ready, true);
  v_rows  integer;
BEGIN
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF public.draft_is_public(p_draft_id) THEN
    RAISE EXCEPTION 'Use the Ready button in the table';
  END IF;

  UPDATE public.draft_participants dp
  SET ready_at = CASE WHEN v_ready THEN COALESCE(dp.ready_at, now()) ELSE NULL END
  WHERE dp.draft_id = p_draft_id
    AND COALESCE(dp.is_ai, false) = false
    AND (
      (auth.uid() IS NOT NULL AND dp.user_id = auth.uid())
      OR dp.guest_participant_id = p_participant_id
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'You are not a player in this draft';
  END IF;

  RETURN jsonb_build_object('ready', v_ready);
END;
$$;

-- Who is ready: { "<participant row id>": true | false } for every real player in the draft.
CREATE OR REPLACE FUNCTION public.get_lobby_ready(p_draft_id uuid, p_participant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_object_agg(dp.id::text, dp.ready_at IS NOT NULL)
    FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND NOT COALESCE(dp.is_ai, false)
  ), '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.set_participant_ready(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_lobby_ready(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_participant_ready(uuid, uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_lobby_ready(uuid, uuid) TO anon, authenticated, service_role;
