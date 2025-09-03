-- Create function to calculate movie scores using the new averaging method
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
BEGIN
  -- Box Office Score - Profit percentage (0-100 scale)
  IF p_budget IS NOT NULL AND p_revenue IS NOT NULL AND p_budget > 0 THEN
    box_office_score := ((p_revenue - p_budget)::NUMERIC / p_revenue::NUMERIC) * 100;
    box_office_score := GREATEST(box_office_score, 0); -- No negative scores
    box_office_score := LEAST(box_office_score, 100); -- Cap at 100 for averaging
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
  
  -- Oscar Bonus - Added after averaging (+10 for nomination, +20 for winner)
  IF p_oscar_status = 'winner' THEN
    oscar_bonus := 20;
  ELSIF p_oscar_status = 'nominee' THEN
    oscar_bonus := 10;
  ELSE
    oscar_bonus := 0;
  END IF;
  
  -- Final score is the average plus Oscar bonus
  final_score := average_score + oscar_bonus;
  
  RETURN ROUND(final_score, 2);
END;
$$;

-- Update all existing draft_picks with recalculated scores
UPDATE public.draft_picks 
SET calculated_score = public.calculate_new_movie_score(
  movie_budget,
  movie_revenue,
  rt_critics_score,
  metacritic_score,
  imdb_rating,
  oscar_status
)
WHERE calculated_score IS NOT NULL;

-- Show summary of the recalculation
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM public.draft_picks 
  WHERE calculated_score IS NOT NULL;
  
  RAISE NOTICE 'Recalculated scores for % draft picks using the new averaging-based algorithm', updated_count;
END $$;