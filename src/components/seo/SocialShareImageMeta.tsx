import type { ReactNode } from 'react';
import {
  DEFAULT_OG_IMAGE_URL,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from '@/config/socialShareMeta';

export type SocialShareImageMetaProps = {
  /** Full URL to og-image.jpg or `/api/og?...` */
  imageUrl?: string;
  /** Describe the image for accessibility and platforms that support image alt */
  imageAlt?: string;
};

/**
 * Open Graph + Twitter image tags for use inside react-helmet-async's `<Helmet>`.
 *
 * Call as `{socialShareImageMetaNodes()}` — not `<SocialShareImageMeta />`. Helmet only
 * accepts native head elements (or fragments of them); custom components as direct
 * children throw a misleading "nested Helmet" invariant.
 */
export function socialShareImageMetaNodes({
  imageUrl = DEFAULT_OG_IMAGE_URL,
  imageAlt = OG_IMAGE_ALT,
}: SocialShareImageMetaProps = {}): ReactNode {
  return (
    <>
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
      <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={imageAlt} />
    </>
  );
}
