-- Fix join_draft_by_invite_code to handle users who are already participants
CREATE OR REPLACE FUNCTION public.join_draft_by_invite_code(invite_code_param text, participant_name_param text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  draft_record public.drafts;
  existing_participant_id UUID;
  new_participant_id UUID;
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
  
  -- Check if user is already a participant
  SELECT id INTO existing_participant_id
  FROM public.draft_participants
  WHERE draft_id = draft_record.id AND user_id = auth.uid();
  
  -- If user is already a participant, return their existing participant ID
  IF existing_participant_id IS NOT NULL THEN
    RETURN existing_participant_id;
  END IF;
  
  -- Insert participant (only if they're not already one)
  INSERT INTO public.draft_participants (
    draft_id,
    user_id,
    participant_name,
    status,
    joined_at
  ) VALUES (
    draft_record.id,
    auth.uid(),
    participant_name_param,
    'joined',
    now()
  ) RETURNING id INTO new_participant_id;
  
  RETURN new_participant_id;
END;
$function$;