-- ============================================================
-- Invite people to a draft: reserved seats
-- ============================================================
-- Open seats in the lobby are buttons. A host presses one and invites people by email (or, in a league
-- draft, picks league members). Each invitation HOLDS a seat:
--
--   * On a public table the seat shows as "Invited" to everyone (never the email or the name), and the
--     host sees who it is held for. Quick Match / open-game seating counts held seats, so strangers can't
--     take them.
--   * The invited person takes it by opening the invite (it links to /play?join=<table>); joining swaps
--     the held seat for a real one, with no second seat taken.
--   * A table that starts by itself waits for friends who were invited in the last 5 minutes (the host can
--     always press Start). When the draft starts, any seat still held is released (bots fill it if the host
--     asked for bots, and anyone with an account is told it began).
--   * Private drafts use the same function. Their invited people are the existing "invited" participants,
--     and the email goes on the draft's invite list so a new sign-up can claim the seat.
--
-- Needs migrations 1-14 (and the email-invitee migration, which is already live). Safe to run twice.
-- ============================================================


-- ── Friends who were invited recently and haven't arrived yet ────────────────

CREATE OR REPLACE FUNCTION public._waiting_for_invited(p_draft uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft AND dp.user_id IS NULL AND NOT COALESCE(dp.is_ai, false)
      AND dp.invited_email IS NOT NULL
      AND dp.created_at > now() - interval '5 minutes'
  );
$$;

-- ── Host invites people by email ─────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_to_draft(p_draft_id uuid, p_emails text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  d            public.drafts%ROWTYPE;
  v_public     boolean;
  v_cap        integer;
  v_count      integer;
  v_host_email text := public._current_auth_email();
  v_host_name  text;
  v_email      text;
  v_prof       uuid;
  v_prof_name  text;
  v_invited    jsonb := '[]'::jsonb;
  v_already    jsonb := '[]'::jsonb;
  v_rejected   jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;

  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF d.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can invite people';
  END IF;
  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'This draft has already started or ended';
  END IF;
  IF d.ready_check_expires_at IS NOT NULL AND d.ready_check_expires_at > now() THEN
    RAISE EXCEPTION 'The draft is about to start';
  END IF;

  v_public := d.lobby_visibility = 'public';
  v_cap := CASE WHEN v_public THEN d.table_size ELSE 6 END;
  SELECT count(*) INTO v_count FROM public.draft_participants WHERE draft_id = p_draft_id;

  SELECT COALESCE(pr.public_name, pr.name, 'A friend') INTO v_host_name FROM public.profiles pr WHERE pr.id = v_uid;

  FOR v_email IN
    SELECT DISTINCT lower(trim(e)) FROM unnest(COALESCE(p_emails, ARRAY[]::text[])) AS e WHERE trim(e) <> ''
  LOOP
    IF length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      v_rejected := v_rejected || jsonb_build_object('email', v_email, 'reason', 'invalid');
      CONTINUE;
    END IF;

    -- Already here, or already invited
    IF v_email = v_host_email
       OR EXISTS (SELECT 1 FROM public.draft_participants dp WHERE dp.draft_id = p_draft_id AND lower(dp.invited_email) = v_email)
       OR EXISTS (
         SELECT 1 FROM public.draft_participants dp JOIN public.profiles pr ON pr.id = dp.user_id
         WHERE dp.draft_id = p_draft_id AND lower(pr.email) = v_email
       ) THEN
      v_already := v_already || to_jsonb(v_email);
      CONTINUE;
    END IF;

    IF v_count >= v_cap THEN
      v_rejected := v_rejected || jsonb_build_object('email', v_email, 'reason', 'full');
      CONTINUE;
    END IF;

    PERFORM public._rate_limit(v_uid, 'invite', 30, interval '1 hour',
      'You''ve sent a lot of invitations. Please try again in a little while.', p_draft_id);

    SELECT pr.id, pr.name INTO v_prof, v_prof_name FROM public.profiles pr
    WHERE lower(pr.email) = v_email AND pr.id <> v_uid LIMIT 1;

    IF v_public THEN
      -- A held seat with no name or account on it: strangers see "Invited", the host sees the email.
      PERFORM set_config('app.public_seat', '1', true);
      INSERT INTO public.draft_participants
        (draft_id, user_id, participant_name, status, is_host, is_ai, invited_email)
      VALUES
        (p_draft_id, NULL, public._unique_participant_name(p_draft_id, 'Invited'), 'invited', false, false, v_email);
      PERFORM set_config('app.public_seat', '', true);
      IF v_prof IS NOT NULL THEN
        PERFORM public._notify(v_prof, 'draft_invite', 'You''re invited to a draft',
          v_host_name || ' saved you a seat in ' || COALESCE(d.title, 'a draft') || '.',
          '/play?join=' || p_draft_id::text, p_draft_id, '{}'::jsonb);
      END IF;
    ELSIF v_prof IS NOT NULL THEN
      -- Private, has an account: a seat in their name (this also sends the bell notification).
      INSERT INTO public.draft_participants
        (draft_id, user_id, participant_name, status, is_host, is_ai, joined_at, invited_email)
      VALUES
        (p_draft_id, v_prof,
         public._unique_participant_name(p_draft_id, COALESCE(v_prof_name, split_part(v_email, '@', 1))),
         'invited', false, false, now(), v_email);
    ELSE
      -- Private, no account yet: a held seat that their sign-up claims.
      INSERT INTO public.draft_participants
        (draft_id, user_id, participant_name, status, is_host, is_ai, invited_email)
      VALUES
        (p_draft_id, NULL, public._unique_participant_name(p_draft_id, split_part(v_email, '@', 1)),
         'invited', false, false, v_email);
    END IF;

    IF NOT v_public AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(d.participants, ARRAY[]::text[])) AS x WHERE lower(trim(x)) = v_email
    ) THEN
      -- The draft's invite list: lets a new sign-up with this email claim the seat.
      UPDATE public.drafts SET participants = array_append(COALESCE(participants, ARRAY[]::text[]), v_email)
      WHERE id = p_draft_id;
      SELECT * INTO d FROM public.drafts WHERE id = p_draft_id;
    END IF;

    v_count := v_count + 1;
    v_invited := v_invited || jsonb_build_object('email', v_email, 'has_account', v_prof IS NOT NULL);
  END LOOP;

  RETURN jsonb_build_object(
    'invited', v_invited,
    'already', v_already,
    'rejected', v_rejected,
    'seats_left', GREATEST(v_cap - v_count, 0)
  );
END;
$$;

-- ── Host takes back an invitation nobody has used yet ────────

CREATE OR REPLACE FUNCTION public.revoke_draft_invite(p_draft_id uuid, p_participant_id uuid)
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;

  SELECT * INTO d FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF d.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can take back an invitation';
  END IF;
  IF public._table_status(d) <> 'forming' THEN
    RAISE EXCEPTION 'This draft has already started or ended';
  END IF;

  SELECT * INTO v_row FROM public.draft_participants dp
  WHERE dp.id = p_participant_id AND dp.draft_id = p_draft_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That invitation is gone'; END IF;
  IF v_row.invited_email IS NULL OR COALESCE(v_row.is_ai, false) OR v_row.is_host
     OR (v_row.user_id IS NOT NULL AND v_row.status <> 'invited') THEN
    RAISE EXCEPTION 'That seat is taken';
  END IF;

  DELETE FROM public.draft_participants WHERE id = v_row.id;

  IF d.lobby_visibility <> 'public' THEN
    UPDATE public.drafts
    SET participants = ARRAY(
      SELECT x FROM unnest(COALESCE(participants, ARRAY[]::text[])) AS x WHERE lower(trim(x)) <> lower(v_row.invited_email)
    )
    WHERE id = p_draft_id;
  END IF;

  RETURN jsonb_build_object('revoked', true);
END;
$$;


-- ── Joining: take the seat held for your email ─────────────

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
  v_email text := public._current_auth_email();
  v_held  uuid;
  v_name  text;
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

  -- A seat the host held for this person's email: they take that one instead of a new one.
  IF v_email IS NOT NULL THEN
    SELECT dp.id INTO v_held FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.user_id IS NULL AND NOT COALESCE(dp.is_ai, false)
      AND lower(dp.invited_email) = v_email
    FOR UPDATE;
  END IF;

  IF v_held IS NULL THEN
    SELECT count(*) INTO v_count FROM public.draft_participants WHERE draft_id = p_draft_id;
    IF v_count >= d.table_size THEN
      RAISE EXCEPTION 'This table is full';
    END IF;
  END IF;

  IF (SELECT count(*) FROM public.public_play_events e
      WHERE e.user_id = v_uid AND e.kind = 'leave' AND e.created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'You''ve left several tables recently. Please wait a few minutes.';
  END IF;
  PERFORM public._rate_limit(v_uid, 'join', 20, interval '1 hour', 'You''re joining tables very quickly. Please wait a bit.', p_draft_id);

  IF v_held IS NOT NULL THEN
    SELECT public_name INTO v_name FROM public.profiles WHERE id = v_uid;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Choose a display name first';
    END IF;
    UPDATE public.draft_participants
    SET user_id = v_uid, participant_name = v_name, status = 'joined', joined_at = now(), invited_email = NULL
    WHERE id = v_held;
    RETURN jsonb_build_object('draft_id', p_draft_id, 'already_joined', false, 'claimed_invite', true);
  END IF;

  PERFORM public._seat_human(p_draft_id, v_uid, false);
  RETURN jsonb_build_object('draft_id', p_draft_id, 'already_joined', false);
END;
$$;

-- ── Starting: release seats nobody took ─────────────────────

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

  -- Seats held for invited friends who never took them are released first (so bots can fill them), and anyone
  -- with an account is told the draft began without them.
  FOR v_uid IN
    SELECT pr.id FROM public.draft_participants dp
    JOIN public.profiles pr ON lower(pr.email) = lower(dp.invited_email)
    WHERE dp.draft_id = p_draft AND dp.user_id IS NULL AND NOT COALESCE(dp.is_ai, false) AND dp.invited_email IS NOT NULL
  LOOP
    PERFORM public._notify(v_uid, 'removed_from_table', 'The draft started',
      d.title || ': it began before you took your seat.', '/play', p_draft, '{}'::jsonb);
  END LOOP;
  DELETE FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft AND dp.user_id IS NULL AND NOT COALESCE(dp.is_ai, false) AND dp.invited_email IS NOT NULL;

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

-- ── Starting by itself: wait for friends who were just invited ──

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
  IF public._waiting_for_invited(p_draft) THEN
    RETURN jsonb_build_object('started', false, 'waiting_for_invited', true);   -- friends are on their way
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

-- ── The minute sweep: bots don't join while friends are on their way ──

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
    IF d.fill_deadline_at IS NOT NULL AND d.fill_deadline_at <= now() AND v_humans >= 2
       AND NOT public._waiting_for_invited(d.id) THEN
      PERFORM public._begin_ready_check(d.id, true);
      n_checks := n_checks + 1;
    END IF;
    -- One real player after the wait: they choose (keep waiting / start with bots). Nothing to do here.
  END LOOP;

  RETURN jsonb_build_object('started', n_started, 'ready_checks', n_checks, 'cancelled', n_cancelled, 'handoffs', n_handoffs);
END;
$$;

-- ── The lobby's data: held seats show as "Invited" ─────────────

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
    'waiting_for_invited', public._waiting_for_invited(d.id),
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

-- ── Who may call what ────────────────────────────────────────

REVOKE ALL ON FUNCTION public._waiting_for_invited(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invite_to_draft(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_draft_invite(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._waiting_for_invited(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.invite_to_draft(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_draft_invite(uuid, uuid) TO authenticated, service_role;

-- The functions above that changed keep the permissions they already had (CREATE OR REPLACE preserves them).
