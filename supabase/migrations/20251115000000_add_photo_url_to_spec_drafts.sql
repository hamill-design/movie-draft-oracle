-- Add photo_url column to spec_drafts table
ALTER TABLE public.spec_drafts 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create storage bucket for spec draft photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'spec-draft-photos',
  'spec-draft-photos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Spec draft photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload spec draft photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update spec draft photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete spec draft photos" ON storage.objects;

-- Create policy to allow public read access
CREATE POLICY "Spec draft photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'spec-draft-photos');

-- Create policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload spec draft photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'spec-draft-photos' AND
  auth.role() = 'authenticated'
);

-- Create policy to allow authenticated users to update
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

-- Create policy to allow authenticated users to delete
CREATE POLICY "Authenticated users can delete spec draft photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'spec-draft-photos' AND
  auth.role() = 'authenticated'
);

