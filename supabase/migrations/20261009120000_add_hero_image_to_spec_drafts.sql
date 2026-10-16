-- Separate hero/banner image for the public /special-draft/:slug page.
-- photo_url stays the square card image; when hero_image_url is empty the page falls back to photo_url.
ALTER TABLE public.spec_drafts
ADD COLUMN IF NOT EXISTS hero_image_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.spec_drafts.hero_image_url IS 'Wide banner image shown behind the breadcrumbs on the public special draft page';
