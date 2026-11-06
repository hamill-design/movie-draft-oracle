-- ============================================================
-- RANKED RESULTS, POINTS AND THE LEADERBOARD  (Phase 4 of docs/public-matchmaking-plan.md)
--
-- When a RATED public draft finishes, the server scores it and awards points:
--
--   - Scores come from the same place the Final Scores page uses (draft_picks.calculated_score,
--     filled in by the existing enrich-movie-data function). A finished game waits until every
--     pick has a score; after 48 hours without scores it is voided (nobody is ranked unfairly).
--   - Only REAL players are ranked. Bots never count.
--   - IDLE-ACCOUNT GUARD: you must make at least HALF of your own picks yourself to count.
--     Players who didn't are left out of the ranking entirely, so a strong auto-pick can never
--     take a place from someone who actually played.
--   - It takes 2+ qualifying players for any points to be awarded.
--   - Points by finish (among qualifying players): 1st 10, 2nd 7, 3rd 5, 4th 3, 5th 2, 6th 1.
--     Ties share a place.
--   - WIN-FARMING GUARD: if you keep playing the same opponent, points shrink: after 2 earlier
--     rated games together in the last 7 days they halve (x0.5); after 5, they quarter (x0.25).
--   - Repeatedly not playing your own picks (3 games in a week) earns a 1-day break.
--
-- Run AFTER 20261106100000_quick_match.sql.
-- ============================================================

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS results_status text,
  ADD COLUMN IF NOT EXISTS results_pending_since timestamptz,
  ADD COLUMN IF NOT EXISTS results_finalized_at timestamptz;

ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_results_status_check;
ALTER TABLE public.drafts ADD CONSTRAINT drafts_results_status_check
  CHECK (results_status IS NULL OR results_status IN ('pending', 'final', 'void'));

CREATE TABLE IF NOT EXISTS public.draft_results (
  draft_id    uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  raw_score   numeric NOT NULL DEFAULT 0,
  own_picks   integer NOT NULL DEFAULT 0,
  total_picks integer NOT NULL DEFAULT 0,
  eligible    boolean NOT NULL DEFAULT false,
  final_rank  integer,
  base_points numeric(6, 2) NOT NULL DEFAULT 0,
  multiplier  numeric(4, 2) NOT NULL DEFAULT 1,
  points      numeric(6, 2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_draft_results_user ON public.draft_results (user_id);
ALTER TABLE public.draft_results ENABLE ROW LEVEL SECURITY;  -- no policies: read through the functions below

-- ── A finished rated draft starts waiting for scores ─────────

CREATE OR REPLACE FUNCTION public.mark_results_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_complete AND NOT COALESCE(OLD.is_complete, false)
     AND NEW.rated AND NEW.lobby_visibility = 'public' AND NEW.results_status IS NULL THEN
    NEW.results_status := 'pending';
    NEW.results_pending_since := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_results_pending ON public.drafts;
CREATE TRIGGER trg_mark_results_pending
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW
  WHEN (NEW.is_complete AND NEW.rated)
  EXECUTE FUNCTION public.mark_results_pending();

-- New notification type
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%draft_invite%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'draft_invite', 'league_invite', 'upcoming_draft', 'your_turn',
    'table_starts_soon', 'time_to_start', 'schedule_changed', 'you_are_host',
    'table_cancelled', 'removed_from_table', 'match_found', 'results_ready'
  )) NOT VALID;

-- ── Per-player numbers for a finished draft (service role) ───

CREATE OR REPLACE FUNCTION public._draft_human_stats(p_draft uuid)
RETURNS TABLE(user_id uuid, name text, raw_score numeric, total_picks integer, own_picks integer, eligible boolean, final_rank integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH humans AS (
    SELECT dp.user_id AS uid, dp.participant_name AS pname
    FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft AND dp.user_id IS NOT NULL AND NOT COALESCE(dp.is_ai, false)
  ),
  stats AS (
    SELECT h.uid,
           h.pname,
           COALESCE(sum(pk.calculated_score), 0) AS score,
           count(pk.id)::integer AS total,
           (count(pk.id) FILTER (WHERE pk.pick_source = 'player'))::integer AS own
    FROM humans h
    LEFT JOIN public.draft_picks pk ON pk.draft_id = p_draft AND pk.player_name = h.pname
    GROUP BY h.uid, h.pname
  ),
  flagged AS (
    -- At least HALF of your own picks made by you.
    SELECT s.*, (s.total > 0 AND s.own * 2 >= s.total) AS ok FROM stats s
  )
  SELECT f.uid, f.pname, f.score, f.total, f.own, f.ok,
         CASE WHEN f.ok THEN (rank() OVER (PARTITION BY f.ok ORDER BY f.score DESC))::integer END
  FROM flagged f;
$$;

-- Finished rated drafts that still need scores or results (service role).
CREATE OR REPLACE FUNCTION public.referee_list_unscored_drafts(p_limit integer DEFAULT 5)
RETURNS TABLE(draft_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id FROM public.drafts d
  WHERE d.results_status = 'pending'
  ORDER BY d.results_pending_since ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20));
$$;

-- The distinct movies in this draft that don't have a score yet (service role).
CREATE OR REPLACE FUNCTION public.referee_pending_scores(p_draft uuid)
RETURNS TABLE(movie_id integer, movie_title text, movie_year integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT pk.movie_id, pk.movie_title, pk.movie_year
  FROM public.draft_picks pk
  WHERE pk.draft_id = p_draft AND pk.calculated_score IS NULL;
$$;

-- ── Work out the results (service role) ──────────────────────

CREATE OR REPLACE FUNCTION public.finalize_draft_results(p_draft uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d          public.drafts%ROWTYPE;
  r          record;
  v_enough   boolean;
  v_status   text;
  v_base     numeric;
  v_mult     numeric;
  v_prior    integer;
  v_idle     integer;
  v_points   numeric;
  v_body     text;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id = p_draft FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF d.results_status IN ('final', 'void') THEN
    RETURN jsonb_build_object('status', 'already_' || d.results_status);
  END IF;
  IF d.results_status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('status', 'not_rated');
  END IF;

  -- Wait for every pick to have a score. If they never arrive, void the game rather than rank unfairly.
  IF EXISTS (SELECT 1 FROM public.draft_picks pk WHERE pk.draft_id = p_draft AND pk.calculated_score IS NULL) THEN
    IF d.results_pending_since < now() - interval '48 hours' THEN
      UPDATE public.drafts SET results_status = 'void', results_finalized_at = now() WHERE id = p_draft;
      RETURN jsonb_build_object('status', 'void', 'reason', 'no_scores');
    END IF;
    RETURN jsonb_build_object('status', 'waiting');
  END IF;

  SELECT count(*) >= 2 INTO v_enough FROM public._draft_human_stats(p_draft) s WHERE s.eligible;
  v_status := CASE WHEN v_enough THEN 'final' ELSE 'void' END;

  UPDATE public.drafts SET results_status = v_status, results_finalized_at = now() WHERE id = p_draft;

  FOR r IN SELECT * FROM public._draft_human_stats(p_draft) LOOP
    v_base := 0;
    v_mult := 1;
    IF v_enough AND r.eligible THEN
      v_base := CASE r.final_rank WHEN 1 THEN 10 WHEN 2 THEN 7 WHEN 3 THEN 5 WHEN 4 THEN 3 WHEN 5 THEN 2 ELSE 1 END;

      -- Win-farming guard: the most games this player has already shared with any one of today's
      -- opponents, in the last 7 days.
      SELECT COALESCE(max(g.c), 0) INTO v_prior FROM (
        SELECT count(*)::integer AS c
        FROM public.draft_results a
        JOIN public.draft_results o ON o.draft_id = a.draft_id AND o.user_id <> a.user_id
        JOIN public.drafts dd ON dd.id = a.draft_id
        WHERE a.user_id = r.user_id
          AND o.user_id IN (SELECT s.user_id FROM public._draft_human_stats(p_draft) s)
          AND dd.results_status = 'final'
          AND dd.results_finalized_at > now() - interval '7 days'
          AND dd.id <> p_draft
        GROUP BY o.user_id
      ) g;
      v_mult := CASE WHEN v_prior <= 2 THEN 1 WHEN v_prior <= 5 THEN 0.5 ELSE 0.25 END;
    END IF;
    v_points := round(v_base * v_mult, 2);

    INSERT INTO public.draft_results
      (draft_id, user_id, raw_score, own_picks, total_picks, eligible, final_rank, base_points, multiplier, points)
    VALUES
      (p_draft, r.user_id, r.raw_score, r.own_picks, r.total_picks, r.eligible,
       CASE WHEN v_enough THEN r.final_rank END, v_base, v_mult, v_points)
    ON CONFLICT (draft_id, user_id) DO NOTHING;

    -- Not playing your own picks, again and again, earns a short break.
    IF NOT r.eligible THEN
      SELECT count(*)::integer INTO v_idle
      FROM public.draft_results x
      JOIN public.drafts dd ON dd.id = x.draft_id
      WHERE x.user_id = r.user_id AND NOT x.eligible AND dd.results_finalized_at > now() - interval '7 days';
      IF v_idle >= 3 THEN
        UPDATE public.profiles
        SET public_play_cooldown_until = GREATEST(COALESCE(public_play_cooldown_until, now()), now() + interval '1 day')
        WHERE id = r.user_id;
      END IF;
    END IF;

    v_body := CASE
      WHEN v_points > 0 THEN 'You earned ' || trim(trailing '.' FROM trim(trailing '0' FROM v_points::text)) || ' points.'
      WHEN NOT r.eligible THEN 'No points: you made fewer than half of your own picks.'
      WHEN NOT v_enough THEN 'No points this time: too few players made their own picks.'
      ELSE 'No points this time.'
    END;
    PERFORM public._notify(r.user_id, 'results_ready', 'Your results are in', d.title || ': ' || v_body,
      '/final-scores/' || p_draft::text, p_draft, jsonb_build_object('points', v_points));
  END LOOP;

  RETURN jsonb_build_object('status', v_status);
END;
$$;

-- ── Reading results (signed-in players) ──────────────────────

CREATE OR REPLACE FUNCTION public.get_draft_results(p_draft uuid)
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
  SELECT * INTO d FROM public.drafts WHERE id = p_draft;
  IF NOT FOUND OR d.lobby_visibility <> 'public' THEN RAISE EXCEPTION 'Results not found'; END IF;

  RETURN jsonb_build_object(
    'draft_id', d.id,
    'rated', d.rated,
    'status', COALESCE(d.results_status, CASE WHEN d.rated THEN 'in_progress' ELSE 'unrated' END),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', r.user_id,
        'name', COALESCE(p.public_name, 'Player'),
        'avatar_url', p.avatar_url,
        'rank', r.final_rank,
        'raw_score', r.raw_score,
        'points', r.points,
        'multiplier', r.multiplier,
        'eligible', r.eligible,
        'own_picks', r.own_picks,
        'total_picks', r.total_picks,
        'is_me', r.user_id = v_uid
      ) ORDER BY r.final_rank NULLS LAST, r.raw_score DESC)
      FROM public.draft_results r
      LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.draft_id = d.id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_scope text DEFAULT 'quarter', p_limit integer DEFAULT 50)
RETURNS TABLE(rank bigint, user_id uuid, public_name text, avatar_url text, points numeric, rated_games bigint, wins bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_public_play(false);
  RETURN QUERY
  WITH agg AS (
    SELECT r.user_id AS uid,
           sum(r.points) AS pts,
           (count(*) FILTER (WHERE r.eligible)) AS games,
           (count(*) FILTER (WHERE r.final_rank = 1)) AS win_count
    FROM public.draft_results r
    JOIN public.drafts dd ON dd.id = r.draft_id
    WHERE dd.results_status = 'final'
      AND (p_scope = 'all'
           OR (dd.results_finalized_at >= date_trunc('quarter', now())
               AND dd.results_finalized_at < date_trunc('quarter', now()) + interval '3 months'))
    GROUP BY r.user_id
  )
  SELECT (rank() OVER (ORDER BY a.pts DESC, a.win_count DESC, a.games ASC))::bigint,
         a.uid, pr.public_name, pr.avatar_url, a.pts, a.games, a.win_count
  FROM agg a
  JOIN public.profiles pr ON pr.id = a.uid
  WHERE pr.public_name IS NOT NULL
    AND a.games > 0
    AND NOT (pr.is_banned AND (pr.banned_until IS NULL OR pr.banned_until > now()))
  ORDER BY 1, pr.public_name
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;

-- Where am I on the board (even if outside the top 50)?
CREATE OR REPLACE FUNCTION public.get_my_standing(p_scope text DEFAULT 'quarter')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._assert_public_play(false);
  v_row record;
  v_total bigint;
BEGIN
  SELECT * INTO v_row FROM public.get_leaderboard(p_scope, 200) l WHERE l.user_id = v_uid;
  SELECT count(*) INTO v_total FROM public.get_leaderboard(p_scope, 200);
  IF v_row.user_id IS NULL THEN
    RETURN jsonb_build_object('ranked', false, 'players', v_total);
  END IF;
  RETURN jsonb_build_object('ranked', true, 'rank', v_row.rank, 'points', v_row.points,
                            'rated_games', v_row.rated_games, 'wins', v_row.wins, 'players', v_total);
END;
$$;

-- Hover card: names, avatar and play stats only. Never an email or a real name.
CREATE OR REPLACE FUNCTION public.get_player_card(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p        public.profiles%ROWTYPE;
  v_games  bigint;
  v_wins   bigint;
  v_all    numeric;
  v_qtr    numeric;
  v_public bigint;
  v_picks  bigint;
  v_auto   bigint;
BEGIN
  PERFORM public._assert_public_play(false);
  SELECT * INTO p FROM public.profiles WHERE id = p_user;
  IF NOT FOUND OR p.public_name IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;

  SELECT count(*) FILTER (WHERE r.eligible), count(*) FILTER (WHERE r.final_rank = 1),
         COALESCE(sum(r.points), 0),
         COALESCE(sum(r.points) FILTER (WHERE dd.results_finalized_at >= date_trunc('quarter', now())
                                          AND dd.results_finalized_at < date_trunc('quarter', now()) + interval '3 months'), 0)
    INTO v_games, v_wins, v_all, v_qtr
  FROM public.draft_results r
  JOIN public.drafts dd ON dd.id = r.draft_id
  WHERE r.user_id = p_user AND dd.results_status = 'final';

  SELECT count(DISTINCT dp.draft_id) INTO v_public
  FROM public.draft_participants dp
  JOIN public.drafts d ON d.id = dp.draft_id
  WHERE dp.user_id = p_user AND d.lobby_visibility = 'public' AND COALESCE(d.is_complete, false);

  SELECT count(pk.id), count(pk.id) FILTER (WHERE pk.pick_source = 'auto') INTO v_picks, v_auto
  FROM public.draft_participants dp
  JOIN public.drafts d ON d.id = dp.draft_id AND d.lobby_visibility = 'public' AND COALESCE(d.is_complete, false)
  JOIN public.draft_picks pk ON pk.draft_id = dp.draft_id AND pk.player_name = dp.participant_name
  WHERE dp.user_id = p_user;

  RETURN jsonb_build_object(
    'user_id', p.id,
    'public_name', p.public_name,
    'avatar_url', p.avatar_url,
    'rated_games', v_games,
    'wins', v_wins,
    'points_all_time', v_all,
    'points_this_quarter', v_qtr,
    'public_games', v_public,
    'reliability', CASE WHEN v_picks = 0 THEN 100 ELSE round(100.0 * (1 - v_auto::numeric / v_picks)) END
  );
END;
$$;

-- ── Permissions ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public._draft_human_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referee_list_unscored_drafts(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referee_pending_scores(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_draft_results(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._draft_human_stats(uuid), public.referee_list_unscored_drafts(integer),
  public.referee_pending_scores(uuid), public.finalize_draft_results(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_draft_results(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_leaderboard(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_standing(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_player_card(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_draft_results(uuid), public.get_leaderboard(text, integer),
  public.get_my_standing(text), public.get_player_card(uuid) TO authenticated, service_role;
