-- ============================================================
-- THE HOMEPAGE LIST SHOWS EVERY PUBLIC GAME THAT IS WAITING FOR PLAYERS
--
-- Until now the homepage "Open games" list only showed games a player had set to "Open to the public"
-- (how it was created = 'open'). A Quick Play lobby is also a public game waiting for players, but it never
-- appeared, so a homepage with someone sitting in a lobby still said "Nobody's waiting yet".
--
-- Now it lists every game that is public, still gathering players and has a free seat, whoever made it:
--   - Quick Play lobbies,
--   - games a player set to Open to the public,
--   - anything else marked public.
-- Private drafts (invite only) never appear, and neither do full, counting-down, started or cancelled games.
--
-- Two small changes ride along:
--   - the host is looked up on the side, so a public game that has no host at this moment (a hand-over in
--     progress) is still listed instead of silently dropping out,
--   - each row now says how the game was made (match_source), so the card can say "Quick Play".
--
-- Joining is unchanged: the Join button already calls join_public_table(), which accepts any public game.
--
-- A function's columns can't be changed in place, so this drops it and creates it again (same name, same
-- single argument, same permissions: signed-out visitors may call it, and it still follows the public-play
-- switch). Nothing else calls it.
--
-- Run AFTER 20261117100000_join_public_by_code.sql.
-- ============================================================

DROP FUNCTION IF EXISTS public.list_open_games_preview(integer);

CREATE FUNCTION public.list_open_games_preview(p_limit integer DEFAULT 12)
RETURNS TABLE(
  draft_id uuid, title text, theme text, option text,
  table_size integer, joined_count integer, seats_open integer,
  host_name text, pick_clock_seconds integer, speed text,
  scheduled_start_at timestamptz, rated boolean, created_at timestamptz, i_joined boolean,
  match_source text
)
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
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.id, d.title, d.theme, d.option,
         d.table_size,
         (SELECT count(*)::integer FROM public.draft_participants x WHERE x.draft_id = d.id),
         GREATEST(d.table_size - (SELECT count(*)::integer FROM public.draft_participants x WHERE x.draft_id = d.id), 0),
         hp.public_name,
         d.pick_clock_seconds,
         CASE WHEN d.pick_clock_seconds <= 120 THEN 'live' ELSE 'slow' END,
         d.scheduled_start_at, d.rated, d.created_at,
         (v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.draft_participants m WHERE m.draft_id = d.id AND m.user_id = v_uid)),
         d.match_source
  FROM public.drafts d
  LEFT JOIN LATERAL (
    SELECT x.user_id FROM public.draft_participants x
    WHERE x.draft_id = d.id AND x.is_host
    ORDER BY x.joined_at NULLS LAST, x.created_at
    LIMIT 1
  ) h ON true
  LEFT JOIN public.profiles hp ON hp.id = h.user_id
  WHERE d.lobby_visibility = 'public'
    AND public._table_status(d) = 'forming'
    AND (d.ready_check_expires_at IS NULL OR d.ready_check_expires_at <= now())
    AND (SELECT count(*) FROM public.draft_participants x WHERE x.draft_id = d.id) < d.table_size
    AND NOT (v_uid IS NOT NULL AND h.user_id IS NOT NULL AND public._blocked_between(v_uid, h.user_id))
  ORDER BY (d.pick_clock_seconds <= 120) DESC, COALESCE(d.scheduled_start_at, d.created_at) ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50));
END;
$$;

REVOKE ALL ON FUNCTION public.list_open_games_preview(integer) FROM PUBLIC;
-- The one function signed-out visitors may call (it returns names only, never emails or user ids).
GRANT EXECUTE ON FUNCTION public.list_open_games_preview(integer) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
