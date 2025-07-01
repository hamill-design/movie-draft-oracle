
-- Create drafts table to store draft sessions
CREATE TABLE public.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  theme TEXT NOT NULL,
  option TEXT NOT NULL,
  participants TEXT[] NOT NULL,
  categories TEXT[] NOT NULL,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create draft_picks table to store individual picks
CREATE TABLE public.draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES public.drafts(id) ON DELETE CASCADE NOT NULL,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  movie_id INTEGER NOT NULL,
  movie_title TEXT NOT NULL,
  movie_year INTEGER,
  movie_genre TEXT,
  category TEXT NOT NULL,
  pick_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for drafts
CREATE POLICY "Users can view their own drafts" 
  ON public.drafts 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts" 
  ON public.drafts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts" 
  ON public.drafts 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts" 
  ON public.drafts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create RLS policies for draft_picks
CREATE POLICY "Users can view picks from their own drafts" 
  ON public.draft_picks 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.drafts 
    WHERE drafts.id = draft_picks.draft_id 
    AND drafts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert picks to their own drafts" 
  ON public.draft_picks 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.drafts 
    WHERE drafts.id = draft_picks.draft_id 
    AND drafts.user_id = auth.uid()
  ));

CREATE POLICY "Users can update picks from their own drafts" 
  ON public.draft_picks 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.drafts 
    WHERE drafts.id = draft_picks.draft_id 
    AND drafts.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete picks from their own drafts" 
  ON public.draft_picks 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.drafts 
    WHERE drafts.id = draft_picks.draft_id 
    AND drafts.user_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX idx_drafts_user_id ON public.drafts(user_id);
CREATE INDEX idx_draft_picks_draft_id ON public.draft_picks(draft_id);
CREATE INDEX idx_draft_picks_pick_order ON public.draft_picks(pick_order);
