-- Speeds up the multiplayer drafts list query (filter is_multiplayer, order by created_at DESC, limit)
-- by letting Postgres scan created_at in sorted order instead of a full seq scan + sort.
CREATE INDEX IF NOT EXISTS drafts_created_at_idx ON public.drafts USING btree (created_at);

-- league_drafts_league_id_draft_id_key has league_id as its leading column, so lookups
-- filtering by draft_id alone (e.g. league draft detail/summary queries) can't seek on it.
CREATE INDEX IF NOT EXISTS league_drafts_draft_id_idx ON public.league_drafts USING btree (draft_id);

-- notifications had no indexes at all. Composite covers the bell/feed query
-- (user_id + type filter, created_at sort) in a single index scan.
CREATE INDEX IF NOT EXISTS notifications_user_id_type_created_at_idx ON public.notifications USING btree (user_id, type, created_at);

-- Covers lookups by reference_id (e.g. updating/clearing notifications tied to a specific draft/league invite).
CREATE INDEX IF NOT EXISTS notifications_reference_id_idx ON public.notifications USING btree (reference_id);
