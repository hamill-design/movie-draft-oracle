-- ============================================================
-- LEAGUES: Replace custom per-league seasons with a universal
-- quarterly season system.
--
-- Seasons are no longer admin-defined rows (league_seasons) —
-- they're computed from calendar quarters (Q1 Jan-Mar ... Q4
-- Oct-Dec), derived per draft from COALESCE(scheduled_at,
-- drafts.created_at). This requires no backfill: every existing
-- league_drafts row already has a date, so it already has a
-- quarter.
-- ============================================================

DROP VIEW IF EXISTS public.league_season_standings;

ALTER TABLE public.league_drafts DROP COLUMN season_id;

DROP TABLE public.league_seasons;

-- ── Season (quarter) standings ──────────────────────────────────
CREATE VIEW public.league_season_standings AS
WITH draft_scores AS (
  SELECT
    ld.league_id,
    EXTRACT(YEAR    FROM COALESCE(ld.scheduled_at, d.created_at))::int AS season_year,
    EXTRACT(QUARTER FROM COALESCE(ld.scheduled_at, d.created_at))::int AS season_quarter,
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
  GROUP BY ld.league_id, season_year, season_quarter, ld.id, dpart.user_id
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
  dp2.season_year,
  dp2.season_quarter,
  lm.user_id,
  p.name         AS display_name,
  p.avatar_url   AS photo_url,
  COUNT(DISTINCT dp2.league_draft_id)                    AS draft_count,
  COALESCE(SUM(dp2.position_points), 0)::integer        AS total_score,
  COALESCE(SUM(dp2.raw_score),       0)                 AS raw_score,
  ROW_NUMBER() OVER (
    PARTITION BY lm.league_id, dp2.season_year, dp2.season_quarter
    ORDER BY
      COALESCE(SUM(dp2.position_points), 0) DESC,
      COALESCE(SUM(dp2.raw_score),       0) DESC
  ) AS rank
FROM public.league_members lm
JOIN  public.profiles p   ON p.id = lm.user_id
JOIN  draft_points dp2
  ON  dp2.league_id = lm.league_id
  AND dp2.user_id   = lm.user_id
GROUP BY lm.league_id, dp2.season_year, dp2.season_quarter, lm.user_id, p.name, p.avatar_url;

GRANT SELECT ON public.league_season_standings TO authenticated, anon;
