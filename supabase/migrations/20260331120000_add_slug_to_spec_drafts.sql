-- URL-friendly unique slug for spec draft setup pages (SEO)
ALTER TABLE public.spec_drafts ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill from name; disambiguate duplicates with a short id suffix
UPDATE public.spec_drafts sd
SET slug = computed.final_slug
FROM (
  SELECT id,
    CASE
      WHEN dup_count > 1 THEN base_slug || '-' || substring(replace(id::text, '-', ''), 1, 8)
      ELSE base_slug
    END AS final_slug
  FROM (
    SELECT id,
      COALESCE(
        NULLIF(
          trim(both '-' FROM regexp_replace(regexp_replace(lower(name), '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g')),
          ''
        ),
        'draft'
      ) AS base_slug,
      COUNT(*) OVER (
        PARTITION BY COALESCE(
          NULLIF(
            trim(both '-' FROM regexp_replace(regexp_replace(lower(name), '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g')),
            ''
          ),
          'draft'
        )
      ) AS dup_count
    FROM public.spec_drafts
  ) x
) computed
WHERE sd.id = computed.id AND (sd.slug IS NULL OR sd.slug = '');

ALTER TABLE public.spec_drafts ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spec_drafts_slug ON public.spec_drafts (slug);

COMMENT ON COLUMN public.spec_drafts.slug IS 'URL path segment for /spec-draft/:slug/setup; derived from name, unique';
