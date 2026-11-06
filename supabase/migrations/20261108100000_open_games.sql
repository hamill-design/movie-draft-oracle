-- ============================================================
-- OPEN GAMES: Quick Join, Quick Start and the homepage list
-- (follow-up to Phases 2-3 of docs/public-matchmaking-plan.md)
--
-- Any draft can be OPEN to the public (chosen when the host sets the draft up), and the
-- homepage lists the open games people can jump into. Quick Play is split in two:
--
--   quick_join()   Jump into an open game that is about to start: the live game closest
--                  to full, whether a player hosts it or the system does. If there is
--                  nothing to join it says so ({found:false}) and joins nothing.
--   quick_start()  Start a new Quick Match of your own (a random approved draft, 90-second
--                  clock, bots fill empty seats after a short wait). Others can jump in
--                  while it waits.
--   list_open_games_preview()
--                  The homepage list. Safe for signed-out visitors: it follows the
--                  public-play switch and returns only what a card on the homepage shows
--                  (no emails, no user ids).
--
-- Nothing here changes an existing function. quick_match_join() still works as before.
--
-- Run AFTER 20261107100000_ranked_results.sql.
-- ============================================================

-- ── Seat someone in a Quick Match lobby ──────────────────────
-- Shared by quick_start() and quick_join(). Returns how many people are now seated.

CREATE OR REPLACE FUNCTION public._quick_seat(p_draft uuid, p_user uuid, p_created boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool  uuid;
  v_size  integer;
  v_count integer;
BEGIN
  PERFORM public._seat_human(p_draft, p_user, false);

  SELECT d.quick_pool_id, d.table_size INTO v_pool, v_size FROM public.drafts d WHERE d.id = p_draft;
  INSERT INTO public.quick_match_history (user_id, pool_id) VALUES (p_user, v_pool);

  -- Latecomers always get a moment before bots are brought in.
  IF NOT p_created THEN
    UPDATE public.drafts SET fill_deadline_at = GREATEST(COALESCE(fill_deadline_at, now()), now() + interval '15 seconds')
    WHERE id = p_draft;
  END IF;

  SELECT count(*)::integer INTO v_count FROM public.draft_participants WHERE draft_id = p_draft;
  IF v_count >= v_size THEN
    PERFORM public._begin_ready_check(p_draft, false);
  END IF;
  RETURN v_count;
END;
$$;

-- ── Quick Start: open a Quick Match of your own ──────────────

CREATE OR REPLACE FUNCTION public.quick_start()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := public._assert_public_play(true);
  d       public.drafts%ROWTYPE;
  v_draft uuid;
  v_entry public.quick_match_pool%ROWTYPE;
BEGIN
  -- One at a time with the other Quick Play functions.
  PERFORM pg_advisory_xact_lock(hashtext('quick_match'));

  -- Already in a Quick Match that hasn't finished? Take them back to it.
  SELECT x.* INTO d
  FROM public.drafts x
  JOIN public.draft_participants dp ON dp.draft_id = x.id AND dp.user_id = v_uid
  WHERE x.match_source = 'quick' AND x.lobby_visibility = 'public'
    AND public._table_status(x) IN ('forming', 'active')
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('draft_id', d.id, 'status', public._table_status(d), 'already_in', true);
  END IF;

  IF (SELECT count(*) FROM public.public_play_events e
      WHERE e.user_id = v_uid AND e.kind = 'leave' AND e.created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'You''ve left several matches recently. Please wait a few minutes.';
  END IF;
  PERFORM public._rate_limit(v_uid, 'quick_start', 8, interval '1 hour', 'You''ve started a lot of quick games. Please wait a bit.');

  v_entry := public._pick_pool_entry(v_uid);   -- raises if nothing has been approved yet
  INSERT INTO public.drafts (
    user_id, title, theme, option, categories, participants, is_multiplayer, invite_code,
    lobby_visibility, match_source, table_size, pick_clock_seconds, referee_enabled, rated,
    quick_pool_id, fill_deadline_at
  ) VALUES (
    NULL, v_entry.label, v_entry.theme, v_entry.option, v_entry.categories, ARRAY[]::text[], true, public.generate_invite_code(),
    'public', 'quick', 4, 90, true, true,
    v_entry.id, now() + interval '40 seconds'
  ) RETURNING id INTO v_draft;

  PERFORM public._quick_seat(v_draft, v_uid, true);

  RETURN jsonb_build_object('draft_id', v_draft, 'status', 'forming', 'created', true, 'joined', 1, 'already_in', false);
END;
$$;

-- ── Quick Join: jump into an open game ───────────────────────
-- Candidates: live games (2 minutes a pick or faster) that haven't started, have a free seat,
-- and aren't scheduled more than 15 minutes away. The one closest to full goes first; ties are random.
-- A game you're blocked from (or that has someone you've blocked) is skipped.

CREATE OR REPLACE FUNCTION public.quick_join()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := public._assert_public_play(true);
  d       public.drafts%ROWTYPE;
  c       public.drafts%ROWTYPE;
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('quick_match'));

  -- Already in a Quick Match that hasn't finished? Take them back to it.
  SELECT x.* INTO d
  FROM public.drafts x
  JOIN public.draft_participants dp ON dp.draft_id = x.id AND dp.user_id = v_uid
  WHERE x.match_source = 'quick' AND x.lobby_visibility = 'public'
    AND public._table_status(x) IN ('forming', 'active')
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('found', true, 'draft_id', d.id, 'match_source', d.match_source,
                              'status', public._table_status(d), 'already_in', true);
  END IF;

  IF (SELECT count(*) FROM public.public_play_events e
      WHERE e.user_id = v_uid AND e.kind = 'leave' AND e.created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'You''ve left several games recently. Please wait a few minutes.';
  END IF;

  FOR d IN
    SELECT x.* FROM public.drafts x
    WHERE x.lobby_visibility = 'public' AND x.match_source IN ('quick', 'open')
      AND x.cancelled_at IS NULL AND NOT COALESCE(x.is_complete, false)
      AND (x.turn_order IS NULL OR jsonb_typeof(x.turn_order) <> 'array' OR jsonb_array_length(x.turn_order) = 0)
      AND (x.ready_check_expires_at IS NULL OR x.ready_check_expires_at <= now())
      AND x.pick_clock_seconds IS NOT NULL AND x.pick_clock_seconds <= 120
      AND (x.scheduled_start_at IS NULL OR x.scheduled_start_at <= now() + interval '15 minutes')
      AND (SELECT count(*) FROM public.draft_participants p WHERE p.draft_id = x.id) < x.table_size
      AND NOT EXISTS (SELECT 1 FROM public.draft_participants p WHERE p.draft_id = x.id AND p.user_id = v_uid)
    ORDER BY (SELECT count(*) FROM public.draft_participants p WHERE p.draft_id = x.id) DESC, random()
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.draft_participants p
      WHERE p.draft_id = d.id AND p.user_id IS NOT NULL AND public._blocked_between(v_uid, p.user_id)
    ) THEN
      CONTINUE;
    END IF;

    -- Take the game's lock, then look again: someone may have filled or started it a moment ago.
    SELECT * INTO c FROM public.drafts WHERE id = d.id FOR UPDATE;
    IF c.cancelled_at IS NOT NULL
       OR public._table_status(c) <> 'forming'
       OR (c.ready_check_expires_at IS NOT NULL AND c.ready_check_expires_at > now())
       OR (SELECT count(*) FROM public.draft_participants p WHERE p.draft_id = c.id) >= c.table_size THEN
      CONTINUE;
    END IF;

    IF c.match_source = 'quick' THEN
      PERFORM public._rate_limit(v_uid, 'join', 20, interval '1 hour', 'You''re joining games very quickly. Please wait a bit.');
      v_count := public._quick_seat(c.id, v_uid, false);
    ELSE
      -- A game a player hosts: the normal join (it applies its own limits and checks).
      PERFORM public.join_public_table(c.id);
      SELECT count(*)::integer INTO v_count FROM public.draft_participants WHERE draft_id = c.id;
    END IF;

    RETURN jsonb_build_object('found', true, 'draft_id', c.id, 'match_source', c.match_source,
                              'status', 'forming', 'joined', v_count, 'already_in', false);
  END LOOP;

  RETURN jsonb_build_object('found', false);
END;
$$;

-- ── The homepage list ────────────────────────────────────────
-- Games hosted by players that still have a free seat, live ones first. Follows the public-play
-- switch (nothing when it's off, or "just me" and you aren't the admin) and never raises, so a
-- homepage can always call it. Hosts are shown by their chosen public name only.

CREATE OR REPLACE FUNCTION public.list_open_games_preview(p_limit integer DEFAULT 12)
RETURNS TABLE(
  draft_id uuid, title text, theme text, option text,
  table_size integer, joined_count integer, seats_open integer,
  host_name text, pick_clock_seconds integer, speed text,
  scheduled_start_at timestamptz, rated boolean, created_at timestamptz, i_joined boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_mode text;
BEGIN
  SELECT s.mode INTO v_mode FROM public.public_play_settings s WHERE s.id;
  IF COALESCE(v_mode, 'off') = 'off'
     OR (v_mode = 'admin_only' AND (v_uid IS NULL OR NOT public.is_admin())) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.id, d.title, d.theme, d.option,
         d.table_size,
         (SELECT count(*)::integer FROM public.draft_participants x WHERE x.draft_id = d.id),
         GREATEST(d.table_size - (SELECT count(*)::integer FROM public.draft_participants x WHERE x.draft_id = d.id), 0),
         hp.public_name,
         d.pick_clock_seconds,
         CASE WHEN d.pick_clock_seconds <= 120 THEN 'live' ELSE 'slow' END,
         d.scheduled_start_at, d.rated, d.created_at,
         (v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.draft_participants m WHERE m.draft_id = d.id AND m.user_id = v_uid))
  FROM public.drafts d
  JOIN public.draft_participants h ON h.draft_id = d.id AND h.is_host
  LEFT JOIN public.profiles hp ON hp.id = h.user_id
  WHERE d.lobby_visibility = 'public'
    AND d.match_source = 'open'
    AND public._table_status(d) = 'forming'
    AND (d.ready_check_expires_at IS NULL OR d.ready_check_expires_at <= now())
    AND (SELECT count(*) FROM public.draft_participants x WHERE x.draft_id = d.id) < d.table_size
    AND NOT (v_uid IS NOT NULL AND h.user_id IS NOT NULL AND public._blocked_between(v_uid, h.user_id))
  ORDER BY (d.pick_clock_seconds <= 120) DESC, COALESCE(d.scheduled_start_at, d.created_at) ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50));
END;
$$;

-- ── Who may call what ────────────────────────────────────────

REVOKE ALL ON FUNCTION public._quick_seat(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_start() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quick_join() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_open_games_preview(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public._quick_seat(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.quick_start() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quick_join() TO authenticated, service_role;
-- The one function signed-out visitors may call (see its header comment for what it returns).
GRANT EXECUTE ON FUNCTION public.list_open_games_preview(integer) TO anon, authenticated, service_role;
