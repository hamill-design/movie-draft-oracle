-- ============================================================
-- KICK A PLAYER (the host removes someone from the lobby)
--
-- WHAT IT DOES
--   The host of a public table can remove another person from it, from the "..." menu on that player. It works only
--   while the table is still forming (before the draft starts, and not during the 15-second ready check). The
--   removed player:
--     - loses their seat at once (the seat opens up for someone else),
--     - gets a notification ("You were removed from a table"),
--     - cannot sit down at THAT table again by any door: the Play page, Quick Play, the homepage join code, or a
--       friend's link. Every other table is unaffected, and nothing is held against their account.
--   A bot cannot be kicked (take a seat away in Edit settings instead), and nobody can kick themselves (the host
--   leaves or cancels). Hosts are limited to 20 kicks an hour.
--
-- WHAT IT CHANGES
--   - new table draft_kicks (who was removed from which table); closed to players, read only by the functions below
--   - new function kick_player(table, player), for signed-in players, host only
--   - _seat_human() (the one door every normal way in goes through) now refuses a kicked player
--   - quick_join() skips a lobby the player was kicked from, so Quick Play puts them somewhere else instead of
--     bouncing off it
-- A seat a host deliberately held for someone's email still works for that person (the host chose them).
-- Safe to run twice. Run after 20261116100000_host_controls.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.draft_kicks (
  draft_id   uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  kicked_by  uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, user_id)
);
ALTER TABLE public.draft_kicks ENABLE ROW LEVEL SECURITY;  -- no policies: the functions below are the only way in

-- ── The one door into a public table: refuse a player the host removed ──────────────────────────
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
  IF EXISTS (SELECT 1 FROM public.draft_kicks k WHERE k.draft_id = p_draft AND k.user_id = p_user) THEN
    RAISE EXCEPTION 'The host removed you from this table';
  END IF;

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

-- ── The host removes a player ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kick_player(p_draft_id uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  d     public.drafts%ROWTYPE;
  v_row public.draft_participants%ROWTYPE;
BEGIN
  d := public._assert_host(p_draft_id);   -- signed in, a public table, and the caller is its host (locks the table)

  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'You can only remove a player before the draft starts';
  END IF;
  IF d.ready_check_expires_at IS NOT NULL AND d.ready_check_expires_at > now() THEN
    RAISE EXCEPTION 'The draft is about to start';
  END IF;
  IF p_user IS NULL OR p_user = v_uid THEN
    RAISE EXCEPTION 'You cannot remove yourself. Leave or cancel the table instead';
  END IF;

  SELECT * INTO v_row FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id AND dp.user_id = p_user AND NOT COALESCE(dp.is_ai, false);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That player is not at this table';
  END IF;

  PERFORM public._rate_limit(v_uid, 'kick', 20, interval '1 hour',
    'You have removed a lot of players recently. Please wait a while.', p_draft_id);

  INSERT INTO public.draft_kicks (draft_id, user_id, kicked_by) VALUES (p_draft_id, p_user, v_uid)
  ON CONFLICT (draft_id, user_id) DO NOTHING;
  DELETE FROM public.draft_participants WHERE id = v_row.id;

  -- Not recorded as a "leave": being removed must not count against the player's own leave limits.
  INSERT INTO public.public_play_events (user_id, kind, draft_id) VALUES (p_user, 'kicked', p_draft_id);

  PERFORM public._notify(p_user, 'removed_from_table', 'You were removed from a table',
    d.title || ': the host removed you.', '/play', p_draft_id, '{}'::jsonb);

  RETURN jsonb_build_object('kicked', true);
END;
$$;

REVOKE ALL ON FUNCTION public.kick_player(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kick_player(uuid, uuid) TO authenticated, service_role;

-- ── Quick Play: do not offer a lobby the player was kicked from ─────────────────────────────────
-- As in 20261108100000_open_games.sql, plus one line in the candidate search.
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
      AND NOT EXISTS (SELECT 1 FROM public.draft_kicks k WHERE k.draft_id = x.id AND k.user_id = v_uid)
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
