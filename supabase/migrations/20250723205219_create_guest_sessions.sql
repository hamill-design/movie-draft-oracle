
-- Create guest_sessions table for temporary guest sessions
CREATE TABLE public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add guest_session_id to drafts table
ALTER TABLE public.drafts ADD COLUMN guest_session_id UUID REFERENCES public.guest_sessions(id);

-- Add guest_participant_id to draft_participants table
ALTER TABLE public.draft_participants ADD COLUMN guest_participant_id UUID;

-- Create function to get current guest session from request headers
CREATE OR REPLACE FUNCTION public.current_guest_session()
RETURNS UUID AS $$
BEGIN
  -- This will be set by the frontend via RPC or headers
  RETURN COALESCE(current_setting('request.guest_session_id', true)::UUID, NULL);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to migrate guest drafts to user account
CREATE OR REPLACE FUNCTION public.migrate_guest_drafts_to_user(p_guest_session_id UUID)
RETURNS void AS $$
BEGIN
  -- Update drafts to be owned by the authenticated user
  UPDATE public.drafts 
  SET user_id = auth.uid(), guest_session_id = NULL
  WHERE guest_session_id = p_guest_session_id;
  
  -- Update draft participants to be owned by the authenticated user
  UPDATE public.draft_participants 
  SET user_id = auth.uid(), guest_participant_id = NULL
  WHERE guest_participant_id = p_guest_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is a participant (needed for RLS policies)
CREATE OR REPLACE FUNCTION public.is_draft_participant(draft_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.draft_participants dp
    WHERE dp.draft_id = draft_id_param 
    AND (dp.user_id = auth.uid() OR dp.guest_participant_id = public.current_guest_session())
  );
END;
$function$;

-- Update RLS policies for drafts to allow guest access
DROP POLICY IF EXISTS "Users can view drafts they participate in" ON public.drafts;
CREATE POLICY "Users can view drafts they participate in" ON public.drafts
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_draft_participant(id) OR 
    (auth.email() = ANY (participants)) OR
    (guest_session_id = current_guest_session())
  );

DROP POLICY IF EXISTS "Users can insert their own drafts" ON public.drafts;
CREATE POLICY "Users can insert their own drafts" ON public.drafts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    guest_session_id = current_guest_session()
  );

DROP POLICY IF EXISTS "Users can update drafts they participate in" ON public.drafts;
CREATE POLICY "Users can update drafts they participate in" ON public.drafts
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    is_draft_participant(id) OR
    guest_session_id = current_guest_session()
  );

DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.drafts;
CREATE POLICY "Users can delete their own drafts" ON public.drafts
  FOR DELETE USING (
    auth.uid() = user_id OR
    guest_session_id = current_guest_session()
  );

-- Update RLS policies for draft_participants to allow guest access
DROP POLICY IF EXISTS "Users can insert themselves as participants" ON public.draft_participants;
CREATE POLICY "Users can insert themselves as participants" ON public.draft_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    guest_participant_id = current_guest_session()
  );

DROP POLICY IF EXISTS "Users can update their own participation" ON public.draft_participants;
CREATE POLICY "Users can update their own participation" ON public.draft_participants
  FOR UPDATE USING (
    auth.uid() = user_id OR
    guest_participant_id = current_guest_session()
  );

-- Update RLS policies for draft_picks to allow guest access
DROP POLICY IF EXISTS "Users can view picks from drafts they participate in" ON public.draft_picks;
CREATE POLICY "Users can view picks from drafts they participate in" ON public.draft_picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (
        public.drafts d
        LEFT JOIN public.draft_participants dp ON (d.id = dp.draft_id)
      )
      WHERE d.id = draft_picks.draft_id 
      AND (
        d.user_id = auth.uid() OR 
        dp.user_id = auth.uid() OR
        d.guest_session_id = current_guest_session() OR
        dp.guest_participant_id = current_guest_session()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert picks to drafts they participate in" ON public.draft_picks;
CREATE POLICY "Users can insert picks to drafts they participate in" ON public.draft_picks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (
        public.drafts d
        LEFT JOIN public.draft_participants dp ON (d.id = dp.draft_id)
      )
      WHERE d.id = draft_picks.draft_id 
      AND (
        d.user_id = auth.uid() OR 
        dp.user_id = auth.uid() OR
        d.guest_session_id = current_guest_session() OR
        dp.guest_participant_id = current_guest_session()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update picks from drafts they participate in" ON public.draft_picks;
CREATE POLICY "Users can update picks from drafts they participate in" ON public.draft_picks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM (
        public.drafts d
        LEFT JOIN public.draft_participants dp ON (d.id = dp.draft_id)
      )
      WHERE d.id = draft_picks.draft_id 
      AND (
        d.user_id = auth.uid() OR 
        dp.user_id = auth.uid() OR
        d.guest_session_id = current_guest_session() OR
        dp.guest_participant_id = current_guest_session()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete picks from their own drafts" ON public.draft_picks;
CREATE POLICY "Users can delete picks from their own drafts" ON public.draft_picks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.drafts
      WHERE drafts.id = draft_picks.draft_id 
      AND (
        drafts.user_id = auth.uid() OR
        drafts.guest_session_id = current_guest_session()
      )
    )
  );

-- Enable RLS on guest_sessions table
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/create guest sessions (they're temporary and anonymous)
CREATE POLICY "Anyone can create guest sessions" ON public.guest_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view guest sessions" ON public.guest_sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update guest sessions" ON public.guest_sessions
  FOR UPDATE USING (true);

-- Create cleanup function for expired guest sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_guest_sessions()
RETURNS void AS $$
BEGIN
  -- Delete expired guest sessions and their associated data
  DELETE FROM public.guest_sessions 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
