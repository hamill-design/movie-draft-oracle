-- ============================================================
-- QUICK PLAY PICKS ITS CATEGORIES
--
-- Every Quick Play lobby used to get the same five categories whatever it was drafting, and Wild Card took
-- a slot that players actually give to Blockbuster (the real-usage ranking across private drafts is Drama/Romance,
-- Action/Adventure, Academy Award, Blockbuster, Comedy, Sci-Fi/Fantasy, Horror/Thriller). Now each new lobby
-- gets five categories chosen by rule, and the lobby screen lists them.
--
--   A year       4 of the 7 most-played categories, chosen at random, so lobbies differ. Any year has plenty of
--                movies in all of them.
--   An actor     A filmography is smaller, so the three broad genres every career has (Drama/Romance,
--                Action/Adventure, Comedy) plus one of Academy Award / Blockbuster, chosen at random.
--   A special draft  keeps the categories it has always had (they come from the draft itself).
--
-- Wild Card is always the last of the five, so there is always one slot that can't get stuck.
--
-- Run AFTER 20261111100000_quick_play_lobby.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public._quick_categories(p_kind text)
RETURNS text[]
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_pick text[];
BEGIN
  IF p_kind = 'year' THEN
    -- Listed in the order players use them most; the 4 chosen keep that order.
    SELECT array_agg(s.c ORDER BY s.ord) INTO v_pick
    FROM (
      SELECT b.c, b.ord
      FROM unnest(ARRAY[
        'Drama/Romance', 'Action/Adventure', 'Academy Award Nominee or Winner', 'Blockbuster (minimum of $50 Mil)',
        'Comedy', 'Sci-Fi/Fantasy', 'Horror/Thriller'
      ]) WITH ORDINALITY AS b(c, ord)
      ORDER BY random()
      LIMIT 4
    ) s;
  ELSIF p_kind = 'actor' THEN
    v_pick := ARRAY['Drama/Romance', 'Action/Adventure', 'Comedy',
      (ARRAY['Academy Award Nominee or Winner', 'Blockbuster (minimum of $50 Mil)'])[1 + floor(random() * 2)::integer]];
  ELSE
    RETURN NULL;   -- special drafts keep their own categories
  END IF;
  RETURN v_pick || ARRAY['Wild Card'];
END;
$$;

-- Quick Start, as before, except the lobby's categories come from the rule above (special drafts keep theirs).
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
    quick_pool_id, fill_deadline_at
  ) VALUES (
    NULL, v_entry.label, v_entry.theme, v_entry.option, COALESCE(public._quick_categories(v_entry.kind), v_entry.categories),
    ARRAY[]::text[], true, public.generate_invite_code(),
    'public', 'quick', 4, 90, true, true,
    v_entry.id, now() + interval '40 seconds'
  ) RETURNING id INTO v_draft;

  PERFORM public._quick_seat(v_draft, v_uid, true);

  RETURN jsonb_build_object('draft_id', v_draft, 'status', 'forming', 'created', true, 'joined', 1, 'already_in', false);
END;
$$;

REVOKE ALL ON FUNCTION public._quick_categories(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._quick_categories(text) TO service_role;
REVOKE ALL ON FUNCTION public.quick_start() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_start() TO authenticated, service_role;
