-- Fix the security issue by setting search_path for the new function
CREATE OR REPLACE FUNCTION public.set_guest_session_context(session_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Set the guest session ID in a session variable
  PERFORM set_config('app.guest_session_id', session_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';