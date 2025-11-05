-- Create unified multiplayer draft creation function that works for both authenticated users and guests
CREATE OR REPLACE FUNCTION public.create_multiplayer_draft_unified(
  p_participant_id uuid,
  p_title text,
  p_theme text,
  p_option text,
  p_categories text[],
  p_participants text[],
  p_participant_name text
)
RETURNS TABLE(
  draft_id uuid,
  draft_user_id uuid,
  draft_guest_session_id uuid,
  draft_title text,
  draft_theme text,
  draft_option text,
  draft_categories text[],
  draft_participants text[],
  draft_is_multiplayer boolean,
  draft_invite_code text,
  draft_current_pick_number integer,
  draft_current_turn_user_id uuid,
  draft_current_turn_participant_id uuid,
  draft_is_complete boolean,
  draft_turn_order jsonb,
  draft_draft_order text[],
  draft_created_at timestamp with time zone,
  draft_updated_at timestamp with time zone,
  participants_data jsonb,
  picks_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_draft_id UUID;
  v_invite_code TEXT;
  v_draft_record public.drafts;
  v_participants_json jsonb;
  v_picks_json jsonb;
  v_is_authenticated_user BOOLEAN := false;
  v_is_guest_user BOOLEAN := false;
  v_final_user_id UUID := NULL;
  v_final_guest_session_id UUID := NULL;
BEGIN
  -- Parameter validation
  IF p_participant_id IS NULL THEN
    RAISE EXCEPTION 'Participant ID cannot be null';
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
  
  -- Determine if participant is authenticated user or guest
  -- Check if it's an authenticated user (check auth.users indirectly via current auth context)
  IF auth.uid() = p_participant_id THEN
    v_is_authenticated_user := true;
    v_final_user_id := p_participant_id;
    RAISE LOG 'Creating draft for authenticated user: %', p_participant_id;
  ELSE
    -- Check if it's a guest session
    IF EXISTS (SELECT 1 FROM public.guest_sessions WHERE id = p_participant_id) THEN
      v_is_guest_user := true;
      v_final_guest_session_id := p_participant_id;
      RAISE LOG 'Creating draft for guest user: %', p_participant_id;
    ELSE
      RAISE EXCEPTION 'Invalid participant ID: not an authenticated user or valid guest session';
    END IF;
  END IF;
  
  -- Generate invite code
  v_invite_code := generate_invite_code();
  
  -- Insert the draft with appropriate user_id or guest_session_id
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
  
  -- Insert the host participant with appropriate user_id or guest_participant_id
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
  
  RAISE LOG 'Successfully created unified multiplayer draft with ID: %', v_draft_id;
  
  -- Return the complete draft record with participants and picks
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
    RAISE LOG 'Error creating unified multiplayer draft: %', SQLERRM;
    RAISE;
END;
$function$;