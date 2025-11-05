CREATE OR REPLACE FUNCTION public.is_draft_participant(draft_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = draft_id_param 
    AND (dp.user_id = auth.uid() OR dp.guest_participant_id = current_guest_session())
  );
END;
$function$