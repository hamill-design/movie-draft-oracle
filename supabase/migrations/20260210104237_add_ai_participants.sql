-- Add is_ai column to draft_participants table
ALTER TABLE public.draft_participants ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT false;

-- Fix existing rows where both user_id and guest_participant_id are NULL
-- These must be invalid/orphaned rows - mark them as AI participants to satisfy constraint
UPDATE public.draft_participants 
SET is_ai = true 
WHERE user_id IS NULL 
  AND guest_participant_id IS NULL 
  AND (is_ai IS NULL OR is_ai = false);

-- Update remaining rows to ensure is_ai is set correctly
UPDATE public.draft_participants SET is_ai = false WHERE is_ai IS NULL;

-- Add constraint to ensure at least one of user_id, guest_participant_id, or is_ai is set
-- Note: This allows NULL for both user_id and guest_participant_id when is_ai = true
-- Drop constraint if it exists first
ALTER TABLE public.draft_participants DROP CONSTRAINT IF EXISTS check_participant_type;

ALTER TABLE public.draft_participants 
  ADD CONSTRAINT check_participant_type 
  CHECK (
    (user_id IS NOT NULL) OR 
    (guest_participant_id IS NOT NULL) OR 
    (is_ai = true)
  );

-- Update can_access_draft function to allow draft owner to act for AI participants
CREATE OR REPLACE FUNCTION public.can_access_draft(p_draft_id uuid, p_participant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_draft_record public.drafts%ROWTYPE;
  v_current_user_id uuid;
  v_is_ai_participant boolean;
BEGIN
  -- Log the access attempt for debugging
  RAISE LOG 'can_access_draft called with draft_id: %, participant_id: %', p_draft_id, p_participant_id;
  
  -- Get current authenticated user ID
  v_current_user_id := auth.uid();
  
  -- Get draft record
  SELECT * INTO v_draft_record
  FROM public.drafts
  WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RAISE LOG 'Draft not found: %', p_draft_id;
    RETURN false;
  END IF;
  
  -- Check if participant is the draft owner (authenticated user)
  IF v_current_user_id IS NOT NULL AND v_draft_record.user_id = v_current_user_id THEN
    -- Check if p_participant_id is an AI participant in this draft
    SELECT EXISTS (
      SELECT 1 FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id 
        AND dp.id = p_participant_id
        AND dp.is_ai = true
    ) INTO v_is_ai_participant;
    
    -- If it's an AI participant and user is draft owner, allow access
    IF v_is_ai_participant THEN
      RAISE LOG 'Access granted: user is draft owner acting for AI participant (user_id: %, participant_id: %)', v_current_user_id, p_participant_id;
      RETURN true;
    END IF;
    
    RAISE LOG 'Access granted: user is draft owner (user_id: %)', v_current_user_id;
    RETURN true;
  END IF;
  
  -- Check if participant is the draft owner (guest session)
  IF v_draft_record.guest_session_id = p_participant_id THEN
    -- Check if p_participant_id is an AI participant in this draft
    SELECT EXISTS (
      SELECT 1 FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id 
        AND dp.id = p_participant_id
        AND dp.is_ai = true
    ) INTO v_is_ai_participant;
    
    -- If it's an AI participant and guest session is draft owner, allow access
    IF v_is_ai_participant THEN
      RAISE LOG 'Access granted: guest session is draft owner acting for AI participant (guest_session_id: %, participant_id: %)', p_participant_id, p_participant_id;
      RETURN true;
    END IF;
    
    RAISE LOG 'Access granted: participant is draft owner (guest_session_id: %)', p_participant_id;
    RETURN true;
  END IF;
  
  -- Check if participant is in draft_participants (authenticated user)
  IF v_current_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.user_id = v_current_user_id
  ) THEN
    RAISE LOG 'Access granted: user is participant (user_id: %)', v_current_user_id;
    RETURN true;
  END IF;
  
  -- Check if participant is in draft_participants (guest session)
  IF EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.guest_participant_id = p_participant_id
  ) THEN
    RAISE LOG 'Access granted: participant is in draft_participants (guest_participant_id: %)', p_participant_id;
    RETURN true;
  END IF;
  
  -- Special case: If user is authenticated but we're checking with their guest session ID,
  -- also check if their authenticated ID has access
  IF v_current_user_id IS NOT NULL AND v_current_user_id != p_participant_id THEN
    -- Check if the authenticated user has access even if we're checking with guest ID
    IF v_draft_record.user_id = v_current_user_id THEN
      RAISE LOG 'Access granted: authenticated user owns draft (fallback check)';
      RETURN true;
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id AND dp.user_id = v_current_user_id
    ) THEN
      RAISE LOG 'Access granted: authenticated user is participant (fallback check)';
      RETURN true;
    END IF;
  END IF;
  
  RAISE LOG 'Access denied for draft_id: %, participant_id: %, auth.uid(): %', p_draft_id, p_participant_id, v_current_user_id;
  RETURN false;
END;
$function$;

-- Update create_multiplayer_draft_unified to accept and handle AI participant names
CREATE OR REPLACE FUNCTION public.create_multiplayer_draft_unified(
  p_participant_id uuid, 
  p_title text, 
  p_theme text, 
  p_option text, 
  p_categories text[], 
  p_participants text[], 
  p_participant_name text,
  p_ai_participant_names text[] DEFAULT ARRAY[]::text[]
)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_current_turn_participant_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone, participants_data jsonb, picks_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_draft_id UUID;
  v_invite_code TEXT;
  v_draft_record public.drafts%ROWTYPE;
  v_participants_json jsonb;
  v_picks_json jsonb;
  v_is_authenticated_user BOOLEAN := false;
  v_is_guest_user BOOLEAN := false;
  v_final_user_id UUID := NULL;
  v_final_guest_session_id UUID := NULL;
  v_ai_name TEXT;
BEGIN
  -- Parameter validation with length limits
  IF p_participant_id IS NULL THEN
    RAISE EXCEPTION 'Participant ID cannot be null';
  END IF;
  
  IF p_title IS NULL OR trim(p_title) = '' OR length(trim(p_title)) > 200 THEN
    RAISE EXCEPTION 'Draft title must be between 1 and 200 characters';
  END IF;
  
  IF p_theme IS NULL OR trim(p_theme) = '' OR length(trim(p_theme)) > 100 THEN
    RAISE EXCEPTION 'Draft theme must be between 1 and 100 characters';
  END IF;
  
  IF p_option IS NULL OR trim(p_option) = '' OR length(trim(p_option)) > 100 THEN
    RAISE EXCEPTION 'Draft option must be between 1 and 100 characters';
  END IF;
  
  IF p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR array_length(p_categories, 1) = 0 OR array_length(p_categories, 1) > 20 THEN
    RAISE EXCEPTION 'Categories array must contain 1-20 items';
  END IF;
  
  IF p_participants IS NULL OR array_length(p_participants, 1) > 50 THEN
    RAISE EXCEPTION 'Participants array cannot exceed 50 items';
  END IF;
  
  IF p_ai_participant_names IS NULL OR array_length(p_ai_participant_names, 1) > 10 THEN
    RAISE EXCEPTION 'AI participants array cannot exceed 10 items';
  END IF;
  
  IF p_participant_name IS NULL OR trim(p_participant_name) = '' OR length(trim(p_participant_name)) > 50 THEN
    RAISE EXCEPTION 'Participant name must be between 1 and 50 characters';
  END IF;
  
  -- Determine if participant is authenticated user or guest
  IF auth.uid() = p_participant_id THEN
    v_is_authenticated_user := true;
    v_final_user_id := p_participant_id;
  ELSE
    -- Check if it's a guest session
    IF EXISTS (SELECT 1 FROM public.guest_sessions WHERE id = p_participant_id) THEN
      v_is_guest_user := true;
      v_final_guest_session_id := p_participant_id;
    ELSE
      RAISE EXCEPTION 'Invalid participant ID';
    END IF;
  END IF;
  
  -- Generate invite code
  v_invite_code := public.generate_invite_code();
  
  -- Insert the draft
  INSERT INTO public.drafts (
    user_id,
    guest_session_id,
    title,
    theme,
    option,
    categories,
    participants,
    is_multiplayer,
    invite_code
  ) VALUES (
    v_final_user_id,
    v_final_guest_session_id,
    trim(p_title),
    trim(p_theme),
    trim(p_option),
    p_categories,
    p_participants,
    true,
    v_invite_code
  ) RETURNING * INTO v_draft_record;
  
  v_draft_id := v_draft_record.id;
  
  -- Insert the host participant
  INSERT INTO public.draft_participants (
    draft_id,
    user_id,
    guest_participant_id,
    participant_name,
    status,
    is_host,
    is_ai,
    joined_at
  ) VALUES (
    v_draft_id,
    v_final_user_id,
    v_final_guest_session_id,
    trim(p_participant_name),
    'joined',
    true,
    false,
    now()
  );
  
  -- Insert AI participants if any
  IF p_ai_participant_names IS NOT NULL AND array_length(p_ai_participant_names, 1) > 0 THEN
    FOREACH v_ai_name IN ARRAY p_ai_participant_names
    LOOP
      INSERT INTO public.draft_participants (
        draft_id,
        user_id,
        guest_participant_id,
        participant_name,
        status,
        is_host,
        is_ai,
        joined_at
      ) VALUES (
        v_draft_id,
        NULL,
        NULL,
        trim(v_ai_name),
        'joined',
        false,
        true,
        now()
      );
    END LOOP;
  END IF;
  
  -- Fetch participants as JSON (including is_ai flag)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', dp.id,
      'draft_id', dp.draft_id,
      'user_id', dp.user_id,
      'guest_participant_id', dp.guest_participant_id,
      'participant_id', COALESCE(dp.user_id, dp.guest_participant_id, CASE WHEN dp.is_ai THEN dp.id ELSE NULL END),
      'participant_name', dp.participant_name,
      'status', dp.status,
      'is_host', dp.is_host,
      'is_ai', dp.is_ai,
      'joined_at', dp.joined_at,
      'created_at', dp.created_at
    )
  ) INTO v_participants_json
  FROM public.draft_participants dp
  WHERE dp.draft_id = v_draft_id;
  
  -- Initialize empty picks array
  v_picks_json := '[]'::jsonb;
  
  -- Return the complete draft record
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
    v_draft_record.updated_at,
    v_participants_json,
    v_picks_json;
    
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$function$;

-- Update start_multiplayer_draft_unified to handle AI participants in turn order
-- Use participant row id for AI participants (when both user_id and guest_participant_id are NULL)
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
        -- For AI participants, use row id; otherwise use user_id or guest_participant_id
        v_current_participant_id := COALESCE(
          v_shuffled_participants[v_participant_index].user_id, 
          v_shuffled_participants[v_participant_index].guest_participant_id,
          CASE WHEN v_shuffled_participants[v_participant_index].is_ai THEN v_shuffled_participants[v_participant_index].id ELSE NULL END
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
        -- For AI participants, use row id; otherwise use user_id or guest_participant_id
        v_current_participant_id := COALESCE(
          v_shuffled_participants[v_participant_index].user_id, 
          v_shuffled_participants[v_participant_index].guest_participant_id,
          CASE WHEN v_shuffled_participants[v_participant_index].is_ai THEN v_shuffled_participants[v_participant_index].id ELSE NULL END
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

-- Update make_multiplayer_pick_unified to handle AI participants
CREATE OR REPLACE FUNCTION public.make_multiplayer_pick_unified(
  p_draft_id uuid, 
  p_participant_id uuid, 
  p_movie_id integer, 
  p_movie_title text, 
  p_movie_year integer, 
  p_movie_genre text, 
  p_category text, 
  p_poster_path text DEFAULT NULL::text
)
 RETURNS TABLE(success boolean, message text, new_pick_number integer, next_turn_participant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_current_pick_number INTEGER;
  v_turn_order JSONB;
  v_next_turn_participant_id UUID;
  v_is_complete BOOLEAN := false;
  v_total_picks INTEGER;
  v_participant_count INTEGER;
  v_categories_count INTEGER;
  v_player_id INTEGER;
  v_participant_name TEXT;
BEGIN
  -- Check access permissions
  IF NOT public.can_access_draft(p_draft_id, p_participant_id) THEN
    RETURN QUERY SELECT false, 'You do not have access to this draft'::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;

  -- Get current draft state
  SELECT 
    current_pick_number, 
    turn_order,
    array_length(categories, 1)
  INTO 
    v_current_pick_number, 
    v_turn_order,
    v_categories_count
  FROM public.drafts 
  WHERE id = p_draft_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Draft not found'::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;

  -- Verify it's the participant's turn (check both new and legacy field names)
  SELECT COALESCE((turn_order_item->>'participant_id')::UUID, (turn_order_item->>'user_id')::UUID)
  INTO v_next_turn_participant_id
  FROM public.drafts,
       jsonb_array_elements(turn_order) AS turn_order_item
  WHERE id = p_draft_id
    AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;

  IF v_next_turn_participant_id != p_participant_id THEN
    RETURN QUERY SELECT false, 'Not your turn'::TEXT, v_current_pick_number, v_next_turn_participant_id;
    RETURN;
  END IF;

  -- Get player_id and participant_name based on participant type
  -- For AI participants, use row id; otherwise use user_id or guest_participant_id
  WITH numbered_participants AS (
    SELECT 
      COALESCE(user_id, guest_participant_id, CASE WHEN is_ai THEN id ELSE NULL END) as participant_id,
      participant_name,
      row_number() OVER (ORDER BY created_at ASC) as player_id
    FROM public.draft_participants
    WHERE draft_id = p_draft_id
  )
  SELECT player_id, participant_name INTO v_player_id, v_participant_name
  FROM numbered_participants
  WHERE participant_id = p_participant_id;

  -- Insert the pick
  INSERT INTO public.draft_picks (
    draft_id,
    player_id,
    player_name,
    movie_id,
    movie_title,
    movie_year,
    movie_genre,
    category,
    pick_order,
    poster_path
  ) VALUES (
    p_draft_id,
    v_player_id,
    v_participant_name,
    p_movie_id,
    p_movie_title,
    p_movie_year,
    p_movie_genre,
    p_category,
    v_current_pick_number,
    p_poster_path
  );

  -- Calculate next turn
  v_current_pick_number := v_current_pick_number + 1;
  
  -- Get participant count to determine total picks
  SELECT COUNT(*) INTO v_participant_count
  FROM public.draft_participants
  WHERE draft_id = p_draft_id;
  
  v_total_picks := v_participant_count * v_categories_count;

  -- Check if draft is complete
  IF v_current_pick_number > v_total_picks THEN
    v_is_complete := true;
    v_next_turn_participant_id := NULL;
  ELSE
    -- Find next turn participant (check both new and legacy field names)
    SELECT COALESCE((turn_order_item->>'participant_id')::UUID, (turn_order_item->>'user_id')::UUID)
    INTO v_next_turn_participant_id
    FROM public.drafts,
         jsonb_array_elements(turn_order) AS turn_order_item
    WHERE id = p_draft_id
      AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;
  END IF;

  -- Update draft state
  UPDATE public.drafts 
  SET 
    current_pick_number = v_current_pick_number,
    current_turn_user_id = v_next_turn_participant_id, -- Keep for compatibility
    current_turn_participant_id = v_next_turn_participant_id,
    is_complete = v_is_complete,
    updated_at = now()
  WHERE id = p_draft_id;

  -- Return success
  RETURN QUERY SELECT true, 'Pick successful'::TEXT, v_current_pick_number, v_next_turn_participant_id;
END;
$function$;
