-- One-time data fix for the first scheduled league draft created before
-- start_league_draft_rpc_v8 (theme normalization / title fallback / invited
-- vs joined status). This specific drafts row was created by v7, which:
--   - left theme = 'filmography' (raw league_drafts.draft_type) instead of
--     the normalized 'people', so LeagueDraftCard couldn't show the actor
--     portrait or derive a "Steven Spielberg" title from it
--   - left title = 'League Draft' (no admin note was written, and v7 had no
--     theme-based fallback yet)
--   - pre-joined the 3 non-host participants with status='joined' even
--     though they hadn't opened the draft room yet
--
-- v8 + the load_draft_unified update fix this for *future* scheduled
-- drafts; this migration corrects the one row that already exists.
UPDATE public.drafts
SET theme = 'people',
    title = 'Steven Spielberg'
WHERE id = 'ba6c1bf9-079d-4d2f-b0d3-b3537115a8d2'
  AND theme = 'filmography'
  AND title = 'League Draft';

-- Non-host participants haven't actually opened this draft yet — correct
-- their status from 'joined' back to 'invited'. load_draft_unified will
-- flip each one to 'joined' the moment they actually load the draft.
UPDATE public.draft_participants
SET status = 'invited'
WHERE draft_id = 'ba6c1bf9-079d-4d2f-b0d3-b3537115a8d2'
  AND is_host = FALSE
  AND status = 'joined';
