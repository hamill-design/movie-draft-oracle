-- Update the create_guest_multiplayer_draft function with better parameter validation and error messages
CREATE OR REPLACE FUNCTION public.create_guest_multiplayer_draft(
  p_guest_session_id uuid, 
  p_title text, 
  p_theme text, 
  p_option text, 
  p_categories text[], 
  p_participants text[], 
  p_participant_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_id UUID;
  v_invite_code TEXT;
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
  ) RETURNING id INTO v_draft_id;
  
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
  
  RETURN v_draft_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating guest multiplayer draft: %', SQLERRM;
    RAISE;
END;
$$;