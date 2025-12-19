-- Quick check to see if photo_url column exists
-- Run this in Supabase SQL Editor

-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'spec_drafts' 
  AND column_name = 'photo_url';

-- If the above returns no rows, the column doesn't exist
-- Run the migration: 20251115000000_add_photo_url_to_spec_drafts.sql

-- Check current spec_drafts data
SELECT id, name, photo_url 
FROM spec_drafts 
LIMIT 5;

