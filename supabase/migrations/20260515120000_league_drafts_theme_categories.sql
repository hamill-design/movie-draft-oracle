-- Add theme and categories to league_drafts for scheduled draft previews
ALTER TABLE public.league_drafts
  ADD COLUMN theme      TEXT,
  ADD COLUMN categories TEXT[] NOT NULL DEFAULT '{}';
