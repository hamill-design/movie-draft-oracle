-- Update the current_guest_session function to read from request headers
CREATE OR REPLACE FUNCTION public.current_guest_session()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Try to get guest session ID from request header first
  DECLARE
    guest_session_id TEXT;
  BEGIN
    guest_session_id := current_setting('request.headers', true)::json->>'x-guest-session-id';
    IF guest_session_id IS NOT NULL THEN
      RETURN guest_session_id::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors and continue to fallback
  END;
  
  -- Fallback to custom setting
  RETURN COALESCE(current_setting('request.guest_session_id', true)::UUID, NULL);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;