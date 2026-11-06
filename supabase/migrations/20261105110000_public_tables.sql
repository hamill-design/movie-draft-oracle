-- ============================================================
-- PUBLIC TABLES  (Phase 2 of docs/public-matchmaking-plan.md)
--
-- Open Tables: a host creates a public table (format, seats, pick clock,
-- rated or casual, optional scheduled start). Others browse and join.
-- THE HOST ALWAYS STARTS THE DRAFT THEMSELVES; a scheduled time is a promise
-- to players, never a trigger.
--
--   - Public tables always have a pick clock, locked at creation
--   - Live-clock tables (2 minutes or less per pick) get a 15-second ready check
--   - If the host doesn't show: the host role passes to the next player who
--     joined (at most 2 handoffs), otherwise the table is cancelled
--   - The host may start alone; with one real player the game is unrated
--     practice against bots
--
-- Reuses the live start_multiplayer_draft_unified() to build the turn order,
-- so a public draft starts exactly like any other.
--
-- Run AFTER 20261105100000_public_play_foundation.sql. Inert until the public
-- play switch is turned on.
-- ============================================================

-- ── Columns ──────────────────────────────────────────────────

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS lobby_visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS match_source text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS table_size integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS rated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS host_since timestamptz,
  ADD COLUMN IF NOT EXISTS host_handoff_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS host_nudge_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_check_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_check_fill_bots boolean NOT NULL DEFAULT false;

ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_lobby_visibility_check;
ALTER TABLE public.drafts ADD CONSTRAINT drafts_lobby_visibility_check
  CHECK (lobby_visibility IN ('private', 'public'));

ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_match_source_check;
ALTER TABLE public.drafts ADD CONSTRAINT drafts_match_source_check
  CHECK (match_source IN ('private', 'open', 'quick', 'featured'));

ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_table_size_check;
ALTER TABLE public.drafts ADD CONSTRAINT drafts_table_size_check
  CHECK (table_size BETWEEN 2 AND 6);

-- Strangers can't be waited on forever: a public table must have a clock.
ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_public_needs_clock;
ALTER TABLE public.drafts ADD CONSTRAINT drafts_public_needs_clock
  CHECK (lobby_visibility = 'private' OR (referee_enabled AND pick_clock_seconds IS NOT NULL));

ALTER TABLE public.draft_participants ADD COLUMN IF NOT EXISTS ready_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_drafts_forming_public
  ON public.drafts (created_at DESC)
  WHERE lobby_visibility = 'public' AND turn_order IS NULL AND cancelled_at IS NULL;

-- ── A public table's clock cannot be changed ─────────────────
-- (same function as the referee migration, plus one rule)

CREATE OR REPLACE FUNCTION public.set_draft_referee(
  p_draft_id uuid,
  p_participant_id uuid,
  p_enabled boolean,
  p_pick_clock_seconds integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.drafts%ROWTYPE;
BEGIN
  SELECT * INTO v_draft FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  IF NOT (
    (auth.uid() IS NOT NULL AND v_draft.user_id = auth.uid())
    OR (v_draft.guest_session_id IS NOT NULL AND v_draft.guest_session_id = p_participant_id)
  ) THEN
    RAISE EXCEPTION 'Only the draft owner can change the pick clock';
  END IF;

  IF v_draft.lobby_visibility = 'public' THEN
    RAISE EXCEPTION 'A public table''s pick clock is set when the table is created and cannot be changed';
  END IF;

  IF v_draft.turn_order IS NOT NULL AND jsonb_array_length(v_draft.turn_order) > 0 THEN
    RAISE EXCEPTION 'The pick clock cannot be changed after the draft has started';
  END IF;

  IF p_pick_clock_seconds IS NOT NULL AND (p_pick_clock_seconds < 30 OR p_pick_clock_seconds > 86400) THEN
    RAISE EXCEPTION 'The pick clock must be between 30 seconds and 24 hours';
  END IF;

  UPDATE public.drafts
  SET referee_enabled = COALESCE(p_enabled, false),
      pick_clock_seconds = CASE WHEN COALESCE(p_enabled, false) THEN p_pick_clock_seconds ELSE NULL END
  WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'referee_enabled', COALESCE(p_enabled, false),
    'pick_clock_seconds', CASE WHEN COALESCE(p_enabled, false) THEN p_pick_clock_seconds ELSE NULL END
  );
END;
$$;

-- ── Small helpers ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._table_status(d public.drafts)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d.cancelled_at IS NOT NULL THEN 'cancelled'
    WHEN COALESCE(d.is_complete, false) THEN 'complete'
    WHEN d.turn_order IS NOT NULL AND jsonb_typeof(d.turn_order) = 'array' AND jsonb_array_length(d.turn_order) > 0 THEN 'active'
    ELSE 'forming'
  END;
$$;

-- How long a host may be absent: short for live tables (players are waiting at their screens).
CREATE OR REPLACE FUNCTION public._host_grace(d public.drafts)
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN d.pick_clock_seconds IS NOT NULL AND d.pick_clock_seconds <= 120
              THEN interval '15 minutes' ELSE interval '24 hours' END;
$$;

CREATE OR REPLACE FUNCTION public._is_live_clock(d public.drafts)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT d.pick_clock_seconds IS NOT NULL AND d.pick_clock_seconds <= 120;
$$;

CREATE OR REPLACE FUNCTION public._pick_bot_name(p_draft uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_names text[] := ARRAY['R2-D2', 'C-3PO', 'HAL 9000', 'TARS', 'Mechagodzilla', 'R.O.B.', 'The Think Tank',
    'Chappie', 'Ultron', 'J.A.R.V.I.S.', 'Gort', 'WALL-E', 'Mikki', 'Gigolo Joe', 'B.R.A.I.N.',
    'T-1000', 'T-800', 'The Iron Giant'];
  v_name text;
  v_n integer := 0;
BEGIN
  FOR v_name IN SELECT n FROM unnest(v_names) AS n ORDER BY random() LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft AND lower(dp.participant_name) = lower(v_name)
    ) THEN
      RETURN v_name;
    END IF;
  END LOOP;
  -- Every name is taken (cannot happen with table sizes up to 6, but never fail).
  LOOP
    v_n := v_n + 1;
    v_name := 'Bot ' || v_n;
    IF NOT EXISTS (SELECT 1 FROM public.draft_participants dp WHERE dp.draft_id = p_draft AND dp.participant_name = v_name) THEN
      RETURN v_name;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._add_bots(p_draft uuid, p_count integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
BEGIN
  FOR i IN 1..GREATEST(p_count, 0) LOOP
    INSERT INTO public.draft_participants (draft_id, user_id, guest_participant_id, participant_name, status, is_host, is_ai, joined_at)
    VALUES (p_draft, NULL, NULL, public._pick_bot_name(p_draft), 'joined', false, true, now());
  END LOOP;
  RETURN GREATEST(p_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public._human_user_ids(p_draft uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(dp.user_id ORDER BY dp.joined_at NULLS LAST, dp.created_at), ARRAY[]::uuid[])
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false);
$$;

-- Names are set by a BEFORE INSERT trigger that falls back to the player's EMAIL.
-- For public tables we always overwrite the name with the chosen public name afterwards.
CREATE OR REPLACE FUNCTION public._seat_human(p_draft uuid, p_user uuid, p_is_host boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_row  uuid;
BEGIN
  SELECT public_name INTO v_name FROM public.profiles WHERE id = p_user;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Choose a display name first';
  END IF;

  -- The only door into a public table: the seating guard (next migration) refuses every other way in
  -- (the invite-code join, direct inserts), so seat limits, blocks and bans can't be bypassed.
  PERFORM set_config('app.public_seat', '1', true);
  INSERT INTO public.draft_participants (draft_id, user_id, participant_name, status, is_host, is_ai, joined_at)
  VALUES (p_draft, p_user, v_name, 'joined', p_is_host, false, now())
  RETURNING id INTO v_row;
  PERFORM set_config('app.public_seat', '', true);

  UPDATE public.draft_participants SET participant_name = v_name WHERE id = v_row;
  RETURN v_row;
END;
$$;

-- Passes the host role to the next player who joined (join order). Returns the new host, or NULL if nobody can take it.
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
  ORDER BY dp.joined_at ASC NULLS LAST, dp.created_at ASC
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

-- ── Create ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_public_table(
  p_title text,
  p_theme text,
  p_option text,
  p_categories text[],
  p_table_size integer DEFAULT 4,
  p_pick_clock_seconds integer DEFAULT 60,
  p_rated boolean DEFAULT true,
  p_scheduled_start_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := public._assert_public_play(true);
  v_id    uuid;
  v_open  integer;
BEGIN
  IF p_title IS NULL OR btrim(p_title) = '' OR length(btrim(p_title)) > 200 THEN
    RAISE EXCEPTION 'The table title must be between 1 and 200 characters';
  END IF;
  IF p_theme IS NULL OR p_theme NOT IN ('year', 'people', 'spec-draft') THEN
    RAISE EXCEPTION 'Choose a draft format (year, filmography or special draft)';
  END IF;
  IF p_option IS NULL OR btrim(p_option) = '' OR length(btrim(p_option)) > 100 THEN
    RAISE EXCEPTION 'Choose what to draft from';
  END IF;
  IF p_categories IS NULL OR COALESCE(array_length(p_categories, 1), 0) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'A table needs between 1 and 20 categories';
  END IF;
  IF p_table_size IS NULL OR p_table_size NOT BETWEEN 2 AND 6 THEN
    RAISE EXCEPTION 'A table has between 2 and 6 seats';
  END IF;
  IF p_pick_clock_seconds IS NULL OR p_pick_clock_seconds NOT BETWEEN 30 AND 86400 THEN
    RAISE EXCEPTION 'Public tables need a pick clock between 30 seconds and 24 hours';
  END IF;
  IF p_scheduled_start_at IS NOT NULL AND (p_scheduled_start_at <= now() OR p_scheduled_start_at > now() + interval '30 days') THEN
    RAISE EXCEPTION 'Pick a start time between now and 30 days from now';
  END IF;

  -- One host, at most two open tables (and a daily cap) so the list can't be flooded.
  SELECT count(*) INTO v_open
  FROM public.drafts d
  WHERE d.user_id = v_uid AND d.lobby_visibility = 'public'
    AND d.cancelled_at IS NULL AND NOT COALESCE(d.is_complete, false)
    AND (d.turn_order IS NULL OR jsonb_typeof(d.turn_order) <> 'array' OR jsonb_array_length(d.turn_order) = 0);
  IF v_open >= 2 THEN
    RAISE EXCEPTION 'You already host 2 open tables. Start or cancel one first.';
  END IF;
  PERFORM public._rate_limit(v_uid, 'create_table', 10, interval '1 day', 'You have created a lot of tables today. Please try again tomorrow.');

  INSERT INTO public.drafts (
    user_id, title, theme, option, categories, participants, is_multiplayer, invite_code,
    lobby_visibility, match_source, table_size, pick_clock_seconds, referee_enabled,
    scheduled_start_at, rated, host_since
  ) VALUES (
    v_uid, btrim(p_title), p_theme, btrim(p_option), p_categories, ARRAY[]::text[], true, public.generate_invite_code(),
    'public', 'open', p_table_size, p_pick_clock_seconds, true,
    p_scheduled_start_at, COALESCE(p_rated, false), now()
  ) RETURNING id INTO v_id;

  PERFORM public._seat_human(v_id, v_uid, true);

  RETURN jsonb_build_object('draft_id', v_id);
END;
$$;

-- ── Join / leave ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.join_public_table(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := public._assert_public_play(true);
  d       public.drafts%ROWTYPE;
  v_status text;
  v_count integer;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR d.lobby_visibility <> 'public' THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.draft_participants dp WHERE dp.draft_id = p_draft_id AND dp.user_id = v_uid) THEN
    RETURN jsonb_build_object('draft_id', p_draft_id, 'already_joined', true);
  END IF;

  v_status := public._table_status(d);
  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'This table was cancelled'; END IF;
  IF v_status <> 'forming' THEN RAISE EXCEPTION 'This table has already started'; END IF;
  IF d.ready_check_expires_at IS NOT NULL AND d.ready_check_expires_at > now() THEN
    RAISE EXCEPTION 'This table is about to start. Try another one.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.user_id IS NOT NULL AND public._blocked_between(v_uid, dp.user_id)
  ) THEN
    RAISE EXCEPTION 'This table isn''t available to you';
  END IF;

  SELECT count(*) INTO v_count FROM public.draft_participants WHERE draft_id = p_draft_id;
  IF v_count >= d.table_size THEN
    RAISE EXCEPTION 'This table is full';
  END IF;

  IF (SELECT count(*) FROM public.public_play_events e
      WHERE e.user_id = v_uid AND e.kind = 'leave' AND e.created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'You''ve left several tables recently. Please wait a few minutes.';
  END IF;
  PERFORM public._rate_limit(v_uid, 'join', 20, interval '1 hour', 'You''re joining tables very quickly. Please wait a bit.', p_draft_id);

  PERFORM public._seat_human(p_draft_id, v_uid, false);
  RETURN jsonb_build_object('draft_id', p_draft_id, 'already_joined', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_public_table(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  d         public.drafts%ROWTYPE;
  v_row     public.draft_participants%ROWTYPE;
  v_new     uuid;
  v_humans  uuid[];
  v_other   uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;

  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR d.lobby_visibility <> 'public' THEN RAISE EXCEPTION 'Table not found'; END IF;
  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'This draft has already started or ended';
  END IF;

  SELECT * INTO v_row FROM public.draft_participants dp WHERE dp.draft_id = p_draft_id AND dp.user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'You are not at this table'; END IF;

  INSERT INTO public.public_play_events (user_id, kind, draft_id) VALUES (v_uid, 'leave', p_draft_id);

  IF v_row.is_host THEN
    v_new := public._handoff_host(p_draft_id, 'host_left');
    IF v_new IS NULL THEN
      UPDATE public.drafts SET cancelled_at = now(), cancel_reason = 'host_left' WHERE id = p_draft_id;
      RETURN jsonb_build_object('left', true, 'table_cancelled', true);
    END IF;
  END IF;

  DELETE FROM public.draft_participants WHERE id = v_row.id;
  RETURN jsonb_build_object('left', true, 'table_cancelled', false, 'new_host', v_new);
END;
$$;

-- ── Host controls ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._assert_host(p_draft uuid)
RETURNS public.drafts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.drafts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO d FROM public.drafts WHERE id = p_draft FOR UPDATE;
  IF NOT FOUND OR d.lobby_visibility <> 'public' THEN RAISE EXCEPTION 'Table not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft AND dp.is_host AND dp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can do that';
  END IF;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_table_schedule(p_draft_id uuid, p_scheduled_start_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.drafts%ROWTYPE := public._assert_host(p_draft_id);
  v_uid uuid;
BEGIN
  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'The table has already started';
  END IF;
  IF p_scheduled_start_at IS NOT NULL AND (p_scheduled_start_at <= now() OR p_scheduled_start_at > now() + interval '30 days') THEN
    RAISE EXCEPTION 'Pick a start time between now and 30 days from now';
  END IF;

  IF d.scheduled_start_at IS NOT DISTINCT FROM p_scheduled_start_at THEN
    RETURN jsonb_build_object('scheduled_start_at', p_scheduled_start_at, 'changed', false);
  END IF;

  UPDATE public.drafts
  SET scheduled_start_at = p_scheduled_start_at, reminder_sent_at = NULL, host_nudge_sent_at = NULL
  WHERE id = p_draft_id;

  FOREACH v_uid IN ARRAY public._human_user_ids(p_draft_id) LOOP
    IF v_uid <> auth.uid() THEN
      PERFORM public._notify(
        v_uid, 'schedule_changed', 'The start time changed', d.title,
        '/draft/' || p_draft_id::text, p_draft_id,
        jsonb_build_object('scheduled_start_at', p_scheduled_start_at)
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('scheduled_start_at', p_scheduled_start_at, 'changed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_public_table(p_draft_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.drafts%ROWTYPE := public._assert_host(p_draft_id);
  v_uid uuid;
BEGIN
  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'The table has already started';
  END IF;
  UPDATE public.drafts SET cancelled_at = now(), cancel_reason = 'host_cancelled', ready_check_expires_at = NULL WHERE id = p_draft_id;
  FOREACH v_uid IN ARRAY public._human_user_ids(p_draft_id) LOOP
    IF v_uid <> auth.uid() THEN
      PERFORM public._notify(v_uid, 'table_cancelled', 'The table was cancelled', d.title, '/play', p_draft_id, '{}'::jsonb);
    END IF;
  END LOOP;
END;
$$;

-- Does the actual start. Internal: callers have already decided it is time.
CREATE OR REPLACE FUNCTION public._do_start(p_draft uuid, p_fill_bots boolean, p_drop_unready boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d            public.drafts%ROWTYPE;
  v_removed    uuid[] := ARRAY[]::uuid[];
  v_uid        uuid;
  v_humans     integer;
  v_total      integer;
  v_need       integer := 0;
  v_actor      uuid;
  v_prev_owner uuid;
  v_prev_claim text;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Table not found'; END IF;
  IF public._table_status(d) <> 'forming' THEN
    RETURN jsonb_build_object('status', public._table_status(d));
  END IF;

  IF p_drop_unready THEN
    SELECT COALESCE(array_agg(dp.user_id), ARRAY[]::uuid[]) INTO v_removed
    FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false) AND dp.ready_at IS NULL;

    DELETE FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false) AND dp.ready_at IS NULL;

    FOREACH v_uid IN ARRAY v_removed LOOP
      PERFORM public._notify(v_uid, 'removed_from_table', 'You missed the ready check',
        d.title || ': the draft started without you.', '/play', p_draft, '{}'::jsonb);
    END LOOP;
  END IF;

  SELECT count(*) INTO v_humans FROM public.draft_participants
  WHERE draft_id = p_draft AND user_id IS NOT NULL AND NOT COALESCE(is_ai, false);
  IF v_humans = 0 THEN
    UPDATE public.drafts SET cancelled_at = now(), cancel_reason = 'everyone_left', ready_check_expires_at = NULL WHERE id = p_draft;
    RETURN jsonb_build_object('status', 'cancelled');
  END IF;

  SELECT count(*) INTO v_total FROM public.draft_participants WHERE draft_id = p_draft;
  IF p_fill_bots OR v_humans = 1 THEN
    v_need := GREATEST(d.table_size - v_total, 0);
    IF v_humans = 1 AND v_total + v_need < 2 THEN v_need := 2 - v_total; END IF;
    PERFORM public._add_bots(p_draft, v_need);
  END IF;

  IF v_total + v_need < 2 THEN
    RAISE EXCEPTION 'A draft needs at least 2 players. Fill the empty seats with bots to start.';
  END IF;

  -- A game only counts toward rankings with 2+ real players.
  UPDATE public.drafts
  SET rated = (d.rated AND v_humans >= 2), ready_check_expires_at = NULL
  WHERE id = p_draft;

  -- Build the turn order with the live start function, acting as the host (or first human).
  SELECT dp.user_id INTO v_actor FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft AND dp.is_host AND dp.user_id IS NOT NULL LIMIT 1;
  IF v_actor IS NULL THEN
    SELECT dp.user_id INTO v_actor FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false)
    ORDER BY dp.joined_at NULLS LAST LIMIT 1;
  END IF;

  v_prev_claim := current_setting('request.jwt.claim.sub', true);
  v_prev_owner := d.user_id;
  PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
  IF d.user_id IS DISTINCT FROM v_actor THEN
    UPDATE public.drafts SET user_id = v_actor WHERE id = p_draft;
  END IF;

  PERFORM public.start_multiplayer_draft_unified(p_draft, NULL::uuid);

  IF d.user_id IS DISTINCT FROM v_actor THEN
    UPDATE public.drafts SET user_id = v_prev_owner WHERE id = p_draft;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_prev_claim, ''), true);

  RETURN jsonb_build_object(
    'status', 'started',
    'humans', v_humans,
    'bots_added', v_need,
    'rated', (d.rated AND v_humans >= 2),
    'removed', to_jsonb(v_removed)
  );
END;
$$;

-- Host presses Start.
--  Slow tables start immediately. Live-clock tables first run a 15-second ready check.
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

  UPDATE public.draft_participants dp
  SET ready_at = CASE WHEN dp.user_id = auth.uid() THEN now() ELSE NULL END
  WHERE dp.draft_id = p_draft_id AND NOT COALESCE(dp.is_ai, false);

  UPDATE public.drafts
  SET ready_check_expires_at = now() + interval '15 seconds', ready_check_fill_bots = COALESCE(p_fill_bots, false)
  WHERE id = p_draft_id
  RETURNING ready_check_expires_at INTO d.ready_check_expires_at;

  PERFORM public._notify(u, 'match_found', 'Ready check', d.title || ': confirm you''re here to start.',
    '/draft/' || p_draft_id::text, p_draft_id, jsonb_build_object('expires_at', d.ready_check_expires_at))
  FROM unnest(public._human_user_ids(p_draft_id)) AS u
  WHERE u <> auth.uid();

  RETURN jsonb_build_object('status', 'ready_check', 'expires_at', d.ready_check_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_ready(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  d        public.drafts%ROWTYPE;
  v_unready integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR d.lobby_visibility <> 'public' THEN RAISE EXCEPTION 'Table not found'; END IF;
  IF d.ready_check_expires_at IS NULL OR d.ready_check_expires_at <= now() THEN
    RAISE EXCEPTION 'There is no ready check right now';
  END IF;

  UPDATE public.draft_participants SET ready_at = now()
  WHERE draft_id = p_draft_id AND user_id = v_uid AND ready_at IS NULL;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.draft_participants WHERE draft_id = p_draft_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'You are not at this table';
  END IF;

  SELECT count(*) INTO v_unready FROM public.draft_participants
  WHERE draft_id = p_draft_id AND user_id IS NOT NULL AND NOT COALESCE(is_ai, false) AND ready_at IS NULL;

  IF v_unready = 0 THEN
    RETURN jsonb_build_object('all_ready', true, 'result', public._do_start(p_draft_id, d.ready_check_fill_bots, false));
  END IF;
  RETURN jsonb_build_object('all_ready', false);
END;
$$;

-- ── Browsing ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_public_tables(
  p_speed text DEFAULT NULL,
  p_theme text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  draft_id uuid, title text, theme text, option text, categories text[],
  table_size integer, joined_count integer, seats_open integer,
  host_user_id uuid, host_name text, host_avatar_url text,
  pick_clock_seconds integer, speed text, scheduled_start_at timestamptz,
  rated boolean, match_source text, created_at timestamptz, i_joined boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._assert_public_play(false);
BEGIN
  RETURN QUERY
  SELECT d.id, d.title, d.theme, d.option, d.categories,
         d.table_size,
         (SELECT count(*)::integer FROM public.draft_participants x WHERE x.draft_id = d.id),
         GREATEST(d.table_size - (SELECT count(*)::integer FROM public.draft_participants x WHERE x.draft_id = d.id), 0),
         h.user_id, hp.public_name, hp.avatar_url,
         d.pick_clock_seconds,
         CASE WHEN d.pick_clock_seconds <= 120 THEN 'live' ELSE 'slow' END,
         d.scheduled_start_at, d.rated, d.match_source, d.created_at,
         EXISTS (SELECT 1 FROM public.draft_participants m WHERE m.draft_id = d.id AND m.user_id = v_uid)
  FROM public.drafts d
  JOIN public.draft_participants h ON h.draft_id = d.id AND h.is_host
  LEFT JOIN public.profiles hp ON hp.id = h.user_id
  WHERE d.lobby_visibility = 'public'
    AND d.match_source = 'open'
    AND public._table_status(d) = 'forming'
    AND (p_speed IS NULL OR p_speed = CASE WHEN d.pick_clock_seconds <= 120 THEN 'live' ELSE 'slow' END)
    AND (p_theme IS NULL OR d.theme = p_theme)
    AND NOT (h.user_id IS NOT NULL AND public._blocked_between(v_uid, h.user_id))
  ORDER BY COALESCE(d.scheduled_start_at, d.created_at) ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
END;
$$;

-- One table in full: the lobby view. Names and avatars only; never an email.
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

CREATE OR REPLACE FUNCTION public.my_public_tables()
RETURNS TABLE(draft_id uuid, title text, status text, speed text, scheduled_start_at timestamptz, i_am_host boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.title, public._table_status(d),
         CASE WHEN d.pick_clock_seconds <= 120 THEN 'live' ELSE 'slow' END,
         d.scheduled_start_at, dp.is_host
  FROM public.draft_participants dp
  JOIN public.drafts d ON d.id = dp.draft_id
  WHERE dp.user_id = auth.uid()
    AND d.lobby_visibility = 'public'
    AND public._table_status(d) IN ('forming', 'active')
  ORDER BY d.created_at DESC
  LIMIT 20;
$$;

-- Tiny and safe: lets the draft screen know NOT to load emails for a public table.
CREATE OR REPLACE FUNCTION public.draft_is_public(p_draft_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT d.lobby_visibility = 'public' FROM public.drafts d WHERE d.id = p_draft_id), false);
$$;

-- ── The sweep (service role; run by the referee-tick function every minute) ──
-- Reminders, host nudges, finishing expired ready checks, and host no-shows.

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

-- ── Permissions ──────────────────────────────────────────────
-- Internal helpers: server only.
REVOKE ALL ON FUNCTION public._pick_bot_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._add_bots(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._human_user_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._seat_human(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._handoff_host(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._assert_host(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._do_start(uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referee_sweep_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._pick_bot_name(uuid), public._add_bots(uuid, integer), public._human_user_ids(uuid),
  public._seat_human(uuid, uuid, boolean), public._handoff_host(uuid, text), public._assert_host(uuid),
  public._do_start(uuid, boolean, boolean), public.referee_sweep_tables() TO service_role;

-- Players (signed in; guests cannot use public tables).
-- Postgres lets everyone (including signed-out guests) run a function unless it is revoked.
REVOKE ALL ON FUNCTION public.create_public_table(text, text, text, text[], integer, integer, boolean, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_public_table(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_public_table(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_table_schedule(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_public_table(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_public_table(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_ready(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_public_tables(text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_table_info(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_public_tables() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._assert_host(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_table(text, text, text, text[], integer, integer, boolean, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_public_table(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_public_table(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_table_schedule(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_public_table(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_public_table(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_ready(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_public_tables(text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_table_info(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_public_tables() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.draft_is_public(uuid) TO anon, authenticated, service_role;
