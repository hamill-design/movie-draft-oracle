-- First, let's see if there's a unique constraint causing the issue and fix the join function for guest users

-- Check if we need to update the join_draft_by_invite_code function to handle guest users
-- Drop function first in case it exists with a different return type
DROP FUNCTION IF EXISTS public.join_draft_by_invite_code_guest(text, text, uuid);

CREATE OR REPLACE FUNCTION public.join_draft_by_invite_code_guest(invite_code_param text, participant_name_param text, p_guest_session_id uuid DEFAULT NULL)
 RETURNS uuid
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
    SELECT id INTO existing_participant_id
    FROM public.draft_participants
    WHERE draft_id = draft_record.id AND user_id = auth.uid();
    
    -- If user is already a participant, return their existing participant ID
    IF existing_participant_id IS NOT NULL THEN
      RETURN existing_participant_id;
    END IF;
  END IF;
  
  -- For guest users, check if they're already a participant by guest session
  IF p_guest_session_id IS NOT NULL THEN
    SELECT id INTO existing_participant_id
    FROM public.draft_participants
    WHERE draft_id = draft_record.id AND guest_participant_id = p_guest_session_id;
    
    -- If guest is already a participant, return their existing participant ID
    IF existing_participant_id IS NOT NULL THEN
      RETURN existing_participant_id;
    END IF;
  END IF;
  
  -- Handle duplicate participant names by adding a number suffix
  final_participant_name := participant_name_param;
  WHILE EXISTS (
    SELECT 1 FROM public.draft_participants 
    WHERE draft_id = draft_record.id AND participant_name = final_participant_name
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
  
  RETURN new_participant_id;
END;
$function$;