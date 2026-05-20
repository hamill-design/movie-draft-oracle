-- Add league_messages to the Realtime publication so cross-client updates work.
-- REPLICA IDENTITY FULL was already set in the previous migration.
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_messages;
