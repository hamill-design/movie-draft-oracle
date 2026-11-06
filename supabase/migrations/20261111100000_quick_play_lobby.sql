-- ============================================================
-- QUICK PLAY ALWAYS FINDS A LOBBY, AND EVERYONE CAN READY UP
--
-- 1. Quick Play never says "no games". If nothing is open it opens a lobby, the next person to press
--    Quick Play lands in it, and so on. That used to need an admin to approve entries for Quick Match
--    first; now:
--      - every year and actor is on by default (an admin can still switch individual ones off),
--      - and if everything has been switched off, Quick Play falls back to every year and actor anyway.
--    Special drafts stay off until approved.
--
-- 2. Ready-up. Everyone in a lobby can mark themselves ready (and take it back) at any time.
--      - Quick Play lobby: the game starts the moment 2 or more real players are all ready (bots fill the
--        empty seats). The existing timers stay as the safety net: when the wait runs out, or the lobby
--        fills, anyone not ready gets the 15-second ready check, and people who already readied up are not
--        asked again.
--      - Game run by a host: nothing starts on its own, but the host's Start goes straight in when every
--        other player has already readied up, and otherwise runs the usual 15-second check for just the
--        players who haven't.
--
-- Run AFTER 20261110100000_guest_quick_play.sql.
-- ============================================================

-- ── 1. Always a lobby ────────────────────────────────────────

-- Everything that was approved-by-default is now on. (Special drafts are left as they are.)
UPDATE public.quick_match_pool SET enabled = true WHERE kind IN ('year', 'actor') AND NOT enabled;

-- Same as before, except it can no longer come back empty-handed: if nothing is switched on it uses every
-- year and actor.
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
  v_any   boolean := false;   -- nothing is switched on: draw from every year and actor
  v_entry public.quick_match_pool%ROWTYPE;
BEGIN
  SELECT h.pool_id INTO v_last FROM public.quick_match_history h WHERE h.user_id = p_user ORDER BY h.played_at DESC LIMIT 1;

  SELECT array_agg(DISTINCT p.kind) INTO v_kinds FROM public.quick_match_pool p WHERE p.enabled AND p.id IS DISTINCT FROM v_last;
  IF v_kinds IS NULL THEN
    -- Only one entry is on and it was their last: better a repeat than no match.
    v_last := NULL;
    SELECT array_agg(DISTINCT p.kind) INTO v_kinds FROM public.quick_match_pool p WHERE p.enabled;
  END IF;

  IF v_kinds IS NULL THEN
    v_any := true;
    SELECT array_agg(DISTINCT p.kind) INTO v_kinds FROM public.quick_match_pool p
    WHERE p.kind IN ('year', 'actor') AND p.id IS DISTINCT FROM v_last;
    IF v_kinds IS NULL THEN
      v_last := NULL;
      SELECT array_agg(DISTINCT p.kind) INTO v_kinds FROM public.quick_match_pool p WHERE p.kind IN ('year', 'actor');
    END IF;
  END IF;

  IF v_kinds IS NULL THEN
    RAISE EXCEPTION 'Quick Play isn''t available right now';
  END IF;

  v_kind := v_kinds[1 + floor(random() * array_length(v_kinds, 1))::integer];
  SELECT * INTO v_entry FROM public.quick_match_pool p
  WHERE (p.enabled OR (v_any AND p.kind IN ('year', 'actor'))) AND p.kind = v_kind AND p.id IS DISTINCT FROM v_last
  ORDER BY random() LIMIT 1;
  RETURN v_entry;
END;
$$;

-- Available whenever public play is open to the caller and there is anything to draw from.
CREATE OR REPLACE FUNCTION public.quick_match_available()
RETURNS boolean
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
    RETURN false;
  END IF;

  IF v_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.is_banned AND (p.banned_until IS NULL OR p.banned_until > now())
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (SELECT 1 FROM public.quick_match_pool q WHERE q.enabled OR q.kind IN ('year', 'actor'));
END;
$$;

-- ── 2. Ready-up ──────────────────────────────────────────────

-- Quick Play lobbies only: if 2+ real players are in and every one of them is ready, start now
-- (bots fill the empty seats). Returns {started: true|false}.
CREATE OR REPLACE FUNCTION public._start_if_all_ready(p_draft uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d          public.drafts%ROWTYPE;
  v_humans   integer;
  v_unready  integer;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft FOR UPDATE;
  IF NOT FOUND OR d.match_source <> 'quick' OR public._table_status(d) <> 'forming' THEN
    RETURN jsonb_build_object('started', false);
  END IF;

  SELECT count(*)::integer, (count(*) FILTER (WHERE p.ready_at IS NULL))::integer INTO v_humans, v_unready
  FROM public.draft_participants p
  WHERE p.draft_id = p_draft AND p.user_id IS NOT NULL AND NOT COALESCE(p.is_ai, false);

  IF v_humans >= 2 AND v_unready = 0 THEN
    RETURN jsonb_build_object('started', true, 'result', public._do_start(p_draft, true, false));
  END IF;
  RETURN jsonb_build_object('started', false);
END;
$$;

-- Mark yourself ready (or take it back) while the game is still gathering players.
CREATE OR REPLACE FUNCTION public.set_lobby_ready(p_draft_id uuid, p_ready boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  d       public.drafts%ROWTYPE;
  v_ready boolean := COALESCE(p_ready, true);
  v_start jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR d.lobby_visibility <> 'public' THEN RAISE EXCEPTION 'Table not found'; END IF;
  IF public._table_status(d) <> 'forming' THEN RAISE EXCEPTION 'This game has already started'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.draft_participants WHERE draft_id = p_draft_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'You are not at this table';
  END IF;
  IF NOT v_ready AND d.ready_check_expires_at IS NOT NULL AND d.ready_check_expires_at > now() THEN
    RAISE EXCEPTION 'The game is about to start';
  END IF;

  UPDATE public.draft_participants
  SET ready_at = CASE WHEN v_ready THEN COALESCE(ready_at, now()) ELSE NULL END
  WHERE draft_id = p_draft_id AND user_id = v_uid;

  v_start := public._start_if_all_ready(p_draft_id);   -- only does anything in a Quick Play lobby
  RETURN jsonb_build_object('ready', v_ready, 'started', COALESCE((v_start ->> 'started')::boolean, false));
END;
$$;

-- The 15-second ready check for Quick Play. Players who already readied up in the lobby stay ready, and if
-- that is everyone the game simply starts. (Host-run tables use start_public_table, below.)
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

  IF d.match_source = 'quick' THEN
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
      AND (d.match_source <> 'quick' OR p.ready_at IS NULL)
  LOOP
    PERFORM public._notify(v_uid, 'match_found', 'Match found', d.title || ': confirm you''re here to start.',
      '/draft/' || p_draft::text, p_draft, jsonb_build_object('expires_at', v_expires));
  END LOOP;
  RETURN v_expires;
END;
$$;

-- Leaving a Quick Play lobby can be what makes everyone left "ready": start then.
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
  ELSE
    PERFORM public._start_if_all_ready(p_draft_id);
  END IF;
  RETURN jsonb_build_object('left', true, 'match_cancelled', v_humans = 0);
END;
$$;

-- A host's Start. Same as before, except players who have already readied up in the lobby are not asked again:
-- if every other player is ready the draft starts straight away; otherwise the 15-second check runs for just the
-- players who haven't.
CREATE OR REPLACE FUNCTION public.start_public_table(p_draft_id uuid, p_fill_bots boolean DEFAULT false)
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
    RETURN public._do_start(p_draft_id, COALESCE(p_fill_bots, false), false);
  END IF;

  -- A ready check is already running: if it has run out, finish it now.
  IF d.ready_check_expires_at IS NOT NULL THEN
    IF d.ready_check_expires_at <= now() THEN
      RETURN public._do_start(p_draft_id, d.ready_check_fill_bots, true);
    END IF;
    RETURN jsonb_build_object('status', 'ready_check', 'expires_at', d.ready_check_expires_at);
  END IF;

  -- Everyone else has already readied up: no check needed.
  IF NOT EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false)
      AND dp.user_id <> auth.uid() AND dp.ready_at IS NULL
  ) THEN
    RETURN public._do_start(p_draft_id, COALESCE(p_fill_bots, false), false);
  END IF;

  UPDATE public.draft_participants dp
  SET ready_at = CASE WHEN dp.user_id = auth.uid() THEN now() ELSE dp.ready_at END
  WHERE dp.draft_id = p_draft_id AND NOT COALESCE(dp.is_ai, false);

  UPDATE public.drafts
  SET ready_check_expires_at = now() + interval '15 seconds', ready_check_fill_bots = COALESCE(p_fill_bots, false)
  WHERE id = p_draft_id
  RETURNING ready_check_expires_at INTO d.ready_check_expires_at;

  PERFORM public._notify(u, 'match_found', 'Ready check', d.title || ': confirm you''re here to start.',
    '/draft/' || p_draft_id::text, p_draft_id, jsonb_build_object('expires_at', d.ready_check_expires_at))
  FROM unnest(public._human_user_ids(p_draft_id)) AS u
  WHERE u <> auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.draft_participants dp WHERE dp.draft_id = p_draft_id AND dp.user_id = u AND dp.ready_at IS NOT NULL);

  RETURN jsonb_build_object('status', 'ready_check', 'expires_at', d.ready_check_expires_at);
END;
$$;

-- ── Who may call what ────────────────────────────────────────

REVOKE ALL ON FUNCTION public._start_if_all_ready(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lobby_ready(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._begin_ready_check(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pick_pool_entry(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_match_available() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._start_if_all_ready(uuid), public._begin_ready_check(uuid, boolean), public._pick_pool_entry(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lobby_ready(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quick_match_available() TO anon, authenticated, service_role;
