-- ============================================================
-- REFEREE FOUNDATION  (Phase 1 of docs/public-matchmaking-plan.md)
--
-- Adds a server-side pick clock and the plumbing for auto-picks and
-- bot picks that do NOT depend on anyone's browser.
--
-- SAFE ROLLOUT: this migration is INERT. Every existing draft keeps
-- referee_enabled = false and behaves exactly as before. A draft only
-- gets the clock after its owner calls set_draft_referee() before the
-- draft starts.
--
-- It deliberately does NOT redefine make_multiplayer_pick_unified or
-- the start functions. The referee attaches through triggers on
-- drafts / draft_picks, and through new functions.
--
-- Pieces:
--   1. New columns (clock, deadline, claim, pick source, strikes)
--   2. Trigger: set the turn deadline whenever the turn changes
--   3. Triggers on draft_picks: label bot picks, block stale picks,
--      reset a player's strikes when they pick for themselves
--   4. set_draft_referee()   - owner turns the referee/clock on (pre-start)
--   5. get_draft_clock()     - what the draft screen needs to show a countdown
--   6. referee_claim_turn()  - service role: atomically claim an overdue turn
--   7. referee_apply_pick()  - service role: make the auto/bot pick
--   8. referee_list_overdue_drafts() - service role: for the scheduled sweep
-- ============================================================

-- ── 1. Columns ───────────────────────────────────────────────

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS referee_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pick_clock_seconds integer,
  ADD COLUMN IF NOT EXISTS current_turn_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS referee_claim_until timestamptz;

ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_pick_clock_range;
ALTER TABLE public.drafts
  ADD CONSTRAINT drafts_pick_clock_range
  CHECK (pick_clock_seconds IS NULL OR pick_clock_seconds BETWEEN 30 AND 86400);

ALTER TABLE public.draft_picks
  ADD COLUMN IF NOT EXISTS pick_source text NOT NULL DEFAULT 'player';

ALTER TABLE public.draft_picks DROP CONSTRAINT IF EXISTS draft_picks_pick_source_check;
ALTER TABLE public.draft_picks
  ADD CONSTRAINT draft_picks_pick_source_check
  CHECK (pick_source IN ('player', 'auto', 'bot'));

ALTER TABLE public.draft_participants
  ADD COLUMN IF NOT EXISTS auto_pick_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_auto_picks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_away boolean NOT NULL DEFAULT false;

-- Makes "which drafts are overdue right now?" cheap for the sweep.
CREATE INDEX IF NOT EXISTS idx_drafts_referee_deadline
  ON public.drafts (current_turn_deadline_at)
  WHERE referee_enabled AND current_turn_deadline_at IS NOT NULL;

-- ── 2. Deadline trigger ──────────────────────────────────────
-- Whenever the turn moves on (or the draft starts) on a referee-enabled
-- draft, work out when that turn expires:
--   bot turn   -> 3 seconds ("thinking" time)
--   Away human -> 5 seconds (already used up their patience)
--   human      -> the draft's pick clock, or no deadline if it has none

CREATE OR REPLACE FUNCTION public.referee_set_turn_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_ai   boolean := false;
  v_is_away boolean := false;
BEGIN
  IF COALESCE(NEW.is_complete, false) OR NEW.current_turn_participant_id IS NULL THEN
    NEW.current_turn_deadline_at := NULL;
    NEW.referee_claim_until := NULL;
    RETURN NEW;
  END IF;

  -- Same turn as before (e.g. only the claim marker changed): keep the deadline.
  IF OLD.referee_enabled
     AND NOT COALESCE(OLD.is_complete, false)
     AND OLD.current_pick_number IS NOT DISTINCT FROM NEW.current_pick_number
     AND OLD.current_turn_participant_id IS NOT DISTINCT FROM NEW.current_turn_participant_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(dp.is_ai, false), COALESCE(dp.is_away, false)
    INTO v_is_ai, v_is_away
  FROM public.draft_participants dp
  WHERE dp.draft_id = NEW.id
    AND COALESCE(dp.user_id, dp.guest_participant_id, dp.id) = NEW.current_turn_participant_id
  LIMIT 1;

  NEW.referee_claim_until := NULL;

  IF v_is_ai THEN
    NEW.current_turn_deadline_at := clock_timestamp() + interval '3 seconds';
  ELSIF v_is_away THEN
    NEW.current_turn_deadline_at := clock_timestamp() + interval '5 seconds';
  ELSIF NEW.pick_clock_seconds IS NOT NULL THEN
    NEW.current_turn_deadline_at := clock_timestamp() + make_interval(secs => NEW.pick_clock_seconds);
  ELSE
    NEW.current_turn_deadline_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referee_set_turn_deadline ON public.drafts;
CREATE TRIGGER trg_referee_set_turn_deadline
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW
  WHEN (NEW.referee_enabled)
  EXECUTE FUNCTION public.referee_set_turn_deadline();

-- ── 3. Triggers on draft_picks ───────────────────────────────

-- 3a. BEFORE INSERT: label bot picks, and on referee drafts refuse a pick that
-- arrives after its turn was already resolved (a human clicking just as the
-- clock ran out). Locking the draft row makes the two attempts take turns.
CREATE OR REPLACE FUNCTION public.referee_prepare_pick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled  boolean;
  v_complete boolean;
  v_current  integer;
BEGIN
  -- Bots picking through the old host-browser path are still bots.
  IF NEW.pick_source = 'player' AND EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = NEW.draft_id
      AND dp.participant_name = NEW.player_name
      AND COALESCE(dp.is_ai, false)
  ) THEN
    NEW.pick_source := 'bot';
  END IF;

  SELECT d.referee_enabled, COALESCE(d.is_complete, false), d.current_pick_number
    INTO v_enabled, v_complete, v_current
  FROM public.drafts d
  WHERE d.id = NEW.draft_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_enabled THEN
    RETURN NEW;
  END IF;

  IF v_complete THEN
    RAISE EXCEPTION 'This draft is already complete';
  END IF;

  IF NEW.pick_order IS DISTINCT FROM v_current THEN
    RAISE EXCEPTION 'This turn was already resolved. Refresh to see the latest pick.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referee_prepare_pick ON public.draft_picks;
CREATE TRIGGER trg_referee_prepare_pick
  BEFORE INSERT ON public.draft_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.referee_prepare_pick();

-- 3b. AFTER INSERT: a pick the player made themselves clears their strikes
-- and their Away flag.
CREATE OR REPLACE FUNCTION public.referee_reset_strikes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pick_source = 'player' THEN
    UPDATE public.draft_participants dp
    SET consecutive_auto_picks = 0,
        is_away = false
    WHERE dp.draft_id = NEW.draft_id
      AND dp.participant_name = NEW.player_name
      AND NOT COALESCE(dp.is_ai, false)
      AND (dp.consecutive_auto_picks <> 0 OR dp.is_away)
      AND EXISTS (SELECT 1 FROM public.drafts d WHERE d.id = NEW.draft_id AND d.referee_enabled);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referee_reset_strikes ON public.draft_picks;
CREATE TRIGGER trg_referee_reset_strikes
  AFTER INSERT ON public.draft_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.referee_reset_strikes();

-- ── 4. set_draft_referee ─────────────────────────────────────
-- The draft owner switches the referee (and optionally a pick clock) on or off.
-- Only before the draft starts, so the clock can never change mid-game.

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

-- ── 5. get_draft_clock ───────────────────────────────────────
-- Everything the draft screen needs to draw the countdown, Away badges and
-- "auto-picked" tags. Includes the SERVER's time so a wrong phone clock
-- can't make the countdown lie.

CREATE OR REPLACE FUNCTION public.get_draft_clock(
  p_draft_id uuid,
  p_participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.drafts%ROWTYPE;
BEGIN
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_draft FROM public.drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  RETURN jsonb_build_object(
    'referee_enabled', v_draft.referee_enabled,
    'pick_clock_seconds', v_draft.pick_clock_seconds,
    'deadline_at', v_draft.current_turn_deadline_at,
    'server_now', clock_timestamp(),
    'participants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'participant_id', COALESCE(dp.user_id, dp.guest_participant_id, dp.id),
        'is_away', dp.is_away,
        'auto_pick_count', dp.auto_pick_count
      ))
      FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id
    ), '[]'::jsonb),
    'pick_sources', COALESCE((
      SELECT jsonb_object_agg(pk.pick_order::text, pk.pick_source)
      FROM public.draft_picks pk
      WHERE pk.draft_id = p_draft_id AND pk.pick_source <> 'player'
    ), '{}'::jsonb)
  );
END;
$$;

-- ── 6. referee_claim_turn  (service role only) ───────────────
-- Atomically claims an overdue turn so only ONE caller resolves it, and
-- hands back what the picker needs to choose a movie.

CREATE OR REPLACE FUNCTION public.referee_claim_turn(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft     public.drafts%ROWTYPE;
  v_part      public.draft_participants%ROWTYPE;
  v_now       timestamptz := clock_timestamp();
  v_player_id integer;
  v_open      text[];
  v_picked    integer[];
BEGIN
  SELECT * INTO v_draft FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_found');
  END IF;
  IF NOT v_draft.referee_enabled THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'referee_disabled');
  END IF;
  IF COALESCE(v_draft.is_complete, false) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'complete');
  END IF;
  IF v_draft.current_turn_deadline_at IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_deadline');
  END IF;
  IF v_draft.current_turn_deadline_at > v_now THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_overdue');
  END IF;
  IF v_draft.referee_claim_until IS NOT NULL AND v_draft.referee_claim_until > v_now THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'claim_in_progress');
  END IF;

  SELECT dp.* INTO v_part
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id
    AND COALESCE(dp.user_id, dp.guest_participant_id, dp.id) = v_draft.current_turn_participant_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'participant_not_found');
  END IF;

  SELECT t.n INTO v_player_id
  FROM (
    SELECT dp.id, row_number() OVER (ORDER BY dp.created_at ASC NULLS LAST, dp.id ASC) AS n
    FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id
  ) t
  WHERE t.id = v_part.id;

  SELECT COALESCE(array_agg(u.c ORDER BY u.ord), ARRAY[]::text[]) INTO v_open
  FROM unnest(COALESCE(v_draft.categories, ARRAY[]::text[])) WITH ORDINALITY AS u(c, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.draft_picks pk
    WHERE pk.draft_id = p_draft_id
      AND pk.player_name = v_part.participant_name
      AND pk.category = u.c
  );

  SELECT COALESCE(array_agg(pk.movie_id), ARRAY[]::integer[]) INTO v_picked
  FROM public.draft_picks pk
  WHERE pk.draft_id = p_draft_id;

  UPDATE public.drafts
  SET referee_claim_until = v_now + interval '45 seconds'
  WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'claimed', true,
    'pick_number', v_draft.current_pick_number,
    'is_bot', COALESCE(v_part.is_ai, false),
    'participant', jsonb_build_object(
      'row_id', v_part.id,
      'name', v_part.participant_name,
      'is_ai', COALESCE(v_part.is_ai, false),
      'is_away', COALESCE(v_part.is_away, false),
      'player_id', v_player_id
    ),
    'draft', jsonb_build_object(
      'theme', v_draft.theme,
      'option', v_draft.option,
      'categories', to_jsonb(COALESCE(v_draft.categories, ARRAY[]::text[]))
    ),
    'open_categories', to_jsonb(v_open),
    'picked_movie_ids', to_jsonb(v_picked)
  );
END;
$$;

-- ── 7. referee_apply_pick  (service role only) ───────────────
-- Makes the auto-pick / bot pick for the overdue turn. Mirrors the turn
-- bookkeeping in make_multiplayer_pick_unified (kept separate so we don't touch
-- that live function); the test suite checks the two stay equivalent.
-- Safe to call twice: the second call finds the turn already resolved.

CREATE OR REPLACE FUNCTION public.referee_apply_pick(
  p_draft_id uuid,
  p_expected_pick_number integer,
  p_movie_id integer,
  p_movie_title text,
  p_movie_year integer,
  p_movie_genre text,
  p_category text,
  p_poster_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft        public.drafts%ROWTYPE;
  v_part         public.draft_participants%ROWTYPE;
  v_player_id    integer;
  v_is_bot       boolean;
  v_next_pick    integer;
  v_next_turn    uuid;
  v_total_picks  integer;
  v_part_count   integer;
  v_complete     boolean := false;
BEGIN
  SELECT * INTO v_draft FROM public.drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_found');
  END IF;
  IF NOT v_draft.referee_enabled THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'referee_disabled');
  END IF;
  IF COALESCE(v_draft.is_complete, false) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'complete');
  END IF;
  IF v_draft.current_pick_number IS DISTINCT FROM p_expected_pick_number THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'turn_already_resolved');
  END IF;
  IF v_draft.current_turn_deadline_at IS NULL OR v_draft.current_turn_deadline_at > clock_timestamp() THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_overdue');
  END IF;

  SELECT dp.* INTO v_part
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id
    AND COALESCE(dp.user_id, dp.guest_participant_id, dp.id) = v_draft.current_turn_participant_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'participant_not_found');
  END IF;
  v_is_bot := COALESCE(v_part.is_ai, false);

  SELECT t.n INTO v_player_id
  FROM (
    SELECT dp.id, row_number() OVER (ORDER BY dp.created_at ASC NULLS LAST, dp.id ASC) AS n
    FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id
  ) t
  WHERE t.id = v_part.id;

  BEGIN
    INSERT INTO public.draft_picks (
      draft_id, player_id, player_name, movie_id, movie_title, movie_year,
      movie_genre, category, pick_order, poster_path, pick_source
    ) VALUES (
      p_draft_id, v_player_id, v_part.participant_name, p_movie_id, p_movie_title, p_movie_year,
      p_movie_genre, p_category, v_draft.current_pick_number, p_poster_path,
      CASE WHEN v_is_bot THEN 'bot' ELSE 'auto' END
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'duplicate_movie');
  END;

  -- A human who let the clock run out gets a strike; two in a row marks them Away.
  IF NOT v_is_bot THEN
    UPDATE public.draft_participants
    SET auto_pick_count = auto_pick_count + 1,
        consecutive_auto_picks = consecutive_auto_picks + 1,
        is_away = (consecutive_auto_picks + 1) >= 2
    WHERE id = v_part.id;
  END IF;

  v_next_pick := v_draft.current_pick_number + 1;

  SELECT COUNT(*) INTO v_part_count
  FROM public.draft_participants WHERE draft_id = p_draft_id;
  v_total_picks := v_part_count * COALESCE(array_length(v_draft.categories, 1), 0);

  IF v_next_pick > v_total_picks THEN
    v_complete := true;
    v_next_turn := NULL;
  ELSE
    SELECT COALESCE((e->>'participant_id')::uuid, (e->>'user_id')::uuid)
      INTO v_next_turn
    FROM jsonb_array_elements(v_draft.turn_order) AS e
    WHERE (e->>'pick_number')::integer = v_next_pick;
  END IF;

  -- The deadline trigger sets the next turn's deadline (or clears it when complete).
  UPDATE public.drafts
  SET current_pick_number = v_next_pick,
      current_turn_user_id = v_next_turn,
      current_turn_participant_id = v_next_turn,
      is_complete = v_complete,
      referee_claim_until = NULL,
      updated_at = now()
  WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'applied', true,
    'pick_number', v_draft.current_pick_number,
    'source', CASE WHEN v_is_bot THEN 'bot' ELSE 'auto' END,
    'next_turn_participant_id', v_next_turn,
    'is_complete', v_complete
  );
END;
$$;

-- ── 8. referee_list_overdue_drafts  (service role only) ──────
-- For the scheduled sweep: which referee drafts have an expired turn that
-- nobody is currently handling?

CREATE OR REPLACE FUNCTION public.referee_list_overdue_drafts(p_limit integer DEFAULT 50)
RETURNS TABLE(draft_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.drafts d
  WHERE d.referee_enabled
    AND NOT COALESCE(d.is_complete, false)
    AND d.current_turn_deadline_at IS NOT NULL
    AND d.current_turn_deadline_at <= clock_timestamp()
    AND (d.referee_claim_until IS NULL OR d.referee_claim_until <= clock_timestamp())
  ORDER BY d.current_turn_deadline_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

-- ── Permissions ──────────────────────────────────────────────
-- The three referee_* functions can act on any draft, so only the server
-- (service role, used by the referee edge function) may call them.

REVOKE ALL ON FUNCTION public.referee_claim_turn(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referee_apply_pick(uuid, integer, integer, text, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referee_list_overdue_drafts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referee_claim_turn(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.referee_apply_pick(uuid, integer, integer, text, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referee_list_overdue_drafts(integer) TO service_role;

-- Players (and guests, via their participant id) call these two.
GRANT EXECUTE ON FUNCTION public.set_draft_referee(uuid, uuid, boolean, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_draft_clock(uuid, uuid) TO anon, authenticated, service_role;
