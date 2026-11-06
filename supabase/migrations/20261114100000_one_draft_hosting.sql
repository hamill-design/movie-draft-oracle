-- ============================================================
-- One draft: the same hosting rules for every public draft
-- ============================================================
-- A Quick Play lobby is an ordinary public draft that the system fills in for you, so it gets the same
-- things any hosted draft has:
--
--   * The first person in a Quick Play lobby is its HOST (they own it, can start early, can set up voting).
--     If the host leaves, the next player who is still here takes over, and so on.
--   * "Start when everyone is ready" is a setting on the draft (auto_start). Quick Play turns it on; a host can
--     switch it on for any public draft.
--   * Nobody who has gone is waited on: the draft starts when everyone who is HERE is ready. Someone who has
--     closed the tab doesn't hold the lobby up (they are taken out of the draft when it starts).
--   * "Fill empty seats with bots" is a setting too (fill_bots), used when the draft starts by itself.
--
-- Needs migrations 1-13. Safe to run twice.
-- ============================================================

-- ── Settings on the draft ────────────────────────────────────

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS auto_start boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fill_bots  boolean NOT NULL DEFAULT false;

-- Quick Play lobbies already out there: auto-start and bots on, like new ones.
UPDATE public.drafts SET auto_start = true, fill_bots = true
WHERE match_source = 'quick' AND (NOT auto_start OR NOT fill_bots);

-- Quick Play lobbies created before this had no owner. Give each the player who was there first, so the
-- host powers (start early, voting) work for them too.
WITH first_human AS (
  SELECT DISTINCT ON (dp.draft_id) dp.draft_id, dp.user_id
  FROM public.draft_participants dp
  JOIN public.drafts x ON x.id = dp.draft_id
  WHERE x.match_source = 'quick' AND x.user_id IS NULL
    AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false)
  ORDER BY dp.draft_id, dp.joined_at NULLS LAST, dp.created_at
)
UPDATE public.drafts d SET user_id = f.user_id
FROM first_human f
WHERE d.id = f.draft_id AND d.user_id IS NULL;

UPDATE public.draft_participants dp SET is_host = true
FROM public.drafts d
WHERE dp.draft_id = d.id AND d.match_source = 'quick' AND dp.user_id = d.user_id
  AND NOT COALESCE(dp.is_ai, false)
  AND NOT EXISTS (SELECT 1 FROM public.draft_participants h WHERE h.draft_id = d.id AND h.is_host);

-- ── "Here" means their draft page checked in within the last 45 seconds ──

CREATE OR REPLACE FUNCTION public._lobby_present(p_last_seen timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_last_seen IS NOT NULL AND p_last_seen > now() - interval '45 seconds';
$$;

-- ── Handing the host role to someone who is here ─────────────
-- Same as before (migration 4), except a player who is here is chosen before one who has wandered off.

CREATE OR REPLACE FUNCTION public._handoff_host(p_draft uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d       public.drafts%ROWTYPE;
  v_old   uuid;
  v_new   uuid;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT dp.user_id INTO v_old
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft AND dp.is_host LIMIT 1;

  SELECT dp.user_id INTO v_new
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft
    AND dp.user_id IS NOT NULL
    AND NOT COALESCE(dp.is_ai, false)
    AND NOT dp.is_host
    AND dp.user_id IS DISTINCT FROM v_old
  ORDER BY public._lobby_present(dp.last_seen_at) DESC, dp.joined_at ASC NULLS LAST, dp.created_at ASC
  LIMIT 1;

  IF v_new IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.draft_participants SET is_host = (user_id IS NOT DISTINCT FROM v_new)
  WHERE draft_id = p_draft AND (is_host OR user_id = v_new);

  -- Ownership moves too: the live start function also accepts the owner, so the old host must lose it.
  UPDATE public.drafts
  SET user_id = v_new,
      host_since = now(),
      host_handoff_count = host_handoff_count + 1,
      host_nudge_sent_at = NULL
  WHERE id = p_draft;

  PERFORM public._notify(
    v_new, 'you_are_host', 'You''re now the host',
    COALESCE(d.title, 'A public table') || ': start the draft when everyone is ready.',
    '/draft/' || p_draft::text, p_draft,
    jsonb_build_object('reason', p_reason)
  );
  RETURN v_new;
END;
$$;

-- ── Start when everyone who is here is ready ─────────────────

CREATE OR REPLACE FUNCTION public._start_if_all_ready(p_draft uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d           public.drafts%ROWTYPE;
  v_present   integer;
  v_unready   integer;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft FOR UPDATE;
  IF NOT FOUND OR NOT d.auto_start OR d.lobby_visibility <> 'public' OR public._table_status(d) <> 'forming' THEN
    RETURN jsonb_build_object('started', false);
  END IF;
  IF d.ready_check_expires_at IS NOT NULL AND d.ready_check_expires_at > now() THEN
    RETURN jsonb_build_object('started', false);   -- a ready check is already running
  END IF;

  SELECT count(*)::integer, (count(*) FILTER (WHERE p.ready_at IS NULL))::integer INTO v_present, v_unready
  FROM public.draft_participants p
  WHERE p.draft_id = p_draft AND p.user_id IS NOT NULL AND NOT COALESCE(p.is_ai, false)
    AND public._lobby_present(p.last_seen_at);

  IF v_present >= 2 AND v_unready = 0 THEN
    -- A host who has gone doesn't hold the lobby: hand it to someone who is here before starting.
    IF NOT EXISTS (
      SELECT 1 FROM public.draft_participants h
      WHERE h.draft_id = p_draft AND h.is_host AND public._lobby_present(h.last_seen_at)
    ) THEN
      PERFORM public._handoff_host(p_draft, 'host_away');
    END IF;
    -- Anyone who isn't here and isn't ready is left out (they're told).
    RETURN jsonb_build_object('started', true, 'result', public._do_start(p_draft, d.fill_bots, true));
  END IF;
  RETURN jsonb_build_object('started', false);
END;
$$;

-- Readiness is kept (not reset) for any draft that starts by itself, not just Quick Play.
CREATE OR REPLACE FUNCTION public._begin_ready_check(p_draft uuid, p_fill_bots boolean)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires timestamptz := now() + interval '15 seconds';
  d         public.drafts%ROWTYPE;
  v_uid     uuid;
  v_humans  integer;
  v_unready integer;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft FOR UPDATE;

  SELECT count(*)::integer, (count(*) FILTER (WHERE p.ready_at IS NULL))::integer INTO v_humans, v_unready
  FROM public.draft_participants p
  WHERE p.draft_id = p_draft AND p.user_id IS NOT NULL AND NOT COALESCE(p.is_ai, false);

  IF d.auto_start THEN
    IF v_humans >= 1 AND v_unready = 0 THEN
      PERFORM public._do_start(p_draft, COALESCE(p_fill_bots, false), false);   -- everyone already readied up
      RETURN now();
    END IF;
  ELSE
    UPDATE public.draft_participants SET ready_at = NULL WHERE draft_id = p_draft AND NOT COALESCE(is_ai, false);
  END IF;

  UPDATE public.drafts SET ready_check_expires_at = v_expires, ready_check_fill_bots = COALESCE(p_fill_bots, false) WHERE id = p_draft;

  FOR v_uid IN
    SELECT p.user_id FROM public.draft_participants p
    WHERE p.draft_id = p_draft AND p.user_id IS NOT NULL AND NOT COALESCE(p.is_ai, false)
      AND (NOT d.auto_start OR p.ready_at IS NULL)
  LOOP
    PERFORM public._notify(v_uid, 'match_found', 'Match found', d.title || ': confirm you''re here to start.',
      '/draft/' || p_draft::text, p_draft, jsonb_build_object('expires_at', v_expires));
  END LOOP;
  RETURN v_expires;
END;
$$;

-- ── Quick Play: the first player is the host ─────────────────

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
  -- Whoever opens the lobby is its host.
  PERFORM public._seat_human(p_draft, p_user, p_created);

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

  v_entry := public._pick_pool_entry(v_uid);   -- never comes back empty-handed
  INSERT INTO public.drafts (
    user_id, title, theme, option, categories, participants, is_multiplayer, invite_code,
    lobby_visibility, match_source, table_size, pick_clock_seconds, referee_enabled, rated,
    quick_pool_id, fill_deadline_at, auto_start, fill_bots
  ) VALUES (
    v_uid, v_entry.label, v_entry.theme, v_entry.option, COALESCE(public._quick_categories(v_entry.kind), v_entry.categories),
    ARRAY[]::text[], true, public.generate_invite_code(),
    'public', 'quick', 4, 90, true, true,
    v_entry.id, now() + interval '40 seconds', true, true
  ) RETURNING id INTO v_draft;

  PERFORM public._quick_seat(v_draft, v_uid, true);

  RETURN jsonb_build_object('draft_id', v_draft, 'status', 'forming', 'created', true, 'joined', 1, 'already_in', false);
END;
$$;

-- ── The host's two switches ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_lobby_options(
  p_draft_id uuid,
  p_auto_start boolean DEFAULT NULL,
  p_fill_bots boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d        public.drafts%ROWTYPE := public._assert_host(p_draft_id);
  v_start  jsonb := jsonb_build_object('started', false);
BEGIN
  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'The draft has already started';
  END IF;

  UPDATE public.drafts
  SET auto_start = COALESCE(p_auto_start, auto_start),
      fill_bots  = COALESCE(p_fill_bots, fill_bots)
  WHERE id = p_draft_id
  RETURNING auto_start, fill_bots INTO d.auto_start, d.fill_bots;

  IF d.auto_start THEN
    v_start := public._start_if_all_ready(p_draft_id);
  END IF;

  RETURN jsonb_build_object(
    'auto_start', d.auto_start,
    'fill_bots', d.fill_bots,
    'started', COALESCE((v_start ->> 'started')::boolean, false)
  );
END;
$$;

-- ── The lobby view: now also says how the draft starts ───────

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
    'auto_start', d.auto_start,
    'fill_bots', d.fill_bots,
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

-- ── The sweeps (run every minute by the schedule) ────────────

-- Quick Play and other auto-start lobbies: fill timers, ready checks, everyone-left, and now
-- "start when everyone who is here is ready" and handing the host role on when the host has gone.
CREATE OR REPLACE FUNCTION public.referee_sweep_quick_match()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d           public.drafts%ROWTYPE;
  v_humans    integer;
  v_uid       uuid;
  v_res       jsonb;
  n_started   integer := 0;
  n_checks    integer := 0;
  n_cancelled integer := 0;
  n_handoffs  integer := 0;
BEGIN
  FOR d IN
    SELECT * FROM public.drafts x
    WHERE x.match_source = 'quick' AND x.lobby_visibility = 'public'
      AND x.cancelled_at IS NULL AND NOT COALESCE(x.is_complete, false)
      AND (x.turn_order IS NULL OR jsonb_typeof(x.turn_order) <> 'array' OR jsonb_array_length(x.turn_order) = 0)
    ORDER BY x.created_at
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  LOOP
    -- A ready check that ran out: start without the people who didn't answer.
    IF d.ready_check_expires_at IS NOT NULL THEN
      IF d.ready_check_expires_at <= now() THEN
        PERFORM public._do_start(d.id, d.ready_check_fill_bots, true);
        n_started := n_started + 1;
      END IF;
      CONTINUE;
    END IF;

    -- Everyone who is here is ready (someone who wasn't may have left since): start.
    IF d.auto_start THEN
      v_res := public._start_if_all_ready(d.id);
      IF COALESCE((v_res ->> 'started')::boolean, false) THEN
        n_started := n_started + 1;
        CONTINUE;
      END IF;
    END IF;

    -- The host has gone (and someone else is here): the next player takes over.
    IF d.created_at < now() - interval '60 seconds'
       AND NOT EXISTS (
         SELECT 1 FROM public.draft_participants h
         WHERE h.draft_id = d.id AND h.is_host AND h.last_seen_at > now() - interval '60 seconds'
       )
       AND EXISTS (
         SELECT 1 FROM public.draft_participants o
         WHERE o.draft_id = d.id AND NOT o.is_host AND o.user_id IS NOT NULL AND NOT COALESCE(o.is_ai, false)
           AND o.last_seen_at > now() - interval '60 seconds'
       ) THEN
      IF public._handoff_host(d.id, 'host_away') IS NOT NULL THEN
        n_handoffs := n_handoffs + 1;
      END IF;
    END IF;

    SELECT count(*) INTO v_humans FROM public.draft_participants p
    WHERE p.draft_id = d.id AND p.user_id IS NOT NULL AND NOT COALESCE(p.is_ai, false);

    -- Everyone has been gone for 3 minutes: close the lobby.
    IF d.created_at < now() - interval '3 minutes'
       AND NOT EXISTS (
         SELECT 1 FROM public.draft_participants p
         WHERE p.draft_id = d.id AND p.user_id IS NOT NULL
           AND COALESCE(p.last_seen_at, p.joined_at, p.created_at) > now() - interval '3 minutes'
       ) THEN
      UPDATE public.drafts SET cancelled_at = now(), cancel_reason = 'everyone_left' WHERE id = d.id;
      FOREACH v_uid IN ARRAY public._human_user_ids(d.id) LOOP
        PERFORM public._notify(v_uid, 'table_cancelled', 'Your match was closed', 'You were away, so we closed the lobby.', '/play', d.id, '{}'::jsonb);
      END LOOP;
      n_cancelled := n_cancelled + 1;
      CONTINUE;
    END IF;

    -- The wait is over and there are 2+ real players: bots fill the rest, then the ready check.
    IF d.fill_deadline_at IS NOT NULL AND d.fill_deadline_at <= now() AND v_humans >= 2 THEN
      PERFORM public._begin_ready_check(d.id, true);
      n_checks := n_checks + 1;
    END IF;
    -- One real player after the wait: they choose (keep waiting / start with bots). Nothing to do here.
  END LOOP;

  RETURN jsonb_build_object('started', n_started, 'ready_checks', n_checks, 'cancelled', n_cancelled, 'handoffs', n_handoffs);
END;
$$;

-- Hosted open games: the same "everyone who is here is ready" check, once a minute.
-- (The rest of this function is exactly as it was in migration 4.)
CREATE OR REPLACE FUNCTION public.referee_sweep_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d            public.drafts%ROWTYPE;
  v_host_seen  timestamptz;
  v_since      timestamptz;
  v_uid        uuid;
  v_new        uuid;
  v_res        jsonb;
  n_started    integer := 0;
  n_reminded   integer := 0;
  n_nudged     integer := 0;
  n_handoffs   integer := 0;
  n_cancelled  integer := 0;
BEGIN
  FOR d IN
    SELECT * FROM public.drafts x
    WHERE x.lobby_visibility = 'public' AND x.match_source = 'open'
      AND x.cancelled_at IS NULL AND NOT COALESCE(x.is_complete, false)
      AND (x.turn_order IS NULL OR jsonb_typeof(x.turn_order) <> 'array' OR jsonb_array_length(x.turn_order) = 0)
    ORDER BY x.created_at
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  LOOP
    -- A ready check that ran out: start without the people who didn't answer.
    IF d.ready_check_expires_at IS NOT NULL AND d.ready_check_expires_at <= now() THEN
      PERFORM public._do_start(d.id, d.ready_check_fill_bots, true);
      n_started := n_started + 1;
      CONTINUE;
    END IF;
    IF d.ready_check_expires_at IS NOT NULL THEN
      CONTINUE;  -- a ready check is in progress; leave it alone
    END IF;

    -- "Start when everyone is ready" is on and everyone who is here is ready: start.
    IF d.auto_start THEN
      v_res := public._start_if_all_ready(d.id);
      IF COALESCE((v_res ->> 'started')::boolean, false) THEN
        n_started := n_started + 1;
        CONTINUE;
      END IF;
    END IF;

    -- "Starts in an hour" to everyone who joined.
    IF d.scheduled_start_at IS NOT NULL AND d.reminder_sent_at IS NULL
       AND d.scheduled_start_at > now() AND d.scheduled_start_at <= now() + interval '1 hour' THEN
      FOREACH v_uid IN ARRAY public._human_user_ids(d.id) LOOP
        PERFORM public._notify(v_uid, 'table_starts_soon', 'Your table starts soon', d.title,
          '/draft/' || d.id::text, d.id, jsonb_build_object('scheduled_start_at', d.scheduled_start_at));
      END LOOP;
      UPDATE public.drafts SET reminder_sent_at = now() WHERE id = d.id;
      n_reminded := n_reminded + 1;
    END IF;

    -- "Time to start your table" to the host, once the scheduled time has come.
    IF d.scheduled_start_at IS NOT NULL AND d.scheduled_start_at <= now() AND d.host_nudge_sent_at IS NULL THEN
      SELECT dp.user_id INTO v_uid FROM public.draft_participants dp WHERE dp.draft_id = d.id AND dp.is_host LIMIT 1;
      IF v_uid IS NOT NULL THEN
        PERFORM public._notify(v_uid, 'time_to_start', 'Time to start your table',
          d.title || ': your players are waiting.', '/draft/' || d.id::text, d.id, '{}'::jsonb);
      END IF;
      UPDATE public.drafts SET host_nudge_sent_at = now() WHERE id = d.id;
      n_nudged := n_nudged + 1;
    END IF;

    -- Host no-show: scheduled tables wait a grace period past the scheduled time;
    -- unscheduled tables wait until the host has been away (no heartbeat) that long.
    SELECT dp.last_seen_at INTO v_host_seen FROM public.draft_participants dp WHERE dp.draft_id = d.id AND dp.is_host LIMIT 1;
    v_since := CASE
      WHEN d.scheduled_start_at IS NOT NULL THEN GREATEST(d.scheduled_start_at, COALESCE(d.host_since, d.created_at))
      ELSE GREATEST(COALESCE(d.host_since, d.created_at), COALESCE(v_host_seen, d.created_at))
    END;

    IF v_since + public._host_grace(d) <= now() THEN
      v_new := NULL;
      IF d.host_handoff_count < 2 THEN
        v_new := public._handoff_host(d.id, 'host_no_show');
      END IF;
      IF v_new IS NOT NULL THEN
        n_handoffs := n_handoffs + 1;
      ELSE
        UPDATE public.drafts SET cancelled_at = now(), cancel_reason = 'host_no_show' WHERE id = d.id;
        FOREACH v_uid IN ARRAY public._human_user_ids(d.id) LOOP
          PERFORM public._notify(v_uid, 'table_cancelled', 'The table was cancelled',
            d.title || ': the host didn''t start the draft.', '/play', d.id, '{}'::jsonb);
        END LOOP;
        n_cancelled := n_cancelled + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'started', n_started, 'reminded', n_reminded, 'nudged', n_nudged,
    'handoffs', n_handoffs, 'cancelled', n_cancelled
  );
END;
$$;

-- ── Who may call what ────────────────────────────────────────

REVOKE ALL ON FUNCTION public.set_lobby_options(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_lobby_options(uuid, boolean, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._lobby_present(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._lobby_present(timestamptz) TO authenticated, service_role;
