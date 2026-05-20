-- Enable REPLICA IDENTITY FULL on league_drafts so realtime UPDATE events
-- carry the old row values needed for row-level filtering in subscriptions.
ALTER TABLE public.league_drafts REPLICA IDENTITY FULL;
