-- ============================================================
-- Add player_ids to league_drafts
--
-- Stores which league members are participating in a scheduled
-- draft. Empty array = all current members are included.
-- ============================================================

ALTER TABLE public.league_drafts
  ADD COLUMN IF NOT EXISTS player_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
