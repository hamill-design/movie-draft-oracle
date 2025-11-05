-- Fix the set_participant_name_from_profile function to handle guest users
CREATE OR REPLACE FUNCTION public.set_participant_name_from_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set participant_name from profile if user_id is not null (authenticated user)
  IF NEW.user_id IS NOT NULL THEN
    -- Get the user's profile name
    SELECT COALESCE(name, email) INTO NEW.participant_name
    FROM public.profiles 
    WHERE id = NEW.user_id;
    
    -- If no profile found, fall back to email from auth
    IF NEW.participant_name IS NULL THEN
      NEW.participant_name = auth.email();
    END IF;
  END IF;
  -- For guest users (user_id IS NULL), preserve the existing participant_name
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;