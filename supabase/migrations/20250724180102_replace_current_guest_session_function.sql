-- Replace the problematic current_guest_session function with a more reliable approach
-- Note: Cannot drop function because RLS policies depend on it, but CREATE OR REPLACE works
-- since the function signature (no params, returns UUID) hasn't changed

-- Create a simple approach using a session variable
CREATE OR REPLACE FUNCTION public.set_guest_session_context(session_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Set the guest session ID in a session variable
  PERFORM set_config('app.guest_session_id', session_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get the guest session ID
CREATE OR REPLACE FUNCTION public.current_guest_session()
RETURNS UUID AS $$
BEGIN
  -- Try to get from session variable first (set by set_guest_session_context)
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '';

-- Update the join function to set the guest session context at the beginning
CREATE OR REPLACE FUNCTION public.join_draft_by_invite_code_guest(invite_code_param text, participant_name_param text, p_guest_session_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(participant_id uuid, draft_id uuid, draft_title text, draft_theme text, draft_option text, draft_categories text[], draft_participants text[], draft_is_multiplayer boolean, draft_invite_code text, draft_current_pick_number integer, draft_current_turn_user_id uuid, draft_is_complete boolean, draft_turn_order jsonb, draft_created_at timestamp with time zone, draft_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  draft_record public.drafts;
  existing_participant_id UUID;
  new_participant_id UUID;
  final_participant_name TEXT;
  counter INTEGER := 0;
BEGIN
  -- Set the guest session context if provided
  IF p_guest_session_id IS NOT NULL THEN
    PERFORM public.set_guest_session_context(p_guest_session_id);
  END IF;
  
  -- Find the draft by invite code
  SELECT * INTO draft_record 
  FROM public.drafts 
  WHERE invite_code = invite_code_param AND is_multiplayer = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Check if draft is already complete
  IF draft_record.is_complete THEN
    RAISE EXCEPTION 'Draft is already complete';
  END IF;
  
  -- For authenticated users, check if they're already a participant
  IF auth.uid() IS NOT NULL THEN
    SELECT dp.id INTO existing_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.user_id = auth.uid();
    
    -- If user is already a participant, return their existing participant ID with draft details
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
  
  -- For guest users, check if they're already a participant by guest session
  IF p_guest_session_id IS NOT NULL THEN
    SELECT dp.id INTO existing_participant_id
    FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.guest_participant_id = p_guest_session_id;
    
    -- If guest is already a participant, return their existing participant ID with draft details
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
  
  -- Handle duplicate participant names by adding a number suffix
  final_participant_name := participant_name_param;
  WHILE EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = draft_record.id AND dp.participant_name = final_participant_name
  ) LOOP
    counter := counter + 1;
    final_participant_name := participant_name_param || ' (' || counter || ')';
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