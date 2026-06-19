-- Add alt text + caption metadata for the blog cover image (SEO + accessibility).
-- In-content (editor) images store their alt/caption inline in the post HTML,
-- so only the cover image needs dedicated columns.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_caption TEXT;
