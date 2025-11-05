-- Remove the foreign key constraint that's causing issues with guest sessions
ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_user_id_fkey;

-- Update the create_guest_multiplayer_draft function to use NULL for user_id
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
    p_title,
    p_theme,
    p_option,
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
    p_participant_name,
    'joined',
    true,
    now()
  );
  
  RETURN v_draft_id;
END;
$$;