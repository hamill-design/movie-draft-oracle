
-- Add scoring-related columns to draft_picks table
ALTER TABLE public.draft_picks 
ADD COLUMN movie_budget BIGINT,
ADD COLUMN movie_revenue BIGINT,
ADD COLUMN rt_critics_score INTEGER,
ADD COLUMN rt_audience_score INTEGER,
ADD COLUMN imdb_rating DECIMAL(3,1),
ADD COLUMN oscar_status TEXT DEFAULT 'none' CHECK (oscar_status IN ('none', 'nominee', 'winner')),
ADD COLUMN calculated_score DECIMAL(5,2),
ADD COLUMN scoring_data_complete BOOLEAN DEFAULT false;

-- Add index for faster score calculations
CREATE INDEX idx_draft_picks_calculated_score ON public.draft_picks(calculated_score);
CREATE INDEX idx_draft_picks_scoring_complete ON public.draft_picks(scoring_data_complete);
