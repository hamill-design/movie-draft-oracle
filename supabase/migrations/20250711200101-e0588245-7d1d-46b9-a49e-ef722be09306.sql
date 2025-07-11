-- Add turn_order column to store pre-calculated snake draft sequence
ALTER TABLE public.drafts 
ADD COLUMN turn_order JSONB;

-- Add comment for clarity
COMMENT ON COLUMN public.drafts.turn_order IS 'Pre-calculated snake draft turn sequence with player info and pick numbers';