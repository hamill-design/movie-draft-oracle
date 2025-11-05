-- Modify create_guest_multiplayer_draft to return full draft object
-- Drop function first since we're changing the return type
DROP FUNCTION IF EXISTS public.create_guest_multiplayer_draft(uuid, text, text, text, text[], text[], text);

CREATE OR REPLACE FUNCTION public.create_guest_multiplayer_draft(p_guest_session_id uuid, p_title text, p_theme text, p_option text, p_categories text[], p_participants text[], p_participant_name text)
 RETURNS TABLE(
   id uuid,
   user_id uuid,
   guest_session_id uuid,
   title text,
   theme text,
   option text,
   categories text[],
   participants text[],
   is_multiplayer boolean,
   invite_code text,
   current_pick_number integer,
   current_turn_user_id uuid,
   is_complete boolean,
   turn_order jsonb,
   draft_order text[],
   created_at timestamp with time zone,
   updated_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_draft_id UUID;
  v_invite_code TEXT;
  v_draft_record public.drafts;
BEGIN
  -- Parameter validation with detailed error messages
  IF p_guest_session_id IS NULL THEN
    RAISE EXCEPTION 'Guest session ID cannot be null';
  END IF;
  
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'Draft title cannot be null or empty';
  END IF;
  
  IF p_theme IS NULL OR trim(p_theme) = '' THEN
    RAISE EXCEPTION 'Draft theme cannot be null or empty';
  END IF;
  
  IF p_option IS NULL OR trim(p_option) = '' THEN
    RAISE EXCEPTION 'Draft option cannot be null or empty';
  END IF;
  
  IF p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR array_length(p_categories, 1) = 0 THEN
    RAISE EXCEPTION 'Categories array cannot be null or empty';
  END IF;
  
  IF p_participants IS NULL THEN
    RAISE EXCEPTION 'Participants array cannot be null (empty array is allowed)';
  END IF;
  
  IF p_participant_name IS NULL OR trim(p_participant_name) = '' THEN
    RAISE EXCEPTION 'Participant name cannot be null or empty';
  END IF;
  
  -- Log the parameters for debugging
  RAISE LOG 'Creating guest multiplayer draft with parameters: guest_session_id=%, title=%, theme=%, option=%, categories=%, participants=%, participant_name=%',
    p_guest_session_id, p_title, p_theme, p_option, p_categories, p_participants, p_participant_name;
  
  -- Generate invite code
  v_invite_code := generate_invite_code();
  
  -- Insert the draft with NULL user_id for guest sessions
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
    NULL, -- Use NULL instead of placeholder UUID
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
    NULL, -- Use NULL instead of placeholder UUID
    p_guest_session_id,
    trim(p_participant_name),
    'joined',
    true,
    now()
  );
  
  RAISE LOG 'Successfully created guest multiplayer draft with ID: %', v_draft_id;
  
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
    v_draft_record.updated_at;
    
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating guest multiplayer draft: %', SQLERRM;
    RAISE;
END;
$function$