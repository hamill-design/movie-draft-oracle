-- Email invitees as first-class draft participants.
--
-- Problem: an invitee who opened their email link signed-out joined as a guest
-- named after their email, next to their pre-created "invited" row. The start
-- function then put BOTH in the turn order (a phantom player), and invitees
-- without an account had no row at all, so they were left out entirely.
--
-- Fix: every invited email gets exactly one draft_participants row at creation
-- (a placeholder with invited_email set and no user yet, if they have no
-- account). The row is what the turn order refers to; when the invitee signs in
-- with that email, claim_draft_invite binds the account to the row and rewrites
-- the turn order, so drafts can be played asynchronously over days.

ALTER TABLE public.draft_participants
  ADD COLUMN IF NOT EXISTS invited_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS draft_participants_draft_invited_email_key
  ON public.draft_participants (draft_id, lower(invited_email))
  WHERE invited_email IS NOT NULL;

ALTER TABLE public.draft_participants DROP CONSTRAINT IF EXISTS check_participant_type;
ALTER TABLE public.draft_participants
  ADD CONSTRAINT check_participant_type
  CHECK (
    (user_id IS NOT NULL) OR
    (guest_participant_id IS NOT NULL) OR
    (is_ai = true) OR
    (invited_email IS NOT NULL)
  );

-- Signed-in caller's email, lower-cased.
CREATE OR REPLACE FUNCTION public._current_auth_email()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(COALESCE(auth.jwt() ->> 'email', (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())));
$$;

-- Is the signed-in caller on this draft's invite list?
CREATE OR REPLACE FUNCTION public._is_current_user_invited(p_draft_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND public._current_auth_email() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.drafts d, unnest(COALESCE(d.participants, ARRAY[]::text[])) AS e
    WHERE d.id = p_draft_id AND lower(trim(e)) = public._current_auth_email()
  );
$$;

-- Unique display name inside a draft (participant_name is unique per draft).
CREATE OR REPLACE FUNCTION public._unique_participant_name(p_draft_id UUID, p_base TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := left(COALESCE(NULLIF(trim(p_base), ''), 'Player'), 45);
  v_try  TEXT := v_name;
  v_n    INTEGER := 0;
BEGIN
  WHILE EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.participant_name = v_try
  ) LOOP
    v_n := v_n + 1;
    v_try := v_name || ' (' || v_n || ')';
  END LOOP;
  RETURN v_try;
END;
$$;

-- Host adds a row for every invited email.
CREATE OR REPLACE FUNCTION public.invite_users_to_draft_by_email(
  p_draft_id UUID,
  p_emails   TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_email    TEXT;
  v_uid      UUID;
  v_pname    TEXT;
  v_host_email TEXT := public._current_auth_email();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.drafts WHERE id = p_draft_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the draft owner can invite participants';
  END IF;

  FOR v_email IN
    SELECT DISTINCT lower(trim(e)) FROM unnest(COALESCE(p_emails, ARRAY[]::text[])) AS e
    WHERE trim(e) <> ''
  LOOP
    CONTINUE WHEN v_email = v_host_email;

    SELECT p.id, p.name INTO v_uid, v_pname
    FROM public.profiles p
    WHERE lower(p.email) = v_email AND p.id <> auth.uid()
    LIMIT 1;

    IF v_uid IS NOT NULL THEN
      -- Registered: a row keyed by their account (fires the bell notification).
      INSERT INTO public.draft_participants
        (draft_id, user_id, participant_name, status, is_host, is_ai, joined_at, invited_email)
      VALUES
        (p_draft_id, v_uid,
         public._unique_participant_name(p_draft_id, COALESCE(v_pname, split_part(v_email, '@', 1))),
         'invited', FALSE, FALSE, now(), v_email)
      ON CONFLICT DO NOTHING;
    ELSE
      -- Not registered yet: placeholder row, claimed when they sign up / sign in.
      INSERT INTO public.draft_participants
        (draft_id, user_id, participant_name, status, is_host, is_ai, invited_email)
      VALUES
        (p_draft_id, NULL,
         public._unique_participant_name(p_draft_id, split_part(v_email, '@', 1)),
         'invited', FALSE, FALSE, v_email)
      ON CONFLICT DO NOTHING;
    END IF;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
    v_uid := NULL;
    v_pname := NULL;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- Attach the signed-in account to its invited spot. Never creates a 2nd row.
CREATE OR REPLACE FUNCTION public.claim_draft_invite(
  p_draft_id UUID,
  p_mark_joined BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_email   TEXT := public._current_auth_email();
  v_row_id  UUID;
  v_ph_id   UUID;
  v_pname   TEXT;
  v_started BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to join this draft';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.drafts WHERE id = p_draft_id) THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  -- Already has a row: just make sure it is marked joined.
  SELECT dp.id INTO v_row_id
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id AND dp.user_id = v_uid;

  IF v_row_id IS NOT NULL THEN
    IF p_mark_joined THEN
      UPDATE public.draft_participants SET status = 'joined'
      WHERE id = v_row_id AND status = 'invited';
    END IF;
    RETURN v_row_id;
  END IF;

  IF NOT public._is_current_user_invited(p_draft_id) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address. You are signed in as %.', v_email;
  END IF;

  -- Unclaimed placeholder for this email?
  SELECT dp.id, dp.participant_name INTO v_ph_id, v_pname
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id
    AND lower(dp.invited_email) = v_email
    AND dp.user_id IS NULL
    AND dp.guest_participant_id IS NULL
  FOR UPDATE;

  IF v_ph_id IS NULL THEN
    -- Invite list has them but no row exists (draft created before this
    -- migration). Only possible to add them before the draft starts.
    SELECT (d.turn_order IS NOT NULL AND jsonb_array_length(d.turn_order) > 0) INTO v_started
    FROM public.drafts d WHERE d.id = p_draft_id;
    IF v_started THEN
      RAISE EXCEPTION 'Draft already started';
    END IF;

    INSERT INTO public.draft_participants
      (draft_id, user_id, participant_name, status, is_host, is_ai, joined_at, invited_email)
    VALUES
      (p_draft_id, v_uid,
       public._unique_participant_name(p_draft_id,
         COALESCE((SELECT p.name FROM public.profiles p WHERE p.id = v_uid), split_part(v_email, '@', 1))),
       CASE WHEN p_mark_joined THEN 'joined'::participant_status ELSE 'invited'::participant_status END,
       FALSE, FALSE, now(), v_email)
    RETURNING id INTO v_row_id;
    RETURN v_row_id;
  END IF;

  -- Bind the account to the placeholder.
  UPDATE public.draft_participants
  SET user_id = v_uid,
      status = CASE WHEN p_mark_joined THEN 'joined'::participant_status ELSE status END,
      joined_at = now()
  WHERE id = v_ph_id;

  -- The turn order (if the draft has started) refers to the placeholder by row
  -- id; point it at the account instead.
  UPDATE public.drafts d
  SET turn_order = (
        SELECT jsonb_agg(
                 CASE WHEN t.e ->> 'participant_id' = v_ph_id::text
                      THEN t.e || jsonb_build_object('participant_id', v_uid, 'user_id', v_uid)
                      ELSE t.e END
                 ORDER BY t.ord)
        FROM jsonb_array_elements(d.turn_order) WITH ORDINALITY AS t(e, ord)
      ),
      current_turn_user_id = CASE WHEN d.current_turn_user_id = v_ph_id THEN v_uid ELSE d.current_turn_user_id END,
      current_turn_participant_id = CASE WHEN d.current_turn_participant_id = v_ph_id THEN v_uid ELSE d.current_turn_participant_id END,
      updated_at = now()
  WHERE d.id = p_draft_id
    AND d.turn_order IS NOT NULL
    AND jsonb_array_length(d.turn_order) > 0;

  RETURN v_ph_id;
END;
$$;

-- On sign-in: attach the account to every open draft it was invited to, even
-- if the invitee never came back through the email link. Bound spots stay
-- 'invited' (they flip to 'joined' when the draft is opened) and get a bell
-- notification, like a registered invitee would.
CREATE OR REPLACE FUNCTION public.claim_pending_draft_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_email TEXT := public._current_auth_email();
  v_draft RECORD;
  v_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL OR v_email IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_draft IN
    SELECT dp.draft_id, d.title
    FROM public.draft_participants dp
    JOIN public.drafts d ON d.id = dp.draft_id
    WHERE lower(dp.invited_email) = v_email
      AND dp.user_id IS NULL
      AND dp.guest_participant_id IS NULL
      AND d.is_complete IS NOT TRUE
  LOOP
    BEGIN
      PERFORM public.claim_draft_invite(v_draft.draft_id, FALSE);
      INSERT INTO public.notifications (user_id, type, title, body, link, reference_id)
      VALUES (v_uid, 'draft_invite', 'You''ve been invited to a draft',
              COALESCE(v_draft.title, 'A new draft'), '/draft/' || v_draft.draft_id::TEXT, v_draft.draft_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'claim_pending_draft_invites: draft % skipped: %', v_draft.draft_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_draft_invite(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_draft_invites() TO authenticated;

-- Start: unclaimed email invitees use their row id in the turn order (like AI rows).
CREATE OR REPLACE FUNCTION public.start_multiplayer_draft_unified(
  p_draft_id uuid,
  p_participant_id uuid DEFAULT NULL::uuid
)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_current_turn_participant_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_draft_record public.drafts%ROWTYPE;
  v_participants_list public.draft_participants[];
  v_shuffled_participants public.draft_participants[];
  v_turn_order jsonb := '[]'::jsonb;
  v_categories_count integer;
  v_participant_count integer;
  v_total_picks integer;
  v_current_direction integer := 1;
  v_current_round integer := 1;
  v_pick_number integer := 1;
  v_participant_index integer;
  v_current_participant_id uuid;
  v_first_turn_participant_id uuid;
  v_has_access boolean := false;
  i integer;
  j integer;
BEGIN
  -- Set guest session context if provided
  IF p_participant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.guest_sessions WHERE id = p_participant_id) THEN
    PERFORM public.set_guest_session_context(p_participant_id);
  END IF;

  -- Get the draft (bypass RLS for permission checking)
  PERFORM set_config('row_security', 'off', true);
  
  SELECT * INTO v_draft_record
  FROM public.drafts
  WHERE id = p_draft_id;
  
  PERFORM set_config('row_security', 'on', true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  -- Check permissions
  IF auth.uid() IS NOT NULL AND v_draft_record.user_id = auth.uid() THEN
    v_has_access := true;
  END IF;
  
  IF p_participant_id IS NOT NULL AND v_draft_record.guest_session_id = p_participant_id THEN
    v_has_access := true;
  END IF;
  
  PERFORM set_config('row_security', 'off', true);
  IF EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id 
    AND dp.is_host = true
    AND (
      (auth.uid() IS NOT NULL AND dp.user_id = auth.uid()) OR
      (p_participant_id IS NOT NULL AND dp.guest_participant_id = p_participant_id)
    )
  ) THEN
    v_has_access := true;
  END IF;
  PERFORM set_config('row_security', 'on', true);

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Check if draft has already started
  IF v_draft_record.turn_order IS NOT NULL AND jsonb_array_length(v_draft_record.turn_order) > 0 THEN
    RETURN QUERY SELECT 
      v_draft_record.id,
      v_draft_record.user_id,
      v_draft_record.guest_session_id,
      v_draft_record.title,
      v_draft_record.theme,
      v_draft_record.option,
      v_draft_record.categories,
      v_draft_record.participants,
      v_draft_record.is_multiplayer,
      v_draft_record.invite_code,
      v_draft_record.current_pick_number,
      v_draft_record.current_turn_user_id,
      v_draft_record.current_turn_participant_id,
      v_draft_record.is_complete,
      v_draft_record.turn_order,
      v_draft_record.draft_order,
      v_draft_record.created_at,
      v_draft_record.updated_at;
    RETURN;
  END IF;

  -- Get participants (bypass RLS)
  PERFORM set_config('row_security', 'off', true);
  SELECT array_agg(dp ORDER BY dp.created_at) INTO v_participants_list
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id;
  PERFORM set_config('row_security', 'on', true);

  IF v_participants_list IS NULL OR array_length(v_participants_list, 1) < 2 THEN
    RAISE EXCEPTION 'Need at least 2 participants to start draft';
  END IF;

  -- Shuffle participants using Fisher-Yates algorithm
  v_shuffled_participants := v_participants_list;
  FOR i IN REVERSE array_length(v_shuffled_participants, 1)..2 LOOP
    j := floor(random() * i)::integer + 1;
    IF i != j THEN
      DECLARE
        temp_participant public.draft_participants;
      BEGIN
        temp_participant := v_shuffled_participants[i];
        v_shuffled_participants[i] := v_shuffled_participants[j];
        v_shuffled_participants[j] := temp_participant;
      END;
    END IF;
  END LOOP;

  -- Calculate totals
  v_categories_count := array_length(v_draft_record.categories, 1);
  v_participant_count := array_length(v_shuffled_participants, 1);
  v_total_picks := v_categories_count * v_participant_count;

  -- Generate snake draft turn order
  -- For AI participants, use their row id as participant_id
  FOR v_current_round IN 1..v_categories_count LOOP
    IF v_current_direction = 1 THEN
      FOR v_participant_index IN 1..v_participant_count LOOP
        -- AI participants and not-yet-claimed email invitees have neither user_id nor
        -- guest_participant_id, so they fall back to their row id (claim_draft_invite
        -- rewrites it to the user id when the invitee signs in).
        v_current_participant_id := COALESCE(
          v_shuffled_participants[v_participant_index].user_id, 
          v_shuffled_participants[v_participant_index].guest_participant_id,
          v_shuffled_participants[v_participant_index].id
        );
        
        v_turn_order := v_turn_order || jsonb_build_object(
          'pick_number', v_pick_number,
          'round', v_current_round,
          'participant_id', v_current_participant_id,
          'user_id', v_current_participant_id, -- Keep for backward compatibility
          'participant_name', v_shuffled_participants[v_participant_index].participant_name,
          'player_id', v_participant_index
        );
        v_pick_number := v_pick_number + 1;
      END LOOP;
    ELSE
      FOR v_participant_index IN REVERSE v_participant_count..1 LOOP
        -- AI participants and not-yet-claimed email invitees have neither user_id nor
        -- guest_participant_id, so they fall back to their row id (claim_draft_invite
        -- rewrites it to the user id when the invitee signs in).
        v_current_participant_id := COALESCE(
          v_shuffled_participants[v_participant_index].user_id, 
          v_shuffled_participants[v_participant_index].guest_participant_id,
          v_shuffled_participants[v_participant_index].id
        );
        
        v_turn_order := v_turn_order || jsonb_build_object(
          'pick_number', v_pick_number,
          'round', v_current_round,
          'participant_id', v_current_participant_id,
          'user_id', v_current_participant_id, -- Keep for backward compatibility
          'participant_name', v_shuffled_participants[v_participant_index].participant_name,
          'player_id', v_participant_index
        );
        v_pick_number := v_pick_number + 1;
      END LOOP;
    END IF;
    
    v_current_direction := v_current_direction * -1;
  END LOOP;

  -- Get the first turn participant ID
  v_first_turn_participant_id := (v_turn_order->0->>'participant_id')::uuid;

  -- Update the draft
  UPDATE public.drafts
  SET 
    turn_order = v_turn_order,
    current_turn_user_id = v_first_turn_participant_id,
    current_turn_participant_id = v_first_turn_participant_id,
    current_pick_number = 1,
    updated_at = now()
  WHERE id = p_draft_id
  RETURNING * INTO v_draft_record;

  -- Return the updated draft
  RETURN QUERY SELECT 
    v_draft_record.id,
    v_draft_record.user_id,
    v_draft_record.guest_session_id,
    v_draft_record.title,
    v_draft_record.theme,
    v_draft_record.option,
    v_draft_record.categories,
    v_draft_record.participants,
    v_draft_record.is_multiplayer,
    v_draft_record.invite_code,
    v_draft_record.current_pick_number,
    v_draft_record.current_turn_user_id,
    v_draft_record.current_turn_participant_id,
    v_draft_record.is_complete,
    v_draft_record.turn_order,
    v_draft_record.draft_order,
    v_draft_record.created_at,
    v_draft_record.updated_at;
END;
$function$;

-- Join by code: attach invited emails to their row, and lock new joiners out once started.
CREATE OR REPLACE FUNCTION public.join_draft_by_invite_code_guest(
  invite_code_param text,
  participant_name_param text,
  p_guest_session_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  participant_id uuid,
  draft_id uuid,
  draft_title text,
  draft_theme text,
  draft_option text,
  draft_categories text[],
  draft_participants text[],
  draft_is_multiplayer boolean,
  draft_invite_code text,
  draft_current_pick_number integer,
  draft_current_turn_user_id uuid,
  draft_is_complete boolean,
  draft_turn_order jsonb,
  draft_created_at timestamp with time zone,
  draft_updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  draft_record public.drafts%ROWTYPE;
  existing_participant_id UUID;
  new_participant_id UUID;
  final_participant_name TEXT;
  counter INTEGER := 0;
BEGIN
  -- Validate inputs
  IF invite_code_param IS NULL OR length(trim(invite_code_param)) != 8 OR NOT (trim(invite_code_param) ~ '^[A-Z0-9]{8}$') THEN
    RAISE EXCEPTION 'Invalid invite code format';
  END IF;

  IF participant_name_param IS NULL OR trim(participant_name_param) = '' OR length(trim(participant_name_param)) > 50 THEN
    RAISE EXCEPTION 'Participant name must be between 1 and 50 characters';
  END IF;

  -- Attach guest session to context if provided
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM public.set_guest_session_context(p_guest_session_id);
  END IF;

  -- Find draft
  SELECT * INTO draft_record
  FROM public.drafts
  WHERE invite_code = trim(invite_code_param) AND is_multiplayer = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF draft_record.is_complete THEN
    RAISE EXCEPTION 'Draft is already complete';
  END IF;

  -- 0) An invited email holder who enters the code must attach to their invited
  --    row (never get a second one).
  IF auth.uid() IS NOT NULL AND public._is_current_user_invited(draft_record.id) THEN
    PERFORM public.claim_draft_invite(draft_record.id);
  END IF;

  -- 1) If authenticated user already a participant, return that
  IF auth.uid() IS NOT NULL THEN
    SELECT dp.id INTO existing_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.user_id = auth.uid();

    IF existing_participant_id IS NOT NULL THEN
      RETURN QUERY SELECT 
        existing_participant_id,
        draft_record.id,
        draft_record.title,
        draft_record.theme,
        draft_record.option,
        draft_record.categories,
        draft_record.participants,
        draft_record.is_multiplayer,
        draft_record.invite_code,
        draft_record.current_pick_number,
        draft_record.current_turn_user_id,
        draft_record.is_complete,
        draft_record.turn_order,
        draft_record.created_at,
        draft_record.updated_at;
      RETURN;
    END IF;
  END IF;

  -- 2) If guest session matches an existing participant, return that
  IF p_guest_session_id IS NOT NULL THEN
    SELECT dp.id INTO existing_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.guest_participant_id = p_guest_session_id;

    IF existing_participant_id IS NOT NULL THEN
      RETURN QUERY SELECT 
        existing_participant_id,
        draft_record.id,
        draft_record.title,
        draft_record.theme,
        draft_record.option,
        draft_record.categories,
        draft_record.participants,
        draft_record.is_multiplayer,
        draft_record.invite_code,
        draft_record.current_pick_number,
        draft_record.current_turn_user_id,
        draft_record.is_complete,
        draft_record.turn_order,
        draft_record.created_at,
        draft_record.updated_at;
      RETURN;
    END IF;
  END IF;

  -- 3) Name-based re-association for guests: if a guest with this name exists, rebind to new session
  IF p_guest_session_id IS NOT NULL THEN
    SELECT dp.id INTO existing_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id
      AND dp.user_id IS NULL
      AND dp.participant_name = trim(participant_name_param)
    LIMIT 1;

    IF existing_participant_id IS NOT NULL THEN
      UPDATE public.draft_participants
      SET guest_participant_id = p_guest_session_id,
          status = 'joined',
          joined_at = NOW()
      WHERE id = existing_participant_id
      RETURNING id INTO existing_participant_id;

      RETURN QUERY SELECT 
        existing_participant_id,
        draft_record.id,
        draft_record.title,
        draft_record.theme,
        draft_record.option,
        draft_record.categories,
        draft_record.participants,
        draft_record.is_multiplayer,
        draft_record.invite_code,
        draft_record.current_pick_number,
        draft_record.current_turn_user_id,
        draft_record.is_complete,
        draft_record.turn_order,
        draft_record.created_at,
        draft_record.updated_at;
      RETURN;
    END IF;
  END IF;

  -- Turn order is fixed at start, so only existing participants / invitees
  -- (handled above) may come back in after that.
  IF draft_record.turn_order IS NOT NULL AND jsonb_array_length(draft_record.turn_order) > 0 THEN
    RAISE EXCEPTION 'Draft already started';
  END IF;

  -- 4) Otherwise, insert a new participant with a de-duplicated name
  final_participant_name := trim(participant_name_param);
  WHILE EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.participant_name = final_participant_name
  ) LOOP
    counter := counter + 1;
    final_participant_name := trim(participant_name_param) || ' (' || counter || ')';
  END LOOP;

  INSERT INTO public.draft_participants (
    draft_id,
    user_id,
    guest_participant_id,
    participant_name,
    status,
    joined_at
  ) VALUES (
    draft_record.id,
    auth.uid(),
    p_guest_session_id,
    final_participant_name,
    'joined',
    NOW()
  ) RETURNING id INTO new_participant_id;

  RETURN QUERY SELECT 
    new_participant_id,
    draft_record.id,
    draft_record.title,
    draft_record.theme,
    draft_record.option,
    draft_record.categories,
    draft_record.participants,
    draft_record.is_multiplayer,
    draft_record.invite_code,
    draft_record.current_pick_number,
    draft_record.current_turn_user_id,
    draft_record.is_complete,
    draft_record.turn_order,
    draft_record.created_at,
    draft_record.updated_at;
END;
$function$;
