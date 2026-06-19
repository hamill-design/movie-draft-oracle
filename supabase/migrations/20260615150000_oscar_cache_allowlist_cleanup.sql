-- Final step of the Academy Award allow-list cutover: drop the negative-cache rows so
-- oscar_cache holds ONLY winners and nominees. After this, presence in the table is the
-- eligibility rule: a tmdb_id in oscar_cache (winner/nominee) = Oscar film; absent = none.
--
-- ⚠️ ORDERING: run this ONLY AFTER the updated edge functions are deployed
-- (fetch-movies + enrich-movie-data with the "absent = none, no OMDb" allow-list logic).
-- The old code used these 'none'/'unknown' rows as a negative cache and re-created them
-- via OMDb on a miss; deleting them while the old code is live would trigger OMDb calls
-- for every non-Oscar movie. The populate migration (20260615140000) must also be applied.

DELETE FROM public.oscar_cache
WHERE oscar_status IN ('none', 'unknown');

-- Sanity: oscar_cache should now contain only 'winner' / 'nominee' rows (the allow-list).
