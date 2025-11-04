-- Critical Security Fix: Add search_path protection to all functions
-- This prevents function hijacking and privilege escalation attacks

-- Fix generate_invite_code function
CREATE OR REPLACE FUNCTION public.generate_invite_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN upper(substring(md5(random()::text) from 1 for 8));
END;
$function$;

-- Fix set_invite_code_for_multiplayer trigger function
CREATE OR REPLACE FUNCTION public.set_invite_code_for_multiplayer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF NEW.is_multiplayer = true AND NEW.invite_code IS NULL THEN
    NEW.invite_code = public.generate_invite_code();
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix update_oscar_cache_updated_at function
CREATE OR REPLACE FUNCTION public.update_oscar_cache_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix create_multiplayer_draft_unified function
CREATE OR REPLACE FUNCTION public.create_multiplayer_draft_unified(p_participant_id uuid, p_title text, p_theme text, p_option text, p_categories text[], p_participants text[], p_participant_name text)
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
    joined_at
  ) VALUES (
    v_draft_id,
    v_final_user_id,
    v_final_guest_session_id,
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
      'participant_id', COALESCE(dp.user_id, dp.guest_participant_id),
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

-- Fix migrate_guest_drafts_to_user function
CREATE OR REPLACE FUNCTION public.migrate_guest_drafts_to_user(p_guest_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Update drafts to be owned by the authenticated user
  UPDATE public.drafts 
  SET user_id = auth.uid(), guest_session_id = NULL
  WHERE guest_session_id = p_guest_session_id;
  
  -- Update draft participants to be owned by the authenticated user
  UPDATE public.draft_participants 
  SET user_id = auth.uid(), guest_participant_id = NULL
  WHERE guest_participant_id = p_guest_session_id;
END;
$function$;

-- Fix cleanup_expired_guest_sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_guest_sessions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Delete expired guest sessions and their associated data
  DELETE FROM public.guest_sessions 
  WHERE expires_at < now();
END;
$function$;

-- Fix join_draft_by_invite_code function
CREATE OR REPLACE FUNCTION public.join_draft_by_invite_code(invite_code_param text, participant_name_param text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  draft_record public.drafts%ROWTYPE;
  existing_participant_id UUID;
  new_participant_id UUID;
BEGIN
  -- Validate input parameters
  IF invite_code_param IS NULL OR length(trim(invite_code_param)) != 8 THEN
    RAISE EXCEPTION 'Invalid invite code format';
  END IF;
  
  IF participant_name_param IS NULL OR trim(participant_name_param) = '' OR length(trim(participant_name_param)) > 50 THEN
    RAISE EXCEPTION 'Participant name must be between 1 and 50 characters';
  END IF;
  
  -- Sanitize invite code (only allow alphanumeric)
  IF NOT (trim(invite_code_param) ~ '^[A-Z0-9]{8}$') THEN
    RAISE EXCEPTION 'Invalid invite code format';
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
  
  -- Check if user is already a participant
  SELECT id INTO existing_participant_id
  FROM public.draft_participants
  WHERE draft_id = draft_record.id AND user_id = auth.uid();
  
  -- If user is already a participant, return their existing participant ID
  IF existing_participant_id IS NOT NULL THEN
    RETURN existing_participant_id;
  END IF;
  
  -- Insert participant
  INSERT INTO public.draft_participants (
    draft_id,
    user_id,
    participant_name,
    status,
    joined_at
  ) VALUES (
    draft_record.id,
    auth.uid(),
    trim(participant_name_param),
    'joined',
    now()
  ) RETURNING id INTO new_participant_id;
  
  RETURN new_participant_id;
END;
$function$;

-- Continue with remaining functions in next part due to length...