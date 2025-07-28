-- Reset scoring_data_complete for movies missing critical rating data
-- This will trigger re-enrichment of missing RT/IMDB/Metacritic scores

UPDATE draft_picks 
SET scoring_data_complete = false 
WHERE rt_critics_score IS NULL 
   OR imdb_rating IS NULL 
   OR metacritic_score IS NULL;