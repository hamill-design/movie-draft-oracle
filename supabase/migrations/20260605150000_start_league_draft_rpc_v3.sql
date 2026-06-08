-- ============================================================
-- start_league_scheduled_draft v3
--
-- Key fix: pre-join ALL selected player_ids members into
-- draft_participants so they can access /draft/:id without
-- needing an invite code.  The /draft/:id page IS the waiting
-- room — members arrive, see the lobby, and the admin clicks
-- "Start Draft" once everyone has loaded in.
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_league_scheduled_draft(
  p_entry_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry          public.league_drafts%ROWTYPE;
  v_league_admin   UUID;
  v_draft_id       UUID;
  v_invite_code    TEXT;
  v_theme          TEXT;
  v_option         TEXT;
  v_title          TEXT;
  v_member_names   TEXT[];
BEGIN
  -- ── 1. Fetch the scheduled entry ──────────────────────────────────────────
  SELECT * INTO v_entry
  FROM public.league_drafts
  WHERE id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled draft entry not found: %', p_entry_id;
  END IF;

  IF v_entry.draft_id IS NOT NULL THEN
    -- Draft already opened — return existing draft id
    RETURN v_entry.draft_id;
  END IF;

  -- ── 2. Verify caller is the league admin ──────────────────────────────────
  SELECT admin_id INTO v_league_admin
  FROM public.leagues
  WHERE id = v_entry.league_id;

  IF auth.uid() IS NULL OR auth.uid() != v_league_admin THEN
    RAISE EXCEPTION 'Only the league admin can open a scheduled draft';
  END IF;

  -- ── 3. Map draft_type → drafts.theme ──────────────────────────────────────
  v_theme := CASE v_entry.draft_type
    WHEN 'filmography' THEN 'people'
    WHEN 'people'      THEN 'people'
    WHEN 'year'        THEN 'year'
    WHEN 'spec-draft'  THEN 'spec-draft'
    ELSE 'people'
  END;

  v_option := COALESCE(v_entry.theme, '');

  -- For spec-draft, look up a human-readable title
  IF v_entry.draft_type = 'spec-draft' AND v_entry.theme IS NOT NULL THEN
    SELECT name INTO v_title
    FROM public.spec_drafts
    WHERE id = v_entry.theme::uuid
    LIMIT 1;
  END IF;

  v_title := COALESCE(v_title, v_option, v_entry.draft_type, 'Draft');

  -- ── 4. Collect participant display names ──────────────────────────────────
  -- If player_ids is non-empty, use only those members; otherwise use all.
  IF v_entry.player_ids IS NOT NULL AND array_length(v_entry.player_ids, 1) > 0 THEN
    SELECT array_agg(COALESCE(p.name, 'Player') ORDER BY lm.joined_at)
    INTO v_member_names
    FROM public.league_members lm
    LEFT JOIN public.profiles p ON p.id = lm.user_id
    WHERE lm.league_id = v_entry.league_id
      AND lm.user_id = ANY(v_entry.player_ids);
  ELSE
    SELECT array_agg(COALESCE(p.name, 'Player') ORDER BY lm.joined_at)
    INTO v_member_names
    FROM public.league_members lm
    LEFT JOIN public.profiles p ON p.id = lm.user_id
    WHERE lm.league_id = v_entry.league_id;
  END IF;

  v_member_names := COALESCE(v_member_names, ARRAY[]::TEXT[]);

  -- ── 5. Create the draft ───────────────────────────────────────────────────
  IF v_entry.is_multiplayer THEN
    v_invite_code := public.generate_invite_code();

    INSERT INTO public.drafts (
      user_id, title, theme, option, categories, participants,
      is_multiplayer, invite_code
    ) VALUES (
      auth.uid(),
      v_title,
      v_theme,
      v_option,
      COALESCE(v_entry.categories, ARRAY[]::TEXT[]),
      v_member_names,
      TRUE,
      v_invite_code
    )
    RETURNING id INTO v_draft_id;

    -- ── 5a. Add the admin as host participant ─────────────────────────────
    INSERT INTO public.draft_participants (
      draft_id, user_id, participant_name,
      status, is_host, is_ai, joined_at
    )
    SELECT v_draft_id, auth.uid(), COALESCE(p.name, 'Host'),
           'joined', TRUE, FALSE, now()
    FROM public.profiles p WHERE p.id = auth.uid()
    LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO public.draft_participants (
        draft_id, user_id, participant_name, status, is_host, is_ai, joined_at
      ) VALUES (v_draft_id, auth.uid(), 'Host', 'joined', TRUE, FALSE, now());
    END IF;

    -- ── 5b. Pre-join all selected non-admin members ───────────────────────
    -- This is the critical fix: all player_ids members are added with
    -- status='joined' so they can navigate to /draft/:id without an
    -- invite code and see the waiting room.
    INSERT INTO public.draft_participants (
      draft_id, user_id, participant_name,
      status, is_host, is_ai, joined_at
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
      AND lm.user_id != auth.uid()   -- exclude admin (already added as host)
      AND (
        -- if player_ids is set, only include those members
        (
          v_entry.player_ids IS NOT NULL
          AND array_length(v_entry.player_ids, 1) > 0
          AND lm.user_id = ANY(v_entry.player_ids)
        )
        OR
        -- if player_ids is empty/null, include all league members
        (
          v_entry.player_ids IS NULL
          OR array_length(v_entry.player_ids, 1) = 0
        )
      );

  ELSE
    -- Local (non-multiplayer) draft — no participant records needed
    INSERT INTO public.drafts (
      user_id, title, theme, option, categories, participants, is_multiplayer
    ) VALUES (
      auth.uid(),
      v_title,
      v_theme,
      v_option,
      COALESCE(v_entry.categories, ARRAY[]::TEXT[]),
      v_member_names,
      FALSE
    )
    RETURNING id INTO v_draft_id;
  END IF;

  -- ── 6. Link the new draft to the scheduled entry ──────────────────────────
  UPDATE public.league_drafts
  SET draft_id = v_draft_id
  WHERE id = p_entry_id;

  RETURN v_draft_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_league_scheduled_draft(UUID) TO authenticated;
