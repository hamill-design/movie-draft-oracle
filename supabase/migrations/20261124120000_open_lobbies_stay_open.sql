-- ============================================================
-- OPEN LOBBIES STAY OPEN
--
-- THE CHANGE
--   While public play is small, a lobby has to be able to wait for strangers. Two clean-ups used to close a waiting
--   lobby on a timer, and both are switched off here:
--     1. Quick Play lobbies: "everyone has been gone for 3 minutes, close the lobby" (and the notice "Your match was
--        closed. You were away, so we closed the lobby").
--     2. Open games a player set up without a start time: "the host has been away for 15 minutes (live) or 24 hours
--        (slow) and nobody can take over, so cancel the table".
--
-- WHAT STILL ENDS A LOBBY (unchanged)
--   - the host presses Cancel;
--   - the last person in it presses Leave;
--   - a game that has a start time still cancels when its host never shows (the host chose that deadline);
--   - the host starting the draft.
--
-- WHAT KEEPS WORKING
--   The host role still moves to somebody who is here. When a new player lands in a lobby whose host has gone, they
--   take over (the lobby screen does this as it loads, and the minute sweep does it too). So an empty lobby is a
--   place the next player lands in and becomes host. Quick Play already joins the lobby closest to full, so it will
--   reuse these.
--
-- WHAT TO KNOW
--   An empty lobby now stays listed under Open Drafts until someone joins it or somebody cancels it. If any pile up,
--   cancel them with one line in the SQL editor (this only touches lobbies nobody has opened for a day):
--     update public.drafts set cancelled_at = now(), cancel_reason = 'host_cancelled'
--     where lobby_visibility = 'public' and cancelled_at is null and not coalesce(is_complete, false)
--       and (turn_order is null or jsonb_typeof(turn_order) <> 'array' or jsonb_array_length(turn_order) = 0)
--       and not exists (select 1 from public.draft_participants p
--                       where p.draft_id = drafts.id and p.user_id is not null and p.last_seen_at > now() - interval '1 day');
--
-- Replaces two functions (referee_sweep_quick_match and referee_sweep_tables) with the same functions minus the
-- closing rules. They keep returning the same answer (the 'cancelled' count is simply 0 for unscheduled lobbies), so
-- the scheduled job that reads it keeps working. No tables, columns or data change. Safe to run twice.
-- Run after 20261116100000_host_controls.sql.
-- ============================================================

-- ── Quick Play lobbies ───────────────────────────────────────
-- As in 20261116100000_host_controls.sql, except the "everyone has been gone for 3 minutes: close the lobby" step
-- is gone.
CREATE OR REPLACE FUNCTION public.referee_sweep_quick_match()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d           public.drafts%ROWTYPE;
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

    -- (No timer closes an empty lobby any more: it waits for the next player.)
  END LOOP;

  -- ready_checks stays in the answer (always 0) so the scheduled job that reads it keeps working.
  RETURN jsonb_build_object('started', n_started, 'ready_checks', 0, 'cancelled', n_cancelled, 'handoffs', n_handoffs);
END;
$$;

-- ── Open games a player set up ───────────────────────────────
-- As in 20261114100000_one_draft_hosting.sql, except a game WITHOUT a start time is never cancelled because its host
-- has been away: the role still moves to someone who is here, otherwise the game waits. A game WITH a start time
-- still cancels when its host never shows, as before.
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
      ELSIF d.scheduled_start_at IS NOT NULL THEN
        -- A game with a start time cancels when its host never shows (the host chose that deadline).
        UPDATE public.drafts SET cancelled_at = now(), cancel_reason = 'host_no_show' WHERE id = d.id;
        FOREACH v_uid IN ARRAY public._human_user_ids(d.id) LOOP
          PERFORM public._notify(v_uid, 'table_cancelled', 'The table was cancelled',
            d.title || ': the host didn''t start the draft.', '/play', d.id, '{}'::jsonb);
        END LOOP;
        n_cancelled := n_cancelled + 1;
      END IF;
      -- A game with no start time simply keeps waiting for the next player.
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'started', n_started, 'reminded', n_reminded, 'nudged', n_nudged,
    'handoffs', n_handoffs, 'cancelled', n_cancelled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.referee_sweep_quick_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referee_sweep_tables() FROM PUBLIC, anon, authenticated;
