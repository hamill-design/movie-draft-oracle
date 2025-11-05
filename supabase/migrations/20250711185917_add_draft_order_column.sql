-- Add draft_order column to track the randomized player order
ALTER TABLE public.drafts 
ADD COLUMN draft_order text[] DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.drafts.draft_order IS 'Array of user_ids in the randomized draft order determined when draft starts';