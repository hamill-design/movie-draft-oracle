-- ============================================================
-- LEAGUES: Switch to F1-style position points
--
-- Points per draft finish:
--   1st → 10  |  2nd → 7  |  3rd → 5
--   4th → 3   |  5th → 2  |  6th+ → 1
--
-- DROP + recreate needed because total_score type changes
-- from numeric (raw movie score) to integer (league points).
--
-- raw_score column added as tiebreaker (original movie score sum).
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
