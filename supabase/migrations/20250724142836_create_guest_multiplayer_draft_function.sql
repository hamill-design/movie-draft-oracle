-- Create a dedicated function for guest users to create multiplayer drafts
-- Drop function first in case it exists with a different return type
DROP FUNCTION IF EXISTS public.create_guest_multiplayer_draft(uuid, text, text, text, text[], text[], text);

CREATE OR REPLACE FUNCTION public.create_guest_multiplayer_draft(
  p_guest_session_id UUID,
  p_title TEXT,
  p_theme TEXT,
  p_option TEXT,
  p_categories TEXT[],
  p_participants TEXT[],
  p_participant_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_draft_id UUID;
  v_invite_code TEXT;
BEGIN
  -- Generate invite code
  v_invite_code := generate_invite_code();
  
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
    '00000000-0000-0000-0000-000000000000', -- placeholder user_id for guest
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
    '00000000-0000-0000-0000-000000000000', -- placeholder user_id for guest
    p_guest_session_id,
    p_participant_name,
    'joined',
    true,
    now()
  );
  
  RETURN v_draft_id;
END;
$function$