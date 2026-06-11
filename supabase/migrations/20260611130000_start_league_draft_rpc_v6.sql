-- v6: fix 'column "status" of relation "drafts" does not exist', and add
-- the required "participants" value.
--
-- After v5 removed the bad draft_settings/v_settings code, the function
-- got one step further and hit the next leftover bug: both INSERT INTO
-- public.drafts statements set a "status" column that has never existed on
-- "drafts" (the table tracks completion via the boolean "is_complete",
-- which already defaults to false). That made every "Open Draft Room"
-- click fail with:
--   column "status" of relation "drafts" does not exist
--
-- While fixing that, also noticed "drafts.participants" (text[]) is
-- NOT NULL with no default, and neither INSERT supplied it — which would
-- have caused the *next* error ("null value in column participants
-- violates not-null constraint") once "status" was fixed. This version
-- builds v_participant_names (the admin plus whichever members are
-- selected for the draft, or everyone if none are specifically selected —
-- the same membership rule already used for draft_participants below) and
-- supplies it for both the multiplayer and single-player paths.
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

  -- 5a. Build the participant name list for drafts.participants (NOT NULL).
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
    -- 5b. Create the draft row
    INSERT INTO public.drafts (
      user_id, title, theme, option, categories, participants,
      is_multiplayer, created_at
    )
    VALUES (
      auth.uid(),
      COALESCE(v_entry.title, 'League Draft'),
      v_entry.draft_type,
      COALESCE(v_entry.theme, ''),
      v_categories,
      v_participant_names,
      TRUE,
      now()
    )
    RETURNING id INTO v_draft_id;

    -- 5c. Pre-join admin as host
    INSERT INTO public.draft_participants (
      draft_id, user_id, participant_name, status, is_host, is_ai, joined_at
    ) VALUES (
      v_draft_id, auth.uid(), v_admin_name, 'joined', TRUE, FALSE, now()
    );

    -- 5d. Pre-join all selected non-admin members
    --     FIX: use cardinality() instead of array_length() — cardinality returns 0
    --     for empty arrays, whereas array_length returns NULL, which breaks = 0 checks.
    INSERT INTO public.draft_participants (
      draft_id, user_id, participant_name, status, is_host, is_ai, joined_at
    )
    SELECT
      v_draft_id,
      lm.user_id,
      COALESCE(p.name, 'Player'),
      'joined',
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
      COALESCE(v_entry.title, 'League Draft'),
      v_entry.draft_type,
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
