-- Add display_order and is_hidden columns to spec_drafts table
ALTER TABLE public.spec_drafts 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Create index for display_order
CREATE INDEX IF NOT EXISTS idx_spec_drafts_display_order 
  ON public.spec_drafts(display_order);

-- Update existing rows to have display_order based on created_at
UPDATE public.spec_drafts
SET display_order = subquery.row_number
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_number
  FROM public.spec_drafts
) AS subquery
WHERE spec_drafts.id = subquery.id;

-- Add comments
COMMENT ON COLUMN public.spec_drafts.display_order IS 'Display order for spec drafts (lower numbers appear first)';
COMMENT ON COLUMN public.spec_drafts.is_hidden IS 'Whether this spec draft should be hidden from public view';

