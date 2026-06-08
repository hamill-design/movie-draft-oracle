-- ============================================================
-- LEAGUES: Fix standings to only count completed drafts
--
-- Bug: the league_standings and league_season_standings views
-- included in-progress drafts in the scoring. A draft where
-- all players have 0 picks scored gives everyone a rank-1
-- finish → everyone gets 10 pts they haven't earned yet.
--
-- Fix: JOIN drafts d and require d.is_complete = TRUE so only
-- finished drafts contribute to F1-style position points.
-- ============================================================

DROP VIEW IF EXISTS public.league_season_standings;
DROP VIEW IF EXISTS public.league_standings;

-- ── All-time standings ────────────────────────────────────────
CREATE VIEW public.league_standings AS
WITH draft_scores AS (
  SELECT
    ld.league_id,
    ld.id               AS league_draft_id,
    dpart.user_id,
    COALESCE(SUM(dp.calculated_score), 0) AS raw_score
  FROM public.league_drafts ld
  JOIN public.drafts d
    ON  d.id          = ld.draft_id
    AND d.is_complete = TRUE              -- only completed drafts
  JOIN public.draft_participants dpart
    ON dpart.draft_id = ld.draft_id
  LEFT JOIN public.draft_picks dp
    ON  dp.draft_id    = ld.draft_id
    AND dp.player_name = dpart.participant_name
  WHERE ld.draft_id IS NOT NULL
  GROUP BY ld.league_id, ld.id, dpart.user_id
),
draft_ranks AS (
  SELECT *,
    RANK() OVER (
      PARTITION BY league_draft_id
      ORDER BY raw_score DESC
    ) AS finish_rank
  FROM draft_scores
),
draft_points AS (
  SELECT *,
    CASE finish_rank
      WHEN 1 THEN 10
      WHEN 2 THEN 7
      WHEN 3 THEN 5
      WHEN 4 THEN 3
      WHEN 5 THEN 2
      ELSE        1
    END AS position_points
  FROM draft_ranks
)
SELECT
  lm.league_id,
  lm.user_id,
  p.name         AS display_name,
  p.avatar_url   AS photo_url,
  COUNT(DISTINCT dp2.league_draft_id)                    AS draft_count,
  COALESCE(SUM(dp2.position_points), 0)::integer        AS total_score,
  COALESCE(SUM(dp2.raw_score),       0)                 AS raw_score,
  ROW_NUMBER() OVER (
    PARTITION BY lm.league_id
    ORDER BY
      COALESCE(SUM(dp2.position_points), 0) DESC,
      COALESCE(SUM(dp2.raw_score),       0) DESC
  ) AS rank
FROM public.league_members lm
JOIN  public.profiles p   ON p.id = lm.user_id
LEFT JOIN draft_points dp2
  ON  dp2.league_id = lm.league_id
  AND dp2.user_id   = lm.user_id
GROUP BY lm.league_id, lm.user_id, p.name, p.avatar_url;


-- ── Season standings ──────────────────────────────────────────
CREATE VIEW public.league_season_standings AS
WITH draft_scores AS (
  SELECT
    ld.league_id,
    ld.season_id,
    ld.id               AS league_draft_id,
    dpart.user_id,
    COALESCE(SUM(dp.calculated_score), 0) AS raw_score
  FROM public.league_drafts ld
  JOIN public.drafts d
    ON  d.id          = ld.draft_id
    AND d.is_complete = TRUE              -- only completed drafts
  JOIN public.draft_participants dpart
    ON dpart.draft_id = ld.draft_id
  LEFT JOIN public.draft_picks dp
    ON  dp.draft_id    = ld.draft_id
    AND dp.player_name = dpart.participant_name
  WHERE ld.draft_id   IS NOT NULL
    AND ld.season_id  IS NOT NULL
  GROUP BY ld.league_id, ld.season_id, ld.id, dpart.user_id
),
draft_ranks AS (
  SELECT *,
    RANK() OVER (
      PARTITION BY league_draft_id
      ORDER BY raw_score DESC
    ) AS finish_rank
  FROM draft_scores
),
draft_points AS (
  SELECT *,
    CASE finish_rank
      WHEN 1 THEN 10
      WHEN 2 THEN 7
      WHEN 3 THEN 5
      WHEN 4 THEN 3
      WHEN 5 THEN 2
      ELSE        1
    END AS position_points
  FROM draft_ranks
)
SELECT
  lm.league_id,
  dp2.season_id,
  lm.user_id,
  p.name         AS display_name,
  p.avatar_url   AS photo_url,
  COUNT(DISTINCT dp2.league_draft_id)                    AS draft_count,
  COALESCE(SUM(dp2.position_points), 0)::integer        AS total_score,
  COALESCE(SUM(dp2.raw_score),       0)                 AS raw_score,
  ROW_NUMBER() OVER (
    PARTITION BY lm.league_id, dp2.season_id
    ORDER BY
      COALESCE(SUM(dp2.position_points), 0) DESC,
      COALESCE(SUM(dp2.raw_score),       0) DESC
  ) AS rank
FROM public.league_members lm
JOIN  public.profiles p   ON p.id = lm.user_id
JOIN  draft_points dp2
  ON  dp2.league_id = lm.league_id
  AND dp2.user_id   = lm.user_id
GROUP BY lm.league_id, dp2.season_id, lm.user_id, p.name, p.avatar_url;


-- Grant read access (same as original views)
GRANT SELECT ON public.league_standings        TO authenticated, anon;
GRANT SELECT ON public.league_season_standings TO authenticated, anon;
