-- ============================================================
-- LEAGUES EXPANSION: Seasons, Messages, Scheduled Drafts
-- ============================================================

-- ── League Seasons ────────────────────────────────────────────
CREATE TABLE public.league_seasons (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id   UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT season_dates_valid CHECK (ends_at > starts_at)
);

ALTER TABLE public.league_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members can view seasons"
ON public.league_seasons FOR SELECT
USING (public.is_league_member(league_id));

CREATE POLICY "League admin can manage seasons"
ON public.league_seasons FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.leagues WHERE id = league_id AND admin_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.leagues WHERE id = league_id AND admin_id = auth.uid())
);

-- ── League Messages (flat + threaded replies via parent_id) ───
CREATE TABLE public.league_messages (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id   UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.league_messages(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.league_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_messages REPLICA IDENTITY FULL;

CREATE POLICY "League members can view messages"
ON public.league_messages FOR SELECT
USING (public.is_league_member(league_id));

CREATE POLICY "League members can post messages"
ON public.league_messages FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND public.is_league_member(league_id)
);

CREATE POLICY "Users can edit their own messages"
ON public.league_messages FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages, admins can delete any"
ON public.league_messages FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.leagues WHERE id = league_messages.league_id AND admin_id = auth.uid())
);

-- ── Expand league_drafts: season link + scheduled drafts ──────
-- Make draft_id nullable so we can store "scheduled but not yet started" drafts
ALTER TABLE public.league_drafts
  ALTER COLUMN draft_id DROP NOT NULL;

ALTER TABLE public.league_drafts
  ADD COLUMN season_id    UUID REFERENCES public.league_seasons(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_at TIMESTAMPTZ,
  ADD COLUMN draft_type   TEXT, -- 'classic' | 'year' | 'people' | 'spec-draft' | 'filmography'
  ADD COLUMN notes        TEXT; -- optional admin note shown to members

-- ── Season-scoped standings view ──────────────────────────────
-- Complements the existing all-time league_standings view.
-- Returns one row per (league, season, member); frontend filters by season.
CREATE OR REPLACE VIEW public.league_season_standings AS
SELECT
  lm.league_id,
  ld.season_id,
  lm.user_id,
  p.name         AS display_name,
  p.avatar_url   AS photo_url,
  COUNT(DISTINCT ld.id)             AS draft_count,
  COALESCE(SUM(dp.calculated_score), 0) AS total_score,
  ROW_NUMBER() OVER (
    PARTITION BY lm.league_id, ld.season_id
    ORDER BY COALESCE(SUM(dp.calculated_score), 0) DESC
  ) AS rank
FROM public.league_members lm
JOIN  public.profiles p ON p.id = lm.user_id
JOIN  public.league_drafts ld
        ON  ld.league_id  = lm.league_id
        AND ld.season_id  IS NOT NULL
        AND ld.draft_id   IS NOT NULL
LEFT JOIN public.draft_participants dpart
        ON  dpart.draft_id = ld.draft_id
        AND dpart.user_id  = lm.user_id
LEFT JOIN public.draft_picks dp
        ON  dp.draft_id    = ld.draft_id
        AND dp.player_name = dpart.participant_name
GROUP BY lm.league_id, ld.season_id, lm.user_id, p.name, p.avatar_url;

-- ── Realtime ──────────────────────────────────────────────────
ALTER TABLE public.league_seasons REPLICA IDENTITY FULL;
