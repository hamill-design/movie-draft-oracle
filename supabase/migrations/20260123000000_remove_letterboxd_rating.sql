-- Remove Letterboxd rating from scoring system
-- This migration removes letterboxd_rating parameter from calculate_new_movie_score function

-- Update the function to remove Letterboxd rating
CREATE OR REPLACE FUNCTION public.calculate_new_movie_score(
  p_budget BIGINT,
  p_revenue BIGINT,
  p_rt_critics_score INTEGER,
  p_metacritic_score INTEGER,
  p_imdb_rating NUMERIC,
  p_oscar_status TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
DECLARE
  box_office_score NUMERIC := 0;
  rt_critics_score NUMERIC := 0;
  metacritic_score NUMERIC := 0;
  imdb_score NUMERIC := 0;
  oscar_bonus NUMERIC := 0;
  average_score NUMERIC := 0;
  final_score NUMERIC := 0;
  profit NUMERIC := 0;
  roi_percent NUMERIC := 0;
  -- Consensus scoring variables
  critics_raw_avg NUMERIC := 0;
  critics_score NUMERIC := 0;
  critics_internal_modifier NUMERIC := 1;
  critics_internal_diff NUMERIC := 0;
  audience_raw_avg NUMERIC := 0;
  audience_score NUMERIC := 0;
  audience_internal_modifier NUMERIC := 1;
  audience_internal_diff NUMERIC := 0;
  critical_score NUMERIC := 0;
  consensus_modifier NUMERIC := 1;
  critics_audience_diff NUMERIC := 0;
  weighted_avg NUMERIC := 0;
  -- Fixed weights (no consensus modifier on weights)
  box_office_weight NUMERIC := 0.20;
  critical_weight NUMERIC := 0.80;
BEGIN
  -- Box Office Score - Hybrid ROI-based formula
  -- Linear scaling for 0-100% ROI (0-60 points), logarithmic for >100% ROI (60-100 points)
  IF p_budget IS NOT NULL AND p_revenue IS NOT NULL AND p_budget > 0 THEN
    profit := p_revenue - p_budget;
    IF profit <= 0 THEN
      box_office_score := 0; -- Flops get 0
    ELSE
      roi_percent := (profit::NUMERIC / p_budget::NUMERIC) * 100;
      IF roi_percent <= 100 THEN
        -- Linear scaling: 0-100% ROI → 0-60 points (2x return = 60 points)
        box_office_score := 60 * (roi_percent / 100);
      ELSE
        -- Logarithmic scaling: >100% ROI → 60-100 points (diminishing returns)
        box_office_score := 60 + 40 * (1 - exp(-(roi_percent - 100) / 200));
      END IF;
    END IF;
  END IF;
  
  -- Convert scores to 0-100 scale
  IF p_rt_critics_score IS NOT NULL THEN
    rt_critics_score := p_rt_critics_score;
  END IF;
  
  IF p_metacritic_score IS NOT NULL THEN
    metacritic_score := p_metacritic_score;
  END IF;
  
  IF p_imdb_rating IS NOT NULL THEN
    imdb_score := (p_imdb_rating / 10) * 100;
  END IF;
  
  -- Layer 1: Calculate Critics Score (Internal Consensus)
  IF rt_critics_score > 0 AND metacritic_score > 0 THEN
    critics_raw_avg := (rt_critics_score + metacritic_score) / 2;
    critics_internal_diff := ABS(rt_critics_score - metacritic_score);
    critics_internal_modifier := GREATEST(0, 1 - (critics_internal_diff / 200));
    critics_score := critics_raw_avg * critics_internal_modifier;
  ELSIF rt_critics_score > 0 THEN
    critics_raw_avg := rt_critics_score;
    critics_score := rt_critics_score;
  ELSIF metacritic_score > 0 THEN
    critics_raw_avg := metacritic_score;
    critics_score := metacritic_score;
  END IF;
  
  -- Layer 2: Calculate Audience Score (IMDB only, no Letterboxd)
  IF imdb_score > 0 THEN
    audience_raw_avg := imdb_score;
    audience_score := imdb_score;
  END IF;
  
  -- Layer 3: Calculate Final Critical Score (Cross-Category Consensus)
  IF critics_raw_avg > 0 AND audience_raw_avg > 0 THEN
    -- Use RAW averages for consensus calculation
    critics_audience_diff := ABS(critics_raw_avg - audience_raw_avg);
    consensus_modifier := GREATEST(0, 1 - (critics_audience_diff / 200));
    
    -- Weighted average of penalized scores (50/50)
    weighted_avg := (critics_score * 0.5) + (audience_score * 0.5);
    critical_score := weighted_avg * consensus_modifier;
  ELSIF critics_score > 0 THEN
    critical_score := critics_score;
  ELSIF audience_score > 0 THEN
    critical_score := audience_score;
  END IF;
  
  -- Fixed weights: 20% Box Office, 80% Critical Score
  IF box_office_score > 0 AND critical_score > 0 THEN
    -- Both available: use fixed 20/80 split
    box_office_weight := 0.20;
    critical_weight := 0.80;
  ELSIF box_office_score > 0 THEN
    -- Only Box Office available
    box_office_weight := 1.0;
    critical_weight := 0;
  ELSIF critical_score > 0 THEN
    -- Only Critical Score available
    box_office_weight := 0;
    critical_weight := 1.0;
  END IF;
  
  -- Calculate final average with fixed weights
  IF box_office_score > 0 AND critical_score > 0 THEN
    average_score := (box_office_score * box_office_weight) + (critical_score * critical_weight);
  ELSIF box_office_score > 0 THEN
    average_score := box_office_score;
  ELSIF critical_score > 0 THEN
    average_score := critical_score;
  END IF;
  
  -- Oscar Bonus - Added after averaging (+3 for nomination, +6 for winner)
  IF p_oscar_status = 'winner' THEN
    oscar_bonus := 6;
  ELSIF p_oscar_status = 'nominee' THEN
    oscar_bonus := 3;
  ELSE
    oscar_bonus := 0;
  END IF;
  
  -- Final score is the average plus Oscar bonus
  final_score := average_score + oscar_bonus;
  
  RETURN ROUND(final_score, 2);
END;
$$;

-- Recalculate all existing draft_picks without Letterboxd rating
UPDATE public.draft_picks 
SET calculated_score = public.calculate_new_movie_score(
  movie_budget,
  movie_revenue,
  rt_critics_score,
  metacritic_score,
  imdb_rating,
  oscar_status
)
WHERE calculated_score IS NOT NULL
  AND (
    (movie_budget IS NOT NULL AND movie_revenue IS NOT NULL AND movie_budget > 0)
    OR rt_critics_score IS NOT NULL
    OR metacritic_score IS NOT NULL
    OR imdb_rating IS NOT NULL
  );

-- Show summary of the recalculation
DO $$
DECLARE
  updated_count INTEGER;
  with_box_office INTEGER;
  with_critics INTEGER;
  with_audience INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM public.draft_picks 
  WHERE calculated_score IS NOT NULL;
  
  SELECT COUNT(*) INTO with_box_office
  FROM public.draft_picks
  WHERE movie_budget IS NOT NULL 
    AND movie_revenue IS NOT NULL
    AND movie_budget > 0;
  
  SELECT COUNT(*) INTO with_critics
  FROM public.draft_picks
  WHERE rt_critics_score IS NOT NULL OR metacritic_score IS NOT NULL;
  
  SELECT COUNT(*) INTO with_audience
  FROM public.draft_picks
  WHERE imdb_rating IS NOT NULL;
  
  RAISE NOTICE 'Recalculated scores for % draft picks (Letterboxd removed)', updated_count;
  RAISE NOTICE '% movies with Box Office data', with_box_office;
  RAISE NOTICE '% movies with Critics data (RT/Metacritic)', with_critics;
  RAISE NOTICE '% movies with Audience data (IMDB)', with_audience;
END $$;
