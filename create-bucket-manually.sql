-- Manual script to create the spec-draft-photos bucket
-- Run this ENTIRE script in Supabase SQL Editor

-- Step 1: Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'spec-draft-photos',
  'spec-draft-photos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Step 2: Verify bucket was created
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'spec-draft-photos';

-- Step 3: Create policies (drop first if they exist)
DROP POLICY IF EXISTS "Spec draft photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload spec draft photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update spec draft photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete spec draft photos" ON storage.objects;

-- Step 4: Create the policies
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

-- Step 5: Verify policies were created
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%spec draft photos%';

