-- Create enum for participant status
CREATE TYPE participant_status AS ENUM ('invited', 'joined', 'left');

-- Create draft_participants table to link users to drafts
CREATE TABLE public.draft_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  status participant_status NOT NULL DEFAULT 'invited',
  is_host BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(draft_id, user_id),
  UNIQUE(draft_id, participant_name)
);

-- Enable RLS on draft_participants
ALTER TABLE public.draft_participants ENABLE ROW LEVEL SECURITY;

-- Add turn management fields to drafts table
ALTER TABLE public.drafts 
ADD COLUMN current_turn_user_id UUID REFERENCES auth.users(id),
ADD COLUMN current_pick_number INTEGER DEFAULT 1,
ADD COLUMN is_multiplayer BOOLEAN DEFAULT false,
ADD COLUMN invite_code TEXT UNIQUE;

-- Create function to generate invite codes
CREATE OR REPLACE FUNCTION generate_invite_code() 
RETURNS TEXT AS $$
BEGIN
  RETURN upper(substring(md5(random()::text) from 1 for 8));
END;
$$ LANGUAGE plpgsql;

-- Add trigger to generate invite codes for multiplayer drafts
CREATE OR REPLACE FUNCTION set_invite_code_for_multiplayer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_multiplayer = true AND NEW.invite_code IS NULL THEN
    NEW.invite_code = generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invite_code
  BEFORE INSERT OR UPDATE ON public.drafts
  FOR EACH ROW
  EXECUTE FUNCTION set_invite_code_for_multiplayer();

-- RLS Policies for draft_participants
CREATE POLICY "Users can view participants of drafts they're in"
ON public.draft_participants
FOR SELECT
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.draft_participants dp2 
    WHERE dp2.draft_id = draft_participants.draft_id 
    AND dp2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert themselves as participants"
ON public.draft_participants
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own participation"
ON public.draft_participants
FOR UPDATE
USING (user_id = auth.uid());

-- Update drafts table RLS to allow multiplayer access
DROP POLICY IF EXISTS "Users can view their own drafts" ON public.drafts;
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.drafts;

CREATE POLICY "Users can view drafts they participate in"
ON public.drafts
FOR SELECT
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.draft_participants dp 
    WHERE dp.draft_id = id 
    AND dp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update drafts they host"
ON public.drafts
FOR UPDATE
USING (user_id = auth.uid());

-- Update draft_picks RLS to allow multiplayer access
DROP POLICY IF EXISTS "Users can view picks from their own drafts" ON public.draft_picks;
DROP POLICY IF EXISTS "Users can insert picks to their own drafts" ON public.draft_picks;
DROP POLICY IF EXISTS "Users can update picks from their own drafts" ON public.draft_picks;

CREATE POLICY "Users can view picks from drafts they participate in"
ON public.draft_picks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.drafts d
    LEFT JOIN public.draft_participants dp ON d.id = dp.draft_id
    WHERE d.id = draft_picks.draft_id 
    AND (d.user_id = auth.uid() OR dp.user_id = auth.uid())
  )
);

CREATE POLICY "Users can insert picks to drafts they participate in"
ON public.draft_picks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.drafts d
    LEFT JOIN public.draft_participants dp ON d.id = dp.draft_id
    WHERE d.id = draft_picks.draft_id 
    AND (d.user_id = auth.uid() OR dp.user_id = auth.uid())
  )
);

CREATE POLICY "Users can update picks from drafts they participate in"
ON public.draft_picks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.drafts d
    LEFT JOIN public.draft_participants dp ON d.id = dp.draft_id
    WHERE d.id = draft_picks.draft_id 
    AND (d.user_id = auth.uid() OR dp.user_id = auth.uid())
  )
);

-- Enable realtime for collaborative features
ALTER TABLE public.drafts REPLICA IDENTITY FULL;
ALTER TABLE public.draft_picks REPLICA IDENTITY FULL;
ALTER TABLE public.draft_participants REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.drafts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_picks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_participants;

-- Function to join a draft by invite code
CREATE OR REPLACE FUNCTION join_draft_by_invite_code(
  invite_code_param TEXT,
  participant_name_param TEXT
)
RETURNS UUID AS $$
DECLARE
  draft_record public.drafts;
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
  
  -- Insert participant
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
$$ LANGUAGE plpgsql SECURITY DEFINER;