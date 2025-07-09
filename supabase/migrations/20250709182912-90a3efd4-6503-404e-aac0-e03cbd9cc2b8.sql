-- Create storage bucket for share images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'share-images',
  'share-images', 
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
);

-- Create policy to allow public read access
CREATE POLICY "Share images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'share-images');

-- Create policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload share images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'share-images' AND
  auth.role() = 'authenticated'
);