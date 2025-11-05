-- Continue fixing remaining database functions with search_path security

-- Fix make_multiplayer_pick function
CREATE OR REPLACE FUNCTION public.make_multiplayer_pick(p_draft_id uuid, p_movie_id integer, p_movie_title text, p_movie_year integer, p_movie_genre text, p_category text, p_poster_path text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text, new_pick_number integer, next_turn_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_current_pick_number INTEGER;
  v_turn_order JSONB;
  v_next_turn_info JSONB;
  v_next_user_id UUID;
  v_is_complete BOOLEAN := false;
  v_total_picks INTEGER;
  v_participant_count INTEGER;
  v_categories_count INTEGER;
  v_player_id INTEGER;
BEGIN
  -- Input validation
  IF p_movie_title IS NULL OR trim(p_movie_title) = '' OR length(trim(p_movie_title)) > 200 THEN
    RETURN QUERY SELECT false, 'Invalid movie title'::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;
  
  IF p_category IS NULL OR trim(p_category) = '' OR length(trim(p_category)) > 100 THEN
    RETURN QUERY SELECT false, 'Invalid category'::TEXT, 0, NULL::UUID;
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

  -- Verify it's the user's turn
  SELECT (turn_order_item->>'user_id')::UUID
  INTO v_next_user_id
  FROM public.drafts,
       jsonb_array_elements(turn_order) AS turn_order_item
  WHERE id = p_draft_id
    AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;

  IF v_next_user_id != auth.uid() THEN
    RETURN QUERY SELECT false, 'Not your turn'::TEXT, v_current_pick_number, v_next_user_id;
    RETURN;
  END IF;

  -- Calculate the correct player_id
  WITH numbered_participants AS (
    SELECT user_id, row_number() OVER (ORDER BY created_at ASC) as player_id
    FROM public.draft_participants
    WHERE draft_id = p_draft_id
  )
  SELECT player_id INTO v_player_id
  FROM numbered_participants
  WHERE user_id = auth.uid();

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
  )
  SELECT 
    p_draft_id,
    v_player_id,
    COALESCE(dp.participant_name, 'Unknown Player'),
    p_movie_id,
    trim(p_movie_title),
    p_movie_year,
    p_movie_genre,
    trim(p_category),
    v_current_pick_number,
    p_poster_path
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id 
    AND dp.user_id = auth.uid();

  -- Calculate next turn
  v_current_pick_number := v_current_pick_number + 1;
  
  -- Get participant count
  SELECT COUNT(*) INTO v_participant_count
  FROM public.draft_participants
  WHERE draft_id = p_draft_id;
  
  v_total_picks := v_participant_count * v_categories_count;

  -- Check if draft is complete
  IF v_current_pick_number > v_total_picks THEN
    v_is_complete := true;
    v_next_user_id := NULL;
  ELSE
    -- Find next turn user
    SELECT (turn_order_item->>'user_id')::UUID
    INTO v_next_user_id
    FROM public.drafts,
         jsonb_array_elements(turn_order) AS turn_order_item
    WHERE id = p_draft_id
      AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;
  END IF;

  -- Update draft state
  UPDATE public.drafts 
  SET 
    current_pick_number = v_current_pick_number,
    current_turn_user_id = v_next_user_id,
    is_complete = v_is_complete,
    updated_at = now()
  WHERE id = p_draft_id;

  -- Return success
  RETURN QUERY SELECT true, 'Pick successful'::TEXT, v_current_pick_number, v_next_user_id;
END;
$function$;

-- Fix set_participant_name_from_profile function
CREATE OR REPLACE FUNCTION public.set_participant_name_from_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Only set participant_name from profile if user_id is not null
  IF NEW.user_id IS NOT NULL THEN
    -- Get the user's profile name
    SELECT COALESCE(name, email) INTO NEW.participant_name
    FROM public.profiles 
    WHERE id = NEW.user_id;
    
    -- If no profile found, fall back to email from auth
    IF NEW.participant_name IS NULL THEN
      NEW.participant_name = auth.email();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix current_guest_session function
CREATE OR REPLACE FUNCTION public.current_guest_session()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Try to get from session variable first
  DECLARE
    session_id TEXT;
  BEGIN
    session_id := current_setting('app.guest_session_id', true);
    IF session_id IS NOT NULL AND session_id != '' THEN
      RETURN session_id::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors and continue
  END;
  
  -- Fallback: try to get from request headers
  DECLARE
    guest_session_id TEXT;
  BEGIN
    guest_session_id := current_setting('request.headers', true)::json->>'x-guest-session-id';
    IF guest_session_id IS NOT NULL THEN
      RETURN guest_session_id::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors and continue
  END;
  
  RETURN NULL;
END;
$function$;

-- Fix join_draft_by_invite_code_guest function
CREATE OR REPLACE FUNCTION public.join_draft_by_invite_code_guest(invite_code_param text, participant_name_param text, p_guest_session_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(participant_id uuid, draft_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  draft_record public.drafts;
  existing_participant_id UUID;
  new_participant_id UUID;
  final_participant_name TEXT;
  counter INTEGER := 0;
BEGIN
  -- Input validation
  IF invite_code_param IS NULL OR length(trim(invite_code_param)) != 8 THEN
    RAISE EXCEPTION 'Invalid invite code format';
  END IF;
  
  IF participant_name_param IS NULL OR trim(participant_name_param) = '' OR length(trim(participant_name_param)) > 50 THEN
    RAISE EXCEPTION 'Participant name must be between 1 and 50 characters';
  END IF;
  
  -- Sanitize invite code
  IF NOT (trim(invite_code_param) ~ '^[A-Z0-9]{8}$') THEN
    RAISE EXCEPTION 'Invalid invite code format';
  END IF;
  
  -- Set the guest session context if provided
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM public.set_guest_session_context(p_guest_session_id);
  END IF;
  
  -- Find the draft by invite code
  SELECT * INTO draft_record 
  FROM public.drafts 
  WHERE invite_code = trim(invite_code_param) AND is_multiplayer = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Check if draft is already complete
  IF draft_record.is_complete THEN
    RAISE EXCEPTION 'Draft is already complete';
  END IF;
  
  -- Check for existing participants and handle name conflicts
  final_participant_name := trim(participant_name_param);
  WHILE EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.participant_name = final_participant_name
  ) LOOP
    counter := counter + 1;
    final_participant_name := trim(participant_name_param) || ' (' || counter || ')';
  END LOOP;
  
  -- Insert participant
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
    now()
  ) RETURNING id INTO new_participant_id;
  
  -- Return the new participant ID with complete draft details
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