-- ============================================================
-- PUBLIC TABLE WRITE GUARDS  (Phase 2 of docs/public-matchmaking-plan.md)
--
-- Today a signed-in player can edit their own draft, participant and pick rows
-- straight through the API. That is harmless in a private game with friends, but
-- it would let someone cheat a public or ranked game: flip a draft to "public",
-- make themselves host, stretch the clock, or forge a pick.
--
-- These triggers close that for PUBLIC tables only. Private drafts, single-player
-- drafts and every existing flow are untouched.
--
--   - Direct writes from the app's own users (database roles `authenticated` and
--     `anon`) are refused on public tables. The game's own functions (they run with
--     the function owner's rights) and the server (service role) are not affected.
--   - Nobody may enter a public table except through join_public_table() /
--     create_public_table(). That also shuts the invite-code route, whose functions
--     would otherwise bypass seat limits, blocks and bans.
--   - A player cannot turn a private draft into a public or rated one.
--
-- Run AFTER 20261105110000_public_tables.sql.
-- ============================================================

-- ── Drafts ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_public_draft_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  -- The only columns a player may still change on a public table (voting setup after the draft).
  v_ok text[] := ARRAY['updated_at', 'voting_ends_at', 'allow_public_voting', 'is_public'];
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.lobby_visibility <> 'private' OR NEW.match_source <> 'private' OR NEW.rated OR NEW.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Public tables can only be created from the Play page';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.lobby_visibility = 'public' THEN
      RAISE EXCEPTION 'A public table cannot be deleted. Cancel it from the table instead.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF NEW.lobby_visibility IS DISTINCT FROM OLD.lobby_visibility
     OR NEW.match_source IS DISTINCT FROM OLD.match_source
     OR NEW.rated IS DISTINCT FROM OLD.rated THEN
    RAISE EXCEPTION 'Public play settings can only be changed from the Play page';
  END IF;

  IF OLD.lobby_visibility = 'public'
     AND (to_jsonb(NEW) - v_ok) IS DISTINCT FROM (to_jsonb(OLD) - v_ok) THEN
    RAISE EXCEPTION 'This table is run by the game. Use the buttons in the table instead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_public_draft_writes ON public.drafts;
CREATE TRIGGER trg_guard_public_draft_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.guard_public_draft_writes();

-- ── Participants ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_public_participant_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_draft uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.draft_id ELSE NEW.draft_id END;
BEGIN
  IF NOT public.draft_is_public(v_draft) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Bots are added by the game. People only get in through join_public_table().
    IF NOT COALESCE(NEW.is_ai, false) AND current_setting('app.public_seat', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'Join public tables from the Play page';
    END IF;
    RETURN NEW;
  END IF;

  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'This table is run by the game. Use the buttons in the table instead.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_public_participant_writes ON public.draft_participants;
CREATE TRIGGER trg_guard_public_participant_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.draft_participants
  FOR EACH ROW EXECUTE FUNCTION public.guard_public_participant_writes();

-- ── Picks ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_public_pick_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_draft uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.draft_id ELSE NEW.draft_id END;
BEGIN
  IF current_user IN ('authenticated', 'anon') AND public.draft_is_public(v_draft) THEN
    RAISE EXCEPTION 'Picks in a public draft can only be made with the pick buttons';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_public_pick_writes ON public.draft_picks;
CREATE TRIGGER trg_guard_public_pick_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.draft_picks
  FOR EACH ROW EXECUTE FUNCTION public.guard_public_pick_writes();
