-- Update can_access_draft function to handle mixed authentication states better

-- Verify drafts table exists before creating functions that reference it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' AND table_name = 'drafts') THEN
    RAISE EXCEPTION 'Table public.drafts does not exist. Migration 20250701202547 must run first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_access_draft(p_draft_id uuid, p_participant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_draft_record public.drafts%ROWTYPE;
  v_current_user_id uuid;
BEGIN
  -- Log the access attempt for debugging
  RAISE LOG 'can_access_draft called with draft_id: %, participant_id: %', p_draft_id, p_participant_id;
  
  -- Get current authenticated user ID
  v_current_user_id := auth.uid();
  
  -- Get draft record
  SELECT * INTO v_draft_record
  FROM public.drafts
  WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RAISE LOG 'Draft not found: %', p_draft_id;
    RETURN false;
  END IF;
  
  -- Check if participant is the draft owner (authenticated user)
  IF v_current_user_id IS NOT NULL AND v_draft_record.user_id = v_current_user_id THEN
    RAISE LOG 'Access granted: user is draft owner (user_id: %)', v_current_user_id;
    RETURN true;
  END IF;
  
  -- Check if participant is the draft owner (guest session)
  IF v_draft_record.guest_session_id = p_participant_id THEN
    RAISE LOG 'Access granted: participant is draft owner (guest_session_id: %)', p_participant_id;
    RETURN true;
  END IF;
  
  -- Check if participant is in draft_participants (authenticated user)
  IF v_current_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.user_id = v_current_user_id
  ) THEN
    RAISE LOG 'Access granted: user is participant (user_id: %)', v_current_user_id;
    RETURN true;
  END IF;
  
  -- Check if participant is in draft_participants (guest session)
  IF EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = p_draft_id AND dp.guest_participant_id = p_participant_id
  ) THEN
    RAISE LOG 'Access granted: participant is in draft_participants (guest_participant_id: %)', p_participant_id;
    RETURN true;
  END IF;
  
  -- Special case: If user is authenticated but we're checking with their guest session ID,
  -- also check if their authenticated ID has access
  IF v_current_user_id IS NOT NULL AND v_current_user_id != p_participant_id THEN
    -- Check if the authenticated user has access even if we're checking with guest ID
    IF v_draft_record.user_id = v_current_user_id THEN
      RAISE LOG 'Access granted: authenticated user owns draft (fallback check)';
      RETURN true;
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM public.draft_participants dp
      WHERE dp.draft_id = p_draft_id AND dp.user_id = v_current_user_id
    ) THEN
      RAISE LOG 'Access granted: authenticated user is participant (fallback check)';
      RETURN true;
    END IF;
  END IF;
  
  RAISE LOG 'Access denied for draft_id: %, participant_id: %, auth.uid(): %', p_draft_id, p_participant_id, v_current_user_id;
  RETURN false;
END;
$function$;