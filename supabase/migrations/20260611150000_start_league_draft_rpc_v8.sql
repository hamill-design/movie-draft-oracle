-- v8: fix three data-correctness issues reported after a scheduled draft's
-- room was successfully opened for the first time (v5-v7 fixed the crashes,
-- but nobody had seen the *resulting* draft row until now):
--
-- 1. drafts.theme was set to the raw league_drafts.draft_type
--    ('filmography' | 'people' | 'year' | 'spec-draft'), but
--    LeagueDraftCard's title/photo logic only recognizes
--    'people' | 'year' | 'spec-draft' on drafts.theme. A 'filmography'
--    draft therefore fell through to a generic title ("League Draft") and
--    showed no actor photo. Now mapped via the same
--    filmography→people normalization start_league_draft_rpc_v2 used.
--
-- 2. drafts.title fell back to the league_draft's optional "notes" or the
--    literal 'League Draft'. Now also falls back to league_drafts.theme
--    (e.g. "Steven Spielberg" / "1990s") before that literal, so drafts
--    get a meaningful title even when no note was written.
--
-- 3. Non-admin members were pre-joined into draft_participants with
--    status='joined', making the draft room lobby show "all players are
--    in" before anyone but the admin had actually opened it. Changed to
--    'invited' (the column's normal default for not-yet-arrived
--    participants) — see the companion load_draft_unified update, which
--    flips a participant's own row to 'joined' the moment they load the
--    draft.
CREATE OR REPLACE FUNCTION public.start_league_scheduled_draft(p_entry_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry             public.league_drafts%ROWTYPE;
  v_draft_id          UUID;
  v_admin_name        TEXT;
  v_categories        TEXT[];
  v_participant_names TEXT[];
  v_drafts_theme      TEXT;
  v_title             TEXT;
BEGIN
  -- 1. Load the league_drafts row
  SELECT * INTO v_entry
  FROM public.league_drafts
  WHERE id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'League draft entry not found: %', p_entry_id;
  END IF;

  -- 2. Caller must be league admin
  IF NOT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = v_entry.league_id
      AND user_id    = auth.uid()
      AND role       = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only a league admin can start a scheduled draft';
  END IF;

  -- 3. Draft must not already be open
  IF v_entry.draft_id IS NOT NULL THEN
    RETURN v_entry.draft_id;
  END IF;

  -- 4. Resolve admin display name
  SELECT COALESCE(p.name, au.email, 'Admin') INTO v_admin_name
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id = auth.uid();

  -- 5. Build categories
  v_categories := COALESCE(v_entry.categories, ARRAY[]::TEXT[]);

  -- 5a. Normalize draft_type into the theme values LeagueDraftCard (and the
  --     rest of the draft UI) understand: 'people' | 'year' | 'spec-draft'.
  v_drafts_theme := CASE v_entry.draft_type
    WHEN 'filmography' THEN 'people'
    WHEN 'people'      THEN 'people'
    WHEN 'year'        THEN 'year'
    WHEN 'spec-draft'  THEN 'spec-draft'
    ELSE 'people'
  END;

  -- 5b. Title: admin's note, else the scheduled draft's specific theme value
  --     (actor name / year / spec-draft id), else a generic fallback.
  v_title := COALESCE(NULLIF(v_entry.notes, ''), NULLIF(v_entry.theme, ''), 'League Draft');

  -- 5c. Build the participant name list for drafts.participants (NOT NULL).
  --     Same membership rule as the draft_participants inserts below: the
  --     admin, plus either the specifically-selected members (player_ids)
  --     or every league member if none were selected.
  SELECT array_agg(COALESCE(p.name, 'Player') ORDER BY lm.joined_at)
  INTO v_participant_names
  FROM public.league_members lm
  LEFT JOIN public.profiles p ON p.id = lm.user_id
  WHERE lm.league_id = v_entry.league_id
    AND (
      lm.user_id = auth.uid()
      OR v_entry.player_ids IS NULL
      OR cardinality(v_entry.player_ids) = 0
      OR lm.user_id = ANY(v_entry.player_ids)
    );

  v_participant_names := COALESCE(v_participant_names, ARRAY[v_admin_name]);

  IF v_entry.is_multiplayer THEN
    -- ── Multiplayer path ──────────────────────────────────────────────────────
    -- 5d. Create the draft row
    INSERT INTO public.drafts (
      user_id, title, theme, option, categories, participants,
      is_multiplayer, created_at
    )
    VALUES (
      auth.uid(),
      v_title,
      v_drafts_theme,
      COALESCE(v_entry.theme, ''),
      v_categories,
      v_participant_names,
      TRUE,
      now()
    )
    RETURNING id INTO v_draft_id;

    -- 5e. Pre-join admin as host — admin is here right now, so 'joined'.
    INSERT INTO public.draft_participants (
      draft_id, user_id, participant_name, status, is_host, is_ai, joined_at
    ) VALUES (
      v_draft_id, auth.uid(), v_admin_name, 'joined', TRUE, FALSE, now()
    );

    -- 5f. Pre-join all selected non-admin members as 'invited' — they can
    --     already navigate straight to /draft/:id (can_access_draft only
    --     checks that a draft_participants row with their user_id exists,
    --     not its status), and load_draft_unified flips them to 'joined'
    --     the first time they actually open the draft.
    --     FIX: use cardinality() instead of array_length() — cardinality returns 0
    --     for empty arrays, whereas array_length returns NULL, which breaks = 0 checks.
    INSERT INTO public.draft_participants (
      draft_id, user_id, participant_name, status, is_host, is_ai, joined_at
    )
    SELECT
      v_draft_id,
      lm.user_id,
      COALESCE(p.name, 'Player'),
      'invited',
      FALSE,
      FALSE,
      now()
    FROM public.league_members lm
    LEFT JOIN public.profiles p ON p.id = lm.user_id
    WHERE lm.league_id = v_entry.league_id
      AND lm.user_id  != auth.uid()
      AND (
        -- No specific selection (null or empty array) → invite everyone
        (v_entry.player_ids IS NULL OR cardinality(v_entry.player_ids) = 0)
        OR
        -- Specific selection → only invite listed members
        lm.user_id = ANY(v_entry.player_ids)
      );

  ELSE
    -- ── Local / single-player path ────────────────────────────────────────────
    INSERT INTO public.drafts (
      user_id, title, theme, option, categories, participants,
      is_multiplayer, created_at
    )
    VALUES (
      auth.uid(),
      v_title,
      v_drafts_theme,
      COALESCE(v_entry.theme, ''),
      v_categories,
      v_participant_names,
      FALSE,
      now()
    )
    RETURNING id INTO v_draft_id;
  END IF;

  -- 6. Link draft back to the league_drafts row
  UPDATE public.league_drafts
  SET draft_id = v_draft_id
  WHERE id = p_entry_id;

  RETURN v_draft_id;
END;
$$;
