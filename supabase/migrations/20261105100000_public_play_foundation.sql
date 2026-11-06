-- ============================================================
-- PUBLIC PLAY FOUNDATION  (Phase 2 of docs/public-matchmaking-plan.md)
--
-- The safety layer that must exist BEFORE strangers can play each other:
--   1. A database-enforced on/off switch for public play
--        'off' | 'admin_only' (default) | 'on'
--      Nobody but the admin can use public features until you set it to 'on'.
--   2. Public display names that players CHOOSE (never an email, never
--      derived from one), with a bad-word filter and uniqueness
--   3. Block, report, and ban
--   4. Rate limiting
--   5. A notification helper and the new notification types
--
-- SAFE ROLLOUT: inert until the second migration (public tables) is applied
-- and the switch is turned on. Run AFTER 20261104121000_*.sql.
-- ============================================================

-- ── 1. The switch ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.public_play_settings (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  mode       text NOT NULL DEFAULT 'admin_only' CHECK (mode IN ('off', 'admin_only', 'on')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.public_play_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
-- RLS on with no policies: only the functions below (and the service role) can touch it.
ALTER TABLE public.public_play_settings ENABLE ROW LEVEL SECURITY;

-- The admin account. Keep in sync with ADMIN_EMAIL in src/hooks/useAdminAccess.ts.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public._current_auth_email() = 'contact@roberthamill.design', false);
$$;

CREATE OR REPLACE FUNCTION public.set_public_play_mode(p_mode text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_mode NOT IN ('off', 'admin_only', 'on') THEN
    RAISE EXCEPTION 'Mode must be off, admin_only or on';
  END IF;
  UPDATE public.public_play_settings SET mode = p_mode, updated_at = now() WHERE id;
  RETURN p_mode;
END;
$$;

-- ── 2. Profile columns: public name, bans ────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_name text,
  ADD COLUMN IF NOT EXISTS public_name_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS public_play_cooldown_until timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_name_unique
  ON public.profiles (lower(public_name))
  WHERE public_name IS NOT NULL;

-- ── Name rules ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocked_name_terms (
  term       text PRIMARY KEY,
  whole_word boolean NOT NULL DEFAULT false
);
ALTER TABLE public.blocked_name_terms ENABLE ROW LEVEL SECURITY;

-- STARTER LIST ONLY. Extend it (or swap in a maintained list) before opening public play widely;
-- the report button is the safety net for whatever it misses.
INSERT INTO public.blocked_name_terms (term, whole_word) VALUES
  ('fuck', false), ('shit', false), ('bitch', false), ('cunt', false), ('whore', false),
  ('nazi', false), ('hitler', false), ('rapist', false), ('porn', false), ('admin', false),
  ('moderator', false), ('moviedrafter', false),
  ('ass', true), ('dick', true), ('cock', true), ('tit', true), ('sex', true)
ON CONFLICT (term) DO NOTHING;

-- Lowercase, undo common look-alikes (0->o, 1->i, 3->e, 4->a, 5->s, 7->t, @->a, $->s, !->i), keep letters only.
CREATE OR REPLACE FUNCTION public._normalize_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(translate(lower(COALESCE(p_name, '')), '013457@$!', 'oieastasi'), '[^a-z]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public._name_problem(p_name text, p_user uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm   text := public._normalize_name(p_name);
  v_email  text;
  v_local  text;
  v_word   text;
  v_term   record;
BEGIN
  IF p_name ~ '@' OR p_name ~* '\.(com|net|org|io|co)\M' OR p_name ~* 'https?:' THEN
    RETURN 'Names cannot look like an email address or a link';
  END IF;

  -- Never let a name be the start of someone's own email address.
  SELECT lower(email) INTO v_email FROM public.profiles WHERE id = p_user;
  IF v_email IS NOT NULL THEN
    v_local := public._normalize_name(split_part(v_email, '@', 1));
    IF length(v_local) >= 4 AND v_norm = v_local THEN
      RETURN 'Please choose a name that is not your email address';
    END IF;
  END IF;

  FOR v_term IN SELECT term, whole_word FROM public.blocked_name_terms LOOP
    IF v_term.whole_word THEN
      FOREACH v_word IN ARRAY regexp_split_to_array(lower(regexp_replace(p_name, '[^A-Za-z0-9]+', ' ', 'g')), ' ') LOOP
        IF public._normalize_name(v_word) = v_term.term THEN
          RETURN 'That name is not allowed';
        END IF;
      END LOOP;
    ELSIF position(v_term.term IN v_norm) > 0 THEN
      RETURN 'That name is not allowed';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- A player chooses their public name once; it can be changed once a day.
CREATE OR REPLACE FUNCTION public.set_public_name(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_name    text := btrim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g'));
  v_problem text;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to choose a display name';
  END IF;
  IF length(v_name) < 3 OR length(v_name) > 20 THEN
    RAISE EXCEPTION 'Your display name must be 3 to 20 characters';
  END IF;
  IF v_name !~ '^[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]$' THEN
    RAISE EXCEPTION 'Use letters, numbers, spaces, dots, dashes or underscores only';
  END IF;

  v_problem := public._name_problem(v_name, v_uid);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF v_profile.public_name IS NOT NULL
     AND lower(v_profile.public_name) <> lower(v_name)
     AND v_profile.public_name_changed_at > now() - interval '1 day' THEN
    RAISE EXCEPTION 'You can change your display name once a day';
  END IF;

  BEGIN
    UPDATE public.profiles
    SET public_name = v_name, public_name_changed_at = now()
    WHERE id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That name is already taken';
  END;

  RETURN jsonb_build_object('public_name', v_name);
END;
$$;

-- Only the safe fields of other players: never an email or a real name.
CREATE OR REPLACE FUNCTION public.get_public_profiles(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, public_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.public_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY (COALESCE(p_user_ids, ARRAY[]::uuid[]))
    AND p.public_name IS NOT NULL
  LIMIT 200;
$$;

-- ── Is this person allowed in? ───────────────────────────────

-- Raises a plain-English reason if the caller may not use public play.
-- p_need_name = false lets people BROWSE before they have chosen a display name.
CREATE OR REPLACE FUNCTION public._assert_public_play(p_need_name boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_mode    text;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to play public games';
  END IF;

  SELECT mode INTO v_mode FROM public.public_play_settings WHERE id;
  IF COALESCE(v_mode, 'off') = 'off'
     OR (v_mode = 'admin_only' AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Public play is not open yet';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF v_profile.is_banned AND (v_profile.banned_until IS NULL OR v_profile.banned_until > now()) THEN
    RAISE EXCEPTION 'Your account is suspended from public play%',
      CASE WHEN v_profile.banned_until IS NOT NULL THEN ' until ' || to_char(v_profile.banned_until, 'Mon DD') ELSE '' END;
  END IF;
  IF p_need_name THEN
    IF v_profile.public_play_cooldown_until IS NOT NULL AND v_profile.public_play_cooldown_until > now() THEN
      RAISE EXCEPTION 'You are on a short break from public play (back %)',
        to_char(v_profile.public_play_cooldown_until, 'Mon DD HH24:MI');
    END IF;
    IF v_profile.public_name IS NULL THEN
      RAISE EXCEPTION 'Choose a display name first';
    END IF;
  END IF;

  RETURN v_uid;
END;
$$;

-- What the app needs to decide what to show. Safe for signed-out callers.
CREATE OR REPLACE FUNCTION public.public_play_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_mode    text;
  v_profile public.profiles%ROWTYPE;
  v_open    boolean;
  v_banned  boolean := false;
BEGIN
  SELECT mode INTO v_mode FROM public.public_play_settings WHERE id;
  v_mode := COALESCE(v_mode, 'off');
  v_open := v_mode = 'on' OR (v_mode = 'admin_only' AND public.is_admin());

  IF v_uid IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
    v_banned := COALESCE(v_profile.is_banned, false)
      AND (v_profile.banned_until IS NULL OR v_profile.banned_until > now());
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'available', v_open,
    'signed_in', v_uid IS NOT NULL,
    'is_admin', public.is_admin(),
    'has_public_name', v_profile.public_name IS NOT NULL,
    'public_name', v_profile.public_name,
    'banned', v_banned,
    'banned_until', CASE WHEN v_banned THEN v_profile.banned_until ELSE NULL END,
    'cooldown_until', CASE WHEN v_profile.public_play_cooldown_until > now() THEN v_profile.public_play_cooldown_until ELSE NULL END
  );
END;
$$;

-- ── 3. Rate limiting ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.public_play_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL,
  kind       text NOT NULL,
  draft_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_public_play_events_user_kind
  ON public.public_play_events (user_id, kind, created_at DESC);
ALTER TABLE public.public_play_events ENABLE ROW LEVEL SECURITY;

-- Counts this person's recent events of one kind; refuses if over the limit, otherwise records one.
CREATE OR REPLACE FUNCTION public._rate_limit(p_user uuid, p_kind text, p_max integer, p_window interval, p_message text, p_draft uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.public_play_events e
  WHERE e.user_id = p_user AND e.kind = p_kind AND e.created_at > now() - p_window;
  IF v_count >= p_max THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
  INSERT INTO public.public_play_events (user_id, kind, draft_id) VALUES (p_user, p_kind, p_draft);
END;
$$;

-- ── 4. Blocks and reports ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.player_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players see their own blocks" ON public.player_blocks;
CREATE POLICY "Players see their own blocks" ON public.player_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.player_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id    uuid,
  reason      text NOT NULL CHECK (reason IN ('abusive_name', 'cheating', 'harassment', 'spam', 'other')),
  details     text CHECK (details IS NULL OR length(details) <= 500),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'warned', 'banned')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (reporter_id <> reported_id)
);
CREATE INDEX IF NOT EXISTS idx_player_reports_open ON public.player_reports (created_at DESC) WHERE status = 'open';
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;  -- no policies: RPC only

CREATE OR REPLACE FUNCTION public._blocked_between(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_blocks b
    WHERE (b.blocker_id = p_a AND b.blocked_id = p_b) OR (b.blocker_id = p_b AND b.blocked_id = p_a)
  );
$$;

CREATE OR REPLACE FUNCTION public.block_player(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_user IS NULL OR p_user = auth.uid() THEN RAISE EXCEPTION 'You cannot block yourself'; END IF;
  INSERT INTO public.player_blocks (blocker_id, blocked_id) VALUES (auth.uid(), p_user)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_player(p_user uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.player_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_user;
$$;

CREATE OR REPLACE FUNCTION public.my_blocks()
RETURNS TABLE(user_id uuid, public_name text, blocked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.blocked_id, p.public_name, b.created_at
  FROM public.player_blocks b
  LEFT JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_player(p_reported uuid, p_draft uuid, p_reason text, p_details text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_reported IS NULL OR p_reported = v_uid THEN RAISE EXCEPTION 'You cannot report yourself'; END IF;
  IF p_reason NOT IN ('abusive_name', 'cheating', 'harassment', 'spam', 'other') THEN
    RAISE EXCEPTION 'Choose a reason for the report';
  END IF;

  -- Same person, same table, same day: already reported.
  IF EXISTS (
    SELECT 1 FROM public.player_reports r
    WHERE r.reporter_id = v_uid AND r.reported_id = p_reported
      AND r.draft_id IS NOT DISTINCT FROM p_draft
      AND r.created_at > now() - interval '1 day'
  ) THEN
    RETURN;
  END IF;

  PERFORM public._rate_limit(v_uid, 'report', 10, interval '1 day', 'You have sent a lot of reports today. Please try again tomorrow.');

  INSERT INTO public.player_reports (reporter_id, reported_id, draft_id, reason, details)
  VALUES (v_uid, p_reported, p_draft, p_reason, NULLIF(btrim(p_details), ''));
END;
$$;

-- Admin tools (the admin account only).
CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT 'open', p_limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid, created_at timestamptz, status text, reason text, details text, draft_id uuid,
  reporter_id uuid, reporter_name text, reported_id uuid, reported_name text,
  reported_is_banned boolean, reports_against_total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
  SELECT r.id, r.created_at, r.status, r.reason, r.details, r.draft_id,
         r.reporter_id, rp.public_name, r.reported_id, dp.public_name,
         COALESCE(dp.is_banned, false),
         (SELECT count(*) FROM public.player_reports x WHERE x.reported_id = r.reported_id)
  FROM public.player_reports r
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.profiles dp ON dp.id = r.reported_id
  WHERE (p_status IS NULL OR r.status = p_status)
  ORDER BY r.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;

-- action: 'dismissed' | 'warned' | 'banned'.  p_ban_days NULL with 'banned' = permanent.
CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report uuid, p_action text, p_ban_days integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.player_reports%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_action NOT IN ('dismissed', 'warned', 'banned') THEN
    RAISE EXCEPTION 'Action must be dismissed, warned or banned';
  END IF;
  SELECT * INTO v_report FROM public.player_reports WHERE id = p_report FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;

  UPDATE public.player_reports SET status = p_action, resolved_at = now() WHERE id = p_report;

  IF p_action = 'banned' THEN
    UPDATE public.profiles
    SET is_banned = true,
        banned_until = CASE WHEN p_ban_days IS NULL THEN NULL ELSE now() + make_interval(days => p_ban_days) END,
        ban_reason = v_report.reason
    WHERE id = v_report.reported_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.profiles SET is_banned = false, banned_until = NULL, ban_reason = NULL WHERE id = p_user;
END;
$$;

-- ── 5. Notifications: new types + a helper that can never break the caller ─

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
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
    'table_cancelled', 'removed_from_table', 'match_found'
  )) NOT VALID;

CREATE OR REPLACE FUNCTION public._notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_ref uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, reference_id, metadata)
  VALUES (p_user, p_type, p_title, p_body, p_link, p_ref, COALESCE(p_metadata, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_notify(%) failed (action unaffected): %', p_type, SQLERRM;
END;
$$;

-- ── Permissions ──────────────────────────────────────────────

REVOKE ALL ON FUNCTION public._notify(uuid, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._rate_limit(uuid, text, integer, interval, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._assert_public_play(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._name_problem(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._blocked_between(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._notify(uuid, text, text, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._rate_limit(uuid, text, integer, interval, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._assert_public_play(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public._name_problem(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._blocked_between(uuid, uuid) TO service_role;

-- Everything except the read-only status is for signed-in players only (not signed-out guests).
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_public_play_mode(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_public_name(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.block_player(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unblock_player(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_blocks() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_player(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_reports(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unban(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.public_play_status() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_public_play_mode(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_public_name(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_player(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unblock_player(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_blocks() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_player(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unban(uuid) TO authenticated, service_role;
