-- ============================================================
-- QUICK MATCH  (Phase 3 of docs/public-matchmaking-plan.md)
--
-- One button: "Find a match". The system puts you in a forming lobby (or opens one),
-- fills empty seats with bots after a short wait, runs a 15-second ready check, and
-- starts the draft. There is no host: the system starts it.
--
--   - Every match is a random pick from the QUICK MATCH POOL: the 50 most recent full
--     years, a list of well-known actors, and the Special Drafts. Players don't choose.
--   - 4 seats, 90 seconds per pick, rated (counts only with 2+ real players)
--   - Needs 2+ real players for a "real" match; a lone player can keep waiting or
--     practise against bots (unrated)
--   - Nobody is ever given the same pool entry twice in a row
--
-- THE POOL STARTS EMPTY OF APPROVALS: every entry is disabled until you enable it
-- (admin screen at /admin/quick-match). Each entry should have enough movies for 4 players
-- across all the match's categories; that review is yours.
--
-- Run AFTER 20261105120000_public_table_write_guards.sql.
-- ============================================================

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS quick_pool_id uuid,
  ADD COLUMN IF NOT EXISTS fill_deadline_at timestamptz;

-- ── The pool ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quick_match_pool (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind IN ('year', 'actor', 'spec')),
  theme      text NOT NULL,   -- the draft theme: 'year' | 'people' | 'spec-draft'
  option     text NOT NULL,   -- '1999' | 'Tom Hanks' | <spec draft id>
  label      text NOT NULL,
  categories text[] NOT NULL DEFAULT ARRAY['Action/Adventure', 'Comedy', 'Drama/Romance', 'Academy Award Nominee or Winner', 'Wild Card'],
  enabled    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (theme, option)
);
ALTER TABLE public.quick_match_pool ENABLE ROW LEVEL SECURITY;  -- no policies: functions only

CREATE TABLE IF NOT EXISTS public.quick_match_history (
  user_id   uuid NOT NULL,
  pool_id   uuid NOT NULL,
  played_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quick_match_history_user ON public.quick_match_history (user_id, played_at DESC);
ALTER TABLE public.quick_match_history ENABLE ROW LEVEL SECURITY;

-- Adds anything missing: the 50 most recent FULL calendar years, and every visible special draft.
-- Never removes or enables anything. Returns how many entries were added.
CREATE OR REPLACE FUNCTION public._sync_quick_pool()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year  integer := extract(year FROM now())::integer;
  v_added integer := 0;
  v_n     integer;
BEGIN
  INSERT INTO public.quick_match_pool (kind, theme, option, label)
  SELECT 'year', 'year', y::text, 'Draft by ' || y
  FROM generate_series(v_year - 50, v_year - 1) AS y
  ON CONFLICT (theme, option) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;

  INSERT INTO public.quick_match_pool (kind, theme, option, label)
  SELECT 'spec', 'spec-draft', s.id::text, s.name
  FROM public.spec_drafts s
  WHERE COALESCE((to_jsonb(s) ->> 'is_hidden')::boolean, false) = false
  ON CONFLICT (theme, option) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;

  RETURN v_added;
END;
$$;

SELECT public._sync_quick_pool();

-- A STARTING SUGGESTION for the actors list (all disabled). Review it, then enable what you like.
INSERT INTO public.quick_match_pool (kind, theme, option, label)
SELECT 'actor', 'people', n, n || ' filmography'
FROM unnest(ARRAY[
  'Tom Hanks', 'Meryl Streep', 'Denzel Washington', 'Leonardo DiCaprio', 'Brad Pitt', 'Julia Roberts',
  'Robert De Niro', 'Al Pacino', 'Jack Nicholson', 'Morgan Freeman', 'Sandra Bullock', 'Harrison Ford',
  'Samuel L. Jackson', 'Scarlett Johansson', 'Will Smith', 'Tom Cruise', 'Nicole Kidman', 'Cate Blanchett',
  'Matt Damon', 'Christian Bale', 'Anne Hathaway', 'Emma Stone', 'Ryan Gosling', 'Margot Robbie',
  'Jennifer Lawrence', 'Keanu Reeves', 'Robin Williams', 'Eddie Murphy', 'Jim Carrey', 'Bill Murray',
  'Clint Eastwood', 'Sigourney Weaver', 'Natalie Portman', 'Hugh Jackman', 'Johnny Depp', 'George Clooney',
  'Kate Winslet', 'Viola Davis', 'Joaquin Phoenix', 'Daniel Day-Lewis', 'Anthony Hopkins', 'Michael Caine',
  'Dwayne Johnson', 'Ben Affleck', 'Mark Wahlberg', 'Emma Thompson', 'Helen Mirren', 'Jodie Foster',
  'Ewan McGregor', 'Tilda Swinton'
]) AS n
ON CONFLICT (theme, option) DO NOTHING;

-- ── Admin tools for the pool ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_quick_pool()
RETURNS TABLE(id uuid, kind text, theme text, option text, label text, categories text[], enabled boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
  SELECT p.id, p.kind, p.theme, p.option, p.label, p.categories, p.enabled
  FROM public.quick_match_pool p
  ORDER BY p.kind, CASE WHEN p.kind = 'year' THEN p.option END DESC, p.label;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_quick_pool_enabled(p_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.quick_match_pool SET enabled = COALESCE(p_enabled, false) WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_quick_pool_kind_enabled(p_kind text, p_enabled boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.quick_match_pool SET enabled = COALESCE(p_enabled, false) WHERE kind = p_kind;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_quick_pool_actor(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g'));
  v_id   uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF length(v_name) < 3 OR length(v_name) > 80 THEN RAISE EXCEPTION 'Enter the actor''s full name'; END IF;
  INSERT INTO public.quick_match_pool (kind, theme, option, label)
  VALUES ('actor', 'people', v_name, v_name || ' filmography')
  ON CONFLICT (theme, option) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_quick_pool_entry(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  DELETE FROM public.quick_match_pool WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_sync_quick_pool()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN public._sync_quick_pool();
END;
$$;

-- Is there anything to play? (Lets the Play page show or hide the Quick Match button.)
CREATE OR REPLACE FUNCTION public.quick_match_available()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_public_play(false);
  RETURN EXISTS (SELECT 1 FROM public.quick_match_pool WHERE enabled);
END;
$$;

-- ── Choosing what the next match will be ─────────────────────
-- Pick a TYPE first (year / actor / themed, equal thirds among the types that have approved
-- entries), then a random entry of that type, never this player's previous one.

CREATE OR REPLACE FUNCTION public._pick_pool_entry(p_user uuid)
RETURNS public.quick_match_pool
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last  uuid;
  v_kinds text[];
  v_kind  text;
  v_entry public.quick_match_pool%ROWTYPE;
BEGIN
  SELECT h.pool_id INTO v_last FROM public.quick_match_history h WHERE h.user_id = p_user ORDER BY h.played_at DESC LIMIT 1;

  SELECT array_agg(DISTINCT p.kind) INTO v_kinds FROM public.quick_match_pool p WHERE p.enabled AND p.id IS DISTINCT FROM v_last;
  IF v_kinds IS NULL THEN
    -- Only one approved entry exists and it was their last: better a repeat than no match.
    v_last := NULL;
    SELECT array_agg(DISTINCT p.kind) INTO v_kinds FROM public.quick_match_pool p WHERE p.enabled;
  END IF;
  IF v_kinds IS NULL THEN
    RAISE EXCEPTION 'Quick Match isn''t available yet';
  END IF;

  v_kind := v_kinds[1 + floor(random() * array_length(v_kinds, 1))::integer];
  SELECT * INTO v_entry FROM public.quick_match_pool p
  WHERE p.enabled AND p.kind = v_kind AND p.id IS DISTINCT FROM v_last
  ORDER BY random() LIMIT 1;
  RETURN v_entry;
END;
$$;

-- ── The ready check (no host: everyone confirms) ─────────────

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
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft FOR UPDATE;
  UPDATE public.draft_participants SET ready_at = NULL WHERE draft_id = p_draft AND NOT COALESCE(is_ai, false);
  UPDATE public.drafts SET ready_check_expires_at = v_expires, ready_check_fill_bots = COALESCE(p_fill_bots, false) WHERE id = p_draft;
  FOREACH v_uid IN ARRAY public._human_user_ids(p_draft) LOOP
    PERFORM public._notify(v_uid, 'match_found', 'Match found', d.title || ': confirm you''re here to start.',
      '/draft/' || p_draft::text, p_draft, jsonb_build_object('expires_at', v_expires));
  END LOOP;
  RETURN v_expires;
END;
$$;

-- ── Find a match ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.quick_match_join()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := public._assert_public_play(true);
  d         public.drafts%ROWTYPE;
  v_draft   uuid;
  v_created boolean := false;
  v_entry   public.quick_match_pool%ROWTYPE;
  v_count   integer;
BEGIN
  -- One at a time, so two people searching together can't each open their own empty lobby.
  PERFORM pg_advisory_xact_lock(hashtext('quick_match'));

  -- Already in one? Take them back to it.
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
  PERFORM public._rate_limit(v_uid, 'join', 20, interval '1 hour', 'You''re searching very quickly. Please wait a bit.');

  -- The fullest forming lobby that has room and nobody who is blocked with us.
  FOR d IN
    SELECT x.* FROM public.drafts x
    WHERE x.match_source = 'quick' AND x.lobby_visibility = 'public'
      AND x.cancelled_at IS NULL AND NOT COALESCE(x.is_complete, false)
      AND (x.turn_order IS NULL OR jsonb_typeof(x.turn_order) <> 'array' OR jsonb_array_length(x.turn_order) = 0)
      AND x.ready_check_expires_at IS NULL
      AND (SELECT count(*) FROM public.draft_participants p WHERE p.draft_id = x.id) < x.table_size
    ORDER BY (SELECT count(*) FROM public.draft_participants p WHERE p.draft_id = x.id) DESC, x.created_at ASC
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.draft_participants p
      WHERE p.draft_id = d.id AND p.user_id IS NOT NULL AND public._blocked_between(v_uid, p.user_id)
    ) THEN
      CONTINUE;
    END IF;
    v_draft := d.id;
    EXIT;
  END LOOP;

  IF v_draft IS NULL THEN
    v_entry := public._pick_pool_entry(v_uid);
    INSERT INTO public.drafts (
      user_id, title, theme, option, categories, participants, is_multiplayer, invite_code,
      lobby_visibility, match_source, table_size, pick_clock_seconds, referee_enabled, rated,
      quick_pool_id, fill_deadline_at
    ) VALUES (
      NULL, v_entry.label, v_entry.theme, v_entry.option, v_entry.categories, ARRAY[]::text[], true, public.generate_invite_code(),
      'public', 'quick', 4, 90, true, true,
      v_entry.id, now() + interval '40 seconds'
    ) RETURNING id INTO v_draft;
    v_created := true;
  END IF;

  PERFORM public._seat_human(v_draft, v_uid, false);

  SELECT d2.quick_pool_id INTO v_entry.id FROM public.drafts d2 WHERE d2.id = v_draft;
  INSERT INTO public.quick_match_history (user_id, pool_id) VALUES (v_uid, v_entry.id);

  -- Latecomers always get a moment before bots are brought in.
  UPDATE public.drafts SET fill_deadline_at = GREATEST(COALESCE(fill_deadline_at, now()), now() + interval '15 seconds')
  WHERE id = v_draft AND NOT v_created;

  SELECT count(*) INTO v_count FROM public.draft_participants WHERE draft_id = v_draft;
  IF v_count >= 4 THEN
    PERFORM public._begin_ready_check(v_draft, false);
  END IF;

  RETURN jsonb_build_object('draft_id', v_draft, 'status', 'forming', 'created', v_created, 'joined', v_count, 'already_in', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_match_leave(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  d        public.drafts%ROWTYPE;
  v_humans integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR d.match_source <> 'quick' THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF public._table_status(d) <> 'forming' THEN RAISE EXCEPTION 'This match has already started'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.draft_participants WHERE draft_id = p_draft_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'You are not in this match';
  END IF;

  INSERT INTO public.public_play_events (user_id, kind, draft_id) VALUES (v_uid, 'leave', p_draft_id);
  DELETE FROM public.draft_participants WHERE draft_id = p_draft_id AND user_id = v_uid;

  SELECT count(*) INTO v_humans FROM public.draft_participants
  WHERE draft_id = p_draft_id AND user_id IS NOT NULL AND NOT COALESCE(is_ai, false);
  IF v_humans = 0 THEN
    UPDATE public.drafts SET cancelled_at = now(), cancel_reason = 'everyone_left', ready_check_expires_at = NULL WHERE id = p_draft_id;
  END IF;
  RETURN jsonb_build_object('left', true, 'match_cancelled', v_humans = 0);
END;
$$;

-- A lone player who doesn't want to keep waiting: play now against bots (unrated).
CREATE OR REPLACE FUNCTION public.quick_match_practice(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  d        public.drafts%ROWTYPE;
  v_humans integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR d.match_source <> 'quick' THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF public._table_status(d) <> 'forming' THEN RAISE EXCEPTION 'This match has already started'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.draft_participants WHERE draft_id = p_draft_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'You are not in this match';
  END IF;
  SELECT count(*) INTO v_humans FROM public.draft_participants
  WHERE draft_id = p_draft_id AND user_id IS NOT NULL AND NOT COALESCE(is_ai, false);
  IF v_humans <> 1 THEN
    RAISE EXCEPTION 'Other players have joined. Your match will start soon.';
  END IF;

  UPDATE public.drafts SET rated = false WHERE id = p_draft_id;
  RETURN public._do_start(p_draft_id, true, false);
END;
$$;

-- ── The lobby view, now with Quick Match details ─────────────
-- (Same as before plus: when bots will be brought in, and whether this is a Quick Match.)

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
        'is_me', dp.user_id = v_uid
      ) ORDER BY dp.joined_at NULLS LAST, dp.created_at)
      FROM public.draft_participants dp
      LEFT JOIN public.profiles pr ON pr.id = dp.user_id
      WHERE dp.draft_id = d.id
    ), '[]'::jsonb)
  );
END;
$$;

-- ── The sweep for Quick Match (service role) ─────────────────
-- Fill timers, expired ready checks, and lobbies everybody has wandered away from.

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
  n_started   integer := 0;
  n_checks    integer := 0;
  n_cancelled integer := 0;
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
    -- One real player after the wait: they choose (keep waiting / practise). Nothing to do here.
  END LOOP;

  RETURN jsonb_build_object('started', n_started, 'ready_checks', n_checks, 'cancelled', n_cancelled);
END;
$$;

-- ── Permissions ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public._sync_quick_pool() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pick_pool_entry(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._begin_ready_check(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referee_sweep_quick_match() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sync_quick_pool(), public._pick_pool_entry(uuid),
  public._begin_ready_check(uuid, boolean), public.referee_sweep_quick_match() TO service_role;

REVOKE ALL ON FUNCTION public.admin_list_quick_pool() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_quick_pool_enabled(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_quick_pool_kind_enabled(text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_add_quick_pool_actor(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_quick_pool_entry(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_sync_quick_pool() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quick_match_available() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quick_match_join() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quick_match_leave(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quick_match_practice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_quick_pool(), public.admin_set_quick_pool_enabled(uuid, boolean),
  public.admin_set_quick_pool_kind_enabled(text, boolean), public.admin_add_quick_pool_actor(text),
  public.admin_remove_quick_pool_entry(uuid), public.admin_sync_quick_pool(), public.quick_match_available(),
  public.quick_match_join(), public.quick_match_leave(uuid), public.quick_match_practice(uuid)
  TO authenticated, service_role;
