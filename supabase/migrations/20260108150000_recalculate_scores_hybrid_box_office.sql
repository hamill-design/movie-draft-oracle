-- Recalculate all scores with new hybrid Box Office formula
-- This migration updates the calculate_new_movie_score function and recalculates existing scores

-- Update the function with hybrid Box Office scoring
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
  component_scores NUMERIC[] := '{}';
  box_office_score NUMERIC := 0;
  rt_critics_score NUMERIC := 0;
  metacritic_score NUMERIC := 0;
  imdb_score NUMERIC := 0;
  oscar_bonus NUMERIC := 0;
  average_score NUMERIC := 0;
  final_score NUMERIC := 0;
  profit NUMERIC := 0;
  roi_percent NUMERIC := 0;
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
    component_scores := array_append(component_scores, box_office_score);
  END IF;
  
  -- RT Critics Score - Direct percentage (0-100 scale)
  IF p_rt_critics_score IS NOT NULL THEN
    rt_critics_score := p_rt_critics_score;
    component_scores := array_append(component_scores, rt_critics_score);
  END IF;
  
  -- Metacritic Score - Direct score (0-100 scale)
  IF p_metacritic_score IS NOT NULL THEN
    metacritic_score := p_metacritic_score;
    component_scores := array_append(component_scores, metacritic_score);
  END IF;
  
  -- IMDB Score - Convert to 0-100 scale
  IF p_imdb_rating IS NOT NULL THEN
    imdb_score := (p_imdb_rating / 10) * 100;
    component_scores := array_append(component_scores, imdb_score);
  END IF;
  
  -- Calculate average of available components
  IF array_length(component_scores, 1) > 0 THEN
    SELECT AVG(score) INTO average_score FROM unnest(component_scores) AS score;
  ELSE
    average_score := 0;
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

-- Recalculate all existing draft_picks with the new hybrid Box Office formula
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
  AND movie_budget IS NOT NULL 
  AND movie_revenue IS NOT NULL
  AND movie_budget > 0;

-- Show summary of the recalculation
DO $$
DECLARE
  updated_count INTEGER;
  high_roi_count INTEGER;
  low_roi_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM public.draft_picks 
  WHERE calculated_score IS NOT NULL;
  
  -- Count movies with high ROI (>100%)
  SELECT COUNT(*) INTO high_roi_count
  FROM public.draft_picks
  WHERE movie_budget IS NOT NULL 
    AND movie_revenue IS NOT NULL
    AND movie_budget > 0
    AND ((movie_revenue - movie_budget)::NUMERIC / movie_budget::NUMERIC) * 100 > 100;
  
  -- Count movies with low ROI (0-100%)
  SELECT COUNT(*) INTO low_roi_count
  FROM public.draft_picks
  WHERE movie_budget IS NOT NULL 
    AND movie_revenue IS NOT NULL
    AND movie_budget > 0
    AND ((movie_revenue - movie_budget)::NUMERIC / movie_budget::NUMERIC) * 100 <= 100
    AND ((movie_revenue - movie_budget)::NUMERIC / movie_budget::NUMERIC) * 100 >= 0;
  
  RAISE NOTICE 'Recalculated scores for % draft picks with hybrid Box Office formula', updated_count;
  RAISE NOTICE '% movies with ROI >100%% (using logarithmic scaling)', high_roi_count;
  RAISE NOTICE '% movies with ROI 0-100%% (using linear scaling)', low_roi_count;
END $$;

