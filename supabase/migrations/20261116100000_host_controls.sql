-- ============================================================
-- THE HOST STARTS THE DRAFT, AND CHOOSES HOW IT RUNS
--
-- One simple lobby for every public draft (open games and Quick Play alike):
--
--   * Nothing starts by itself. The host presses Start. (Quick Play used to start the moment everyone had
--     readied up, or when a wait ran out. That, the ready-up button and both lobby switches are gone.)
--   * Empty seats are always filled with bots when the host starts. The way to play with fewer people is to
--     take seats away (see set_table_settings).
--   * Being in the lobby is being ready. When the host starts a live draft, everyone who is in the lobby right
--     now counts as ready; only people who have wandered off get the 15-second "are you here?" check, and a
--     draft whose players are all here starts at once. A slow draft (hours per pick) never asks.
--   * The host can change the draft until it starts: how many seats, the pick clock, rated or casual, and
--     the categories (set_table_settings). A private draft's owner can change its categories the same way
--     (set_draft_categories); its pick clock already had set_draft_referee. Private drafts are never rated.
--
-- What stays: the host being handed to someone who is here when the host goes, lobbies closing when everyone
-- has been away for 3 minutes, the report and block tools, and the held seats for invited friends.
--
-- The old columns auto_start, fill_bots and fill_deadline_at stay in the table but nothing reads them any
-- more. _start_if_all_ready stays as a function that never starts anything, because older functions still
-- call it.
--
-- Run AFTER 20261115100000_table_invites.sql.
-- ============================================================

-- ── Nothing starts by itself ─────────────────────────────────

CREATE OR REPLACE FUNCTION public._start_if_all_ready(p_draft uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object('started', false);   -- only the host starts a draft
END;
$$;

-- Sitting down at a Quick Play lobby no longer starts a countdown or a ready check, even when the table fills.
CREATE OR REPLACE FUNCTION public._quick_seat(p_draft uuid, p_user uuid, p_created boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool  uuid;
  v_count integer;
BEGIN
  -- Whoever opens the lobby is its host.
  PERFORM public._seat_human(p_draft, p_user, p_created);

  SELECT d.quick_pool_id INTO v_pool FROM public.drafts d WHERE d.id = p_draft;
  INSERT INTO public.quick_match_history (user_id, pool_id) VALUES (p_user, v_pool);

  SELECT count(*)::integer INTO v_count FROM public.draft_participants WHERE draft_id = p_draft;
  RETURN v_count;
END;
$$;

-- The minute sweep for Quick Play lobbies no longer starts anything except a ready check that has run out
-- (which the host's Start began). It still hands the host role to someone who is here, and closes a lobby
-- everyone has left.
CREATE OR REPLACE FUNCTION public.referee_sweep_quick_match()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d           public.drafts%ROWTYPE;
  v_uid       uuid;
  n_started   integer := 0;
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
        PERFORM public._do_start(d.id, true, true);
        n_started := n_started + 1;
      END IF;
      CONTINUE;
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
    END IF;
  END LOOP;

  -- ready_checks stays in the answer (always 0) so the scheduled job that reads it keeps working.
  RETURN jsonb_build_object('started', n_started, 'ready_checks', 0, 'cancelled', n_cancelled, 'handoffs', n_handoffs);
END;
$$;

-- ── The host's Start ─────────────────────────────────────────
-- Empty seats always fill with bots (p_fill_bots is kept so older screens still call it, but it is ignored).
-- On a live draft, everyone who is in the lobby right now counts as ready; the 15-second check is only for
-- people who aren't, and a draft with nobody to check starts at once.

CREATE OR REPLACE FUNCTION public.start_public_table(p_draft_id uuid, p_fill_bots boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d          public.drafts%ROWTYPE := public._assert_host(p_draft_id);
  v_others   integer;
BEGIN
  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'The table has already started or was cancelled';
  END IF;

  SELECT count(*) INTO v_others FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false) AND dp.user_id <> auth.uid();

  IF NOT public._is_live_clock(d) OR v_others = 0 THEN
    RETURN public._do_start(p_draft_id, true, false);
  END IF;

  -- A ready check is already running: if it has run out, finish it now.
  IF d.ready_check_expires_at IS NOT NULL THEN
    IF d.ready_check_expires_at <= now() THEN
      RETURN public._do_start(p_draft_id, true, true);
    END IF;
    RETURN jsonb_build_object('status', 'ready_check', 'expires_at', d.ready_check_expires_at);
  END IF;

  -- Being in the lobby is being ready.
  UPDATE public.draft_participants dp
  SET ready_at = COALESCE(dp.ready_at, now())
  WHERE dp.draft_id = p_draft_id AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false)
    AND (dp.user_id = auth.uid() OR public._lobby_present(dp.last_seen_at));

  -- Everyone is here: no check needed.
  IF NOT EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false) AND dp.ready_at IS NULL
  ) THEN
    RETURN public._do_start(p_draft_id, true, false);
  END IF;

  UPDATE public.drafts
  SET ready_check_expires_at = now() + interval '15 seconds', ready_check_fill_bots = true
  WHERE id = p_draft_id
  RETURNING ready_check_expires_at INTO d.ready_check_expires_at;

  PERFORM public._notify(u, 'match_found', 'Ready check', d.title || ': confirm you''re here to start.',
    '/draft/' || p_draft_id::text, p_draft_id, jsonb_build_object('expires_at', d.ready_check_expires_at))
  FROM unnest(public._human_user_ids(p_draft_id)) AS u
  WHERE NOT EXISTS (SELECT 1 FROM public.draft_participants dp WHERE dp.draft_id = p_draft_id AND dp.user_id = u AND dp.ready_at IS NOT NULL);

  RETURN jsonb_build_object('status', 'ready_check', 'expires_at', d.ready_check_expires_at);
END;
$$;

-- ── The host changes the draft before it starts ──────────────
-- Any of the four can be left out (NULL) to keep it as it is.
--   seats        2 to 6, and never fewer than the people (and held seats) already at the table
--   clock        seconds per pick, 30 seconds to 24 hours
--   rated        counts toward the leaderboard (only when 2+ real players actually play)
--   categories   chosen from the standard list; a special draft keeps the categories it was made with

-- Categories are chosen from the standard list, plus any the draft already has (so a draft made with a custom
-- category can keep it), plus, for a filmography ("people") draft, the actors' own categories the setup page
-- offers (actor_spec_categories, which only an admin can add to). Trimmed, no repeats, between 1 and 20.
-- Keep the standard list in step with src/config/categoryConfigs.ts (a test checks that every category the app
-- offers is accepted here).
CREATE OR REPLACE FUNCTION public._clean_categories(p_categories text[], p_current text[], p_theme text)
RETURNS text[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'Action/Adventure', 'Animated', 'Comedy', 'Drama/Romance', 'Sci-Fi/Fantasy', 'Horror/Thriller', 'Documentary',
    '30''s', '40''s', '50''s', '60''s', '70''s', '80''s', '90''s', '2000''s', '2010''s', '2020''s',
    'Academy Award Nominee or Winner', 'Blockbuster (minimum of $50 Mil)', 'Sequel', 'Wild Card'
  ];
  v_out     text[] := ARRAY[]::text[];
  v_cat     text;
  v_known   boolean;
BEGIN
  IF COALESCE(array_length(p_categories, 1), 0) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Pick between 1 and 20 categories';
  END IF;
  FOREACH v_cat IN ARRAY p_categories LOOP
    v_cat := btrim(v_cat);
    IF v_cat IS NULL THEN
      RAISE EXCEPTION 'That category isn''t available';
    END IF;
    IF NOT (v_cat = ANY(v_allowed) OR v_cat = ANY(COALESCE(p_current, ARRAY[]::text[]))) THEN
      v_known := false;
      IF p_theme = 'people' AND to_regclass('public.actor_spec_categories') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.actor_spec_categories WHERE category_name = $1)' INTO v_known USING v_cat;
      END IF;
      IF NOT v_known THEN
        RAISE EXCEPTION 'That category isn''t available';
      END IF;
    END IF;
    IF v_cat = ANY(v_out) THEN
      RAISE EXCEPTION 'Each category can only be used once';
    END IF;
    v_out := v_out || v_cat;
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_table_settings(
  p_draft_id uuid,
  p_table_size integer DEFAULT NULL,
  p_pick_clock_seconds integer DEFAULT NULL,
  p_rated boolean DEFAULT NULL,
  p_categories text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d         public.drafts%ROWTYPE := public._assert_host(p_draft_id);
  v_seated  integer;
  v_cats    text[] := NULL;
BEGIN
  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'The draft has already started';
  END IF;
  IF d.ready_check_expires_at IS NOT NULL AND d.ready_check_expires_at > now() THEN
    RAISE EXCEPTION 'The draft is about to start';
  END IF;
  PERFORM public._rate_limit(auth.uid(), 'table_settings', 60, interval '1 hour', 'You have changed the settings a lot. Please wait a bit.');

  IF p_table_size IS NOT NULL THEN
    IF p_table_size NOT BETWEEN 2 AND 6 THEN
      RAISE EXCEPTION 'A table has between 2 and 6 seats';
    END IF;
    SELECT count(*) INTO v_seated FROM public.draft_participants WHERE draft_id = p_draft_id;
    IF p_table_size < v_seated THEN
      RAISE EXCEPTION 'Seats can''t go below the % already at the table', v_seated;
    END IF;
  END IF;

  IF p_pick_clock_seconds IS NOT NULL AND p_pick_clock_seconds NOT BETWEEN 30 AND 86400 THEN
    RAISE EXCEPTION 'The pick clock must be between 30 seconds and 24 hours';
  END IF;

  IF p_categories IS NOT NULL THEN
    IF d.theme = 'spec-draft' THEN
      RAISE EXCEPTION 'A special draft keeps its own categories';
    END IF;
    v_cats := public._clean_categories(p_categories, d.categories, d.theme);
  END IF;

  UPDATE public.drafts
  SET table_size         = COALESCE(p_table_size, table_size),
      pick_clock_seconds = COALESCE(p_pick_clock_seconds, pick_clock_seconds),
      rated              = COALESCE(p_rated, rated),
      categories         = COALESCE(v_cats, categories)
  WHERE id = p_draft_id
  RETURNING table_size, pick_clock_seconds, rated, categories
  INTO d.table_size, d.pick_clock_seconds, d.rated, d.categories;

  RETURN jsonb_build_object(
    'table_size', d.table_size,
    'pick_clock_seconds', d.pick_clock_seconds,
    'rated', d.rated,
    'categories', to_jsonb(d.categories)
  );
END;
$$;

-- The same for a private draft (its owner, or a guest in their own draft): the categories, until it starts.
-- (A private draft's pick clock already has set_draft_referee.)
CREATE OR REPLACE FUNCTION public.set_draft_categories(p_draft_id uuid, p_participant_id uuid, p_categories text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.drafts%ROWTYPE;
  v_cats  text[];
BEGIN
  SELECT * INTO v_draft FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  IF NOT (
    (auth.uid() IS NOT NULL AND v_draft.user_id = auth.uid())
    OR (v_draft.guest_session_id IS NOT NULL AND v_draft.guest_session_id = p_participant_id)
  ) THEN
    RAISE EXCEPTION 'Only the draft owner can change the categories';
  END IF;
  IF v_draft.lobby_visibility = 'public' THEN
    RAISE EXCEPTION 'A public table''s categories are changed from its settings';
  END IF;
  IF v_draft.turn_order IS NOT NULL AND jsonb_typeof(v_draft.turn_order) = 'array' AND jsonb_array_length(v_draft.turn_order) > 0 THEN
    RAISE EXCEPTION 'The categories cannot be changed after the draft has started';
  END IF;
  IF v_draft.theme = 'spec-draft' THEN
    RAISE EXCEPTION 'A special draft keeps its own categories';
  END IF;

  v_cats := public._clean_categories(p_categories, v_draft.categories, v_draft.theme);
  UPDATE public.drafts SET categories = v_cats WHERE id = p_draft_id;
  RETURN jsonb_build_object('categories', to_jsonb(v_cats));
END;
$$;

-- ── The lobby's data ─────────────────────────────────────────
-- As before, minus what no longer exists (start-by-itself, bot switch, bot countdown, waiting for friends).

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
  v_host boolean;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id;
  IF NOT FOUND OR d.lobby_visibility <> 'public' THEN RAISE EXCEPTION 'Table not found'; END IF;

  v_host := EXISTS (SELECT 1 FROM public.draft_participants m WHERE m.draft_id = d.id AND m.user_id = v_uid AND m.is_host);

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
    'rated', d.rated,
    'host_handoff_count', d.host_handoff_count,
    'ready_check_expires_at', d.ready_check_expires_at,
    'server_now', clock_timestamp(),
    'i_joined', EXISTS (SELECT 1 FROM public.draft_participants m WHERE m.draft_id = d.id AND m.user_id = v_uid),
    'i_am_host', EXISTS (SELECT 1 FROM public.draft_participants m WHERE m.draft_id = d.id AND m.user_id = v_uid AND m.is_host),
    'participants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', dp.user_id,
        'participant_id', CASE WHEN v_host AND dp.user_id IS NULL AND NOT COALESCE(dp.is_ai, false) THEN dp.id ELSE NULL END,
        'status', CASE WHEN dp.user_id IS NULL AND NOT COALESCE(dp.is_ai, false) THEN 'invited' ELSE 'joined' END,
        'email', CASE WHEN v_host AND dp.user_id IS NULL AND NOT COALESCE(dp.is_ai, false) THEN dp.invited_email ELSE NULL END,
        'name', CASE
                  WHEN dp.is_ai THEN dp.participant_name
                  WHEN dp.user_id IS NULL THEN 'Invited'
                  ELSE COALESCE(pr.public_name, 'Player')
                END,
        'avatar_url', CASE WHEN dp.is_ai THEN NULL ELSE pr.avatar_url END,
        'is_host', dp.is_host,
        'is_ai', COALESCE(dp.is_ai, false),
        'ready', dp.ready_at IS NOT NULL,
        'online', (NOT COALESCE(dp.is_ai, false)) AND COALESCE(dp.last_seen_at > now() - interval '30 seconds', false),
        'is_me', COALESCE(dp.user_id = v_uid, false)
      ) ORDER BY dp.joined_at NULLS LAST, dp.created_at)
      FROM public.draft_participants dp
      LEFT JOIN public.profiles pr ON pr.id = dp.user_id
      WHERE dp.draft_id = d.id
    ), '[]'::jsonb)
  );
END;
$$;

-- ── Retire what is no longer used ────────────────────────────

DROP FUNCTION IF EXISTS public.set_lobby_options(uuid, boolean, boolean);
DROP FUNCTION IF EXISTS public.set_lobby_ready(uuid, boolean);
DROP FUNCTION IF EXISTS public._begin_ready_check(uuid, boolean);
DROP FUNCTION IF EXISTS public._waiting_for_invited(uuid);
-- The optional "I'm ready" in a private draft's waiting room: being in the lobby is being ready now.
DROP FUNCTION IF EXISTS public.set_participant_ready(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.get_lobby_ready(uuid, uuid);
-- The first version of Quick Match search and its "practise against bots" button, which only the oldest screens
-- used (the app calls quick_join and quick_start, and the host's Start does the practising).
DROP FUNCTION IF EXISTS public.quick_match_join();
DROP FUNCTION IF EXISTS public.quick_match_practice(uuid);

-- Lobbies that are still gathering lose any countdown or start-by-itself setting they had.
UPDATE public.drafts
SET auto_start = false, fill_deadline_at = NULL
WHERE (auto_start OR fill_deadline_at IS NOT NULL)
  AND cancelled_at IS NULL AND NOT COALESCE(is_complete, false)
  AND (turn_order IS NULL OR jsonb_typeof(turn_order) <> 'array' OR jsonb_array_length(turn_order) = 0);

-- ── Who may call what ────────────────────────────────────────

REVOKE ALL ON FUNCTION public.set_table_settings(uuid, integer, integer, boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_table_settings(uuid, integer, integer, boolean, text[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._clean_categories(text[], text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._clean_categories(text[], text[], text) TO service_role;
REVOKE ALL ON FUNCTION public.set_draft_categories(uuid, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_draft_categories(uuid, uuid, text[]) TO anon, authenticated, service_role;

-- The functions above that were replaced keep the permissions they already had.
