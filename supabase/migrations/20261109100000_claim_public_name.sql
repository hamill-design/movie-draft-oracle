-- ============================================================
-- USE THE SETTINGS NAME FOR PUBLIC PLAY
-- (follow-up to Phase 1 of docs/public-matchmaking-plan.md)
--
-- Players already have a display name in their settings (profiles.name). Public play used to ask
-- for a second "player name". Now the first time someone uses public play we take the name from
-- their settings automatically, cleaned up to fit the public-name rules, and only ask when we can't.
--
--   claim_public_name()   If the caller has no public name yet, makes one from profiles.name:
--                         - accents are simplified (Jose, not Jos) and anything else that isn't a letter,
--                           number, space, dot, dash or underscore is dropped (an apostrophe: Tim Allens Nose)
--                         - names over 20 characters are cut at a word where possible
--                         - if the name is taken, a number is added (Pat Jones 2, Pat Jones 3 ...)
--                         - names that look like an email address or a link, or that fail the word filter,
--                           are NOT used, and an email address is never used as a fallback
--                         Returns {public_name, claimed} on success, or {public_name: null, reason} when the
--                         person needs to choose a name themselves. Calling it again changes nothing.
--
-- The claimed name does not use up the "change once a day" allowance, so the player can still
-- pick a different one straight away.
--
-- Run AFTER 20261108100000_open_games.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_public_name()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_raw     text;
  v_base    text;
  v_cut     text;
  v_pos     integer;
  v_cand    text;
  v_suffix  text;
  v_problem text;
  v_i       integer := 1;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to play public games';
  END IF;
  -- Same door as everything else: switch on, not suspended. (A name is exactly what we're about to make.)
  PERFORM public._assert_public_play(false);

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Already have one: leave it alone.
  IF v_profile.public_name IS NOT NULL THEN
    RETURN jsonb_build_object('public_name', v_profile.public_name, 'claimed', false);
  END IF;

  v_raw := btrim(COALESCE(v_profile.name, ''));
  IF length(v_raw) < 3 THEN
    RETURN jsonb_build_object('public_name', NULL,
      'reason', 'You haven''t set a name in your settings yet. Choose the name other players will see.');
  END IF;

  -- An email address or link typed into the settings name is never made public.
  v_problem := public._name_problem(v_raw, v_uid);
  IF v_problem IS NOT NULL THEN
    RETURN jsonb_build_object('public_name', NULL,
      'reason', 'We can''t use the name in your settings (' || lower(v_problem) || '). Choose the name other players will see.');
  END IF;

  -- Clean it up: simplify accents, drop what the public-name rules don't allow, tidy the spaces and ends.
  v_base := translate(v_raw,
    'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC');
  v_base := regexp_replace(v_base, '[^A-Za-z0-9 ._-]', '', 'g');
  v_base := btrim(regexp_replace(v_base, '\s+', ' ', 'g'));
  v_base := regexp_replace(v_base, '^[^A-Za-z0-9]+|[^A-Za-z0-9]+$', '', 'g');

  -- Too long: cut at the last space within 20 characters when that keeps a sensible amount, else cut hard.
  IF length(v_base) > 20 THEN
    v_cut := left(v_base, 20);
    IF substr(v_base, 21, 1) <> ' ' AND strpos(v_cut, ' ') > 0 THEN
      v_pos := length(v_cut) - strpos(reverse(v_cut), ' ') + 1;   -- where the last space is
      IF v_pos >= 9 THEN
        v_cut := left(v_cut, v_pos - 1);
      END IF;
    END IF;
    v_base := regexp_replace(btrim(v_cut), '[^A-Za-z0-9]+$', '', 'g');
  END IF;

  IF length(v_base) < 3 OR v_base !~ '^[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]$' THEN
    RETURN jsonb_build_object('public_name', NULL,
      'reason', 'We can''t use the name in your settings. Choose the name other players will see.');
  END IF;

  v_problem := public._name_problem(v_base, v_uid);
  IF v_problem IS NOT NULL THEN
    RETURN jsonb_build_object('public_name', NULL,
      'reason', 'We can''t use the name in your settings (' || lower(v_problem) || '). Choose the name other players will see.');
  END IF;

  -- Take it; if someone has it already, add a number.
  v_cand := v_base;
  LOOP
    BEGIN
      UPDATE public.profiles
      SET public_name = v_cand, public_name_changed_at = NULL   -- NULL: this doesn't use up the daily change
      WHERE id = v_uid;
      RETURN jsonb_build_object('public_name', v_cand, 'claimed', true);
    EXCEPTION WHEN unique_violation THEN
      v_i := v_i + 1;
      IF v_i > 50 THEN
        RETURN jsonb_build_object('public_name', NULL,
          'reason', 'Your name is already taken by other players. Choose the name other players will see.');
      END IF;
      v_suffix := ' ' || v_i::text;
      v_cand := regexp_replace(btrim(left(v_base, 20 - length(v_suffix))), '[^A-Za-z0-9]+$', '', 'g') || v_suffix;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_public_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_public_name() TO authenticated, service_role;
