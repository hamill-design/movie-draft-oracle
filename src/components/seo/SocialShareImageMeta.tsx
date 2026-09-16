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
 * accepts native head elements; custom components as direct children throw a misleading
 * "nested Helmet" invariant.
 */
export function socialShareImageMetaNodes({
  imageUrl = DEFAULT_OG_IMAGE_URL,
  imageAlt = OG_IMAGE_ALT,
}: SocialShareImageMetaProps = {}): ReactNode {
  // An array, not a fragment: Helmet only walks direct children, so tags wrapped in
  // <></> are silently dropped and the index.html default image wins.
  return [
    <meta key="og:image" property="og:image" content={imageUrl} />,
    <meta key="og:image:width" property="og:image:width" content={String(OG_IMAGE_WIDTH)} />,
    <meta key="og:image:height" property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />,
    <meta key="og:image:alt" property="og:image:alt" content={imageAlt} />,
    <meta key="twitter:image" name="twitter:image" content={imageUrl} />,
    <meta key="twitter:image:alt" name="twitter:image:alt" content={imageAlt} />,
  ];
}
