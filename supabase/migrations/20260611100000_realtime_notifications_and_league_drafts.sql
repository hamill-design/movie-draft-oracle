-- ============================================================
-- Enable realtime for notifications + league_drafts
--
-- Both tables already have REPLICA IDENTITY FULL (set in their
-- creation/expansion migrations) and RLS policies that scope rows to
-- the right users:
--   - notifications: "user_id = auth.uid()"
--   - league_drafts: "is_league_member(league_id)"
--
-- The frontend has been subscribing to postgres_changes on both tables
-- all along (useNotifications' `notifications:<user_id>` channel, and
-- useLeagues' `league_drafts:<league_id>` channel), but neither table
-- was ever added to the supabase_realtime publication — so those
-- subscriptions never received a single event.
--
-- Concretely, this caused: when a league admin schedules a draft, the
-- AFTER INSERT trigger (notify_upcoming_draft) creates an "Upcoming
-- draft" notification row for every member, including the admin
-- themselves. Every other member sees it the next time they load the
-- app (a normal fetch). But the admin's bell was already mounted/fetched
-- *before* they scheduled the draft, so their copy never updates without
-- a manual reload — it looks like the admin "didn't get" the
-- notification.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_drafts;
