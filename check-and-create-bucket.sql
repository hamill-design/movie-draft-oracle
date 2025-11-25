-- Quick script to check if bucket exists and create it if needed
-- Run this in Supabase SQL Editor

-- Check if bucket exists
SELECT id, name, public FROM storage.buckets WHERE id = 'spec-draft-photos';

-- If the above returns no rows, run this to create the bucket:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'spec-draft-photos',
  'spec-draft-photos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Verify bucket was created
SELECT id, name, public FROM storage.buckets WHERE id = 'spec-draft-photos';

-- Check if policies exist
SELECT policyname FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%spec draft photos%';

-- If policies don't exist, create them:
DROP POLICY IF EXISTS "Spec draft photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload spec draft photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update spec draft photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete spec draft photos" ON storage.objects;

CREATE POLICY "Spec draft photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'spec-draft-photos');

CREATE POLICY "Authenticated users can upload spec draft photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'spec-draft-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update spec draft photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'spec-draft-photos' AND
  auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'spec-draft-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete spec draft photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'spec-draft-photos' AND
  auth.role() = 'authenticated'
);

