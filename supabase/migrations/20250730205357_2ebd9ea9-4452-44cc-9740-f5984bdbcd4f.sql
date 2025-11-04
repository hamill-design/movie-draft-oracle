-- Fix the remaining database functions with search_path security

-- Set search_path for this migration to allow PostgreSQL to resolve table types
-- (like drafts%ROWTYPE) during function creation
SET LOCAL search_path = 'public';

-- Fix set_guest_session_context function
CREATE OR REPLACE FUNCTION public.set_guest_session_context(session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Set the guest session ID in a session variable
  PERFORM set_config('app.guest_session_id', session_id::text, false);
END;
$function$;

-- Fix create_guest_multiplayer_draft function
CREATE OR REPLACE FUNCTION public.create_guest_multiplayer_draft(p_guest_session_id uuid, p_title text, p_theme text, p_option text, p_categories text[], p_participants text[], p_participant_name text)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone, participants_data jsonb, picks_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_draft_id UUID;
  v_invite_code TEXT;
  v_draft_record drafts%ROWTYPE;
  v_participants_json jsonb;
  v_picks_json jsonb;
BEGIN
  -- Parameter validation with length limits
  IF p_guest_session_id IS NULL THEN
    RAISE EXCEPTION 'Guest session ID cannot be null';
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
  
  IF p_participant_name IS NULL OR trim(p_participant_name) = '' OR length(trim(p_participant_name)) > 50 THEN
    RAISE EXCEPTION 'Participant name must be between 1 and 50 characters';
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
    NULL,
    p_guest_session_id,
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
    joined_at
  ) VALUES (
    v_draft_id,
    NULL,
    p_guest_session_id,
    trim(p_participant_name),
    'joined',
    true,
    now()
  );
  
  -- Fetch participants as JSON
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', dp.id,
      'draft_id', dp.draft_id,
      'user_id', dp.user_id,
      'guest_participant_id', dp.guest_participant_id,
      'participant_name', dp.participant_name,
      'status', dp.status,
      'is_host', dp.is_host,
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

-- Fix is_draft_participant function
CREATE OR REPLACE FUNCTION public.is_draft_participant(draft_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = draft_id_param 
    AND (dp.user_id = auth.uid() OR dp.guest_participant_id = public.current_guest_session())
  );
END;
$function$;

-- Fix load_draft_with_guest_access function
CREATE OR REPLACE FUNCTION public.load_draft_with_guest_access(p_draft_id uuid, p_guest_session_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(draft_id uuid, draft_user_id uuid, draft_guest_session_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_draft_order text[], draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone, participants_data jsonb, picks_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  draft_record drafts%ROWTYPE;
  v_participants_json jsonb;
  v_picks_json jsonb;
  v_has_access boolean := false;
BEGIN
  -- Set the guest session context if provided
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM public.set_guest_session_context(p_guest_session_id);
  END IF;
  
  -- Find the draft
  SELECT * INTO draft_record 
  FROM public.drafts 
  WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  
  -- Check access permissions
  IF auth.uid() IS NOT NULL AND draft_record.user_id = auth.uid() THEN
    v_has_access := true;
  END IF;
  
  IF p_guest_session_id IS NOT NULL AND draft_record.guest_session_id = p_guest_session_id THEN
    v_has_access := true;
  END IF;
  
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.user_id = auth.uid()
  ) THEN
    v_has_access := true;
  END IF;
  
  IF p_guest_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.guest_participant_id = p_guest_session_id
  ) THEN
    v_has_access := true;
  END IF;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Fetch participants and picks
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', dp.id,
      'draft_id', dp.draft_id,
      'user_id', dp.user_id,
      'guest_participant_id', dp.guest_participant_id,
      'participant_name', dp.participant_name,
      'status', dp.status,
      'is_host', dp.is_host,
      'joined_at', dp.joined_at,
      'created_at', dp.created_at
    )
  ), '[]'::jsonb) INTO v_participants_json
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id;
  
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', dpi.id,
      'draft_id', dpi.draft_id,
      'player_id', dpi.player_id,
      'player_name', dpi.player_name,
      'movie_id', dpi.movie_id,
      'movie_title', dpi.movie_title,
      'movie_year', dpi.movie_year,
      'movie_genre', dpi.movie_genre,
      'category', dpi.category,
      'pick_order', dpi.pick_order,
      'poster_path', dpi.poster_path,
      'created_at', dpi.created_at
    ) ORDER BY dpi.pick_order
  ), '[]'::jsonb) INTO v_picks_json
  FROM public.draft_picks dpi
  WHERE dpi.draft_id = p_draft_id;
  
  -- Return the complete draft record
  RETURN QUERY SELECT 
    draft_record.id,
    draft_record.user_id,
    draft_record.guest_session_id,
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
    draft_record.draft_order,
    draft_record.created_at,
    draft_record.updated_at,
    v_participants_json,
    v_picks_json;
END;
$function$;