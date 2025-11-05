
-- Create a function to automatically set participant_name from profile
CREATE OR REPLACE FUNCTION set_participant_name_from_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the user's profile name
  SELECT COALESCE(name, email) INTO NEW.participant_name
  FROM public.profiles 
  WHERE id = NEW.user_id;
  
  -- If no profile found, fall back to email from auth
  IF NEW.participant_name IS NULL THEN
    NEW.participant_name = auth.email();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set participant_name on insert
CREATE TRIGGER trigger_set_participant_name
  BEFORE INSERT ON public.draft_participants
  FOR EACH ROW
  EXECUTE FUNCTION set_participant_name_from_profile();

-- Update existing records to use profile names instead of emails
UPDATE public.draft_participants 
SET participant_name = COALESCE(
  (SELECT name FROM public.profiles WHERE id = draft_participants.user_id),
  (SELECT email FROM public.profiles WHERE id = draft_participants.user_id),
  participant_name
)
WHERE participant_name LIKE '%@%';
