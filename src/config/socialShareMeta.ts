/** Production site origin for absolute OG / Twitter image URLs */
export const SITE_ORIGIN = 'https://moviedrafter.com';

/** Static branded share image (keep in sync with `public/og-image.jpg` aspect ratio: 1.91:1) */
export const DEFAULT_OG_IMAGE_URL = `${SITE_ORIGIN}/og-image.jpg?v=2`;

/**
 * Declared dimensions for the static OG asset. Update if you replace `og-image.jpg`
 * with a different file (Discord/Facebook use these for aspect ratio).
 */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const OG_IMAGE_ALT =
  'Movie Drafter — movie drafting game for friends on a purple brand background';

const MAX_OG_TITLE_LEN = 90;
const MAX_OG_SUBTITLE_LEN = 120;

/**
 * Dynamic Open Graph image (Vercel Edge `api/og`). Same pixel size as static asset.
 * Safe to use when `draft.title` (or similar) is known; falls back to static image if API fails in theory—
 * callers should still use a sensible title string.
 */
export function dynamicOgImageUrl(params: { title: string; subtitle?: string }): string {
  const title = params.title.trim().slice(0, MAX_OG_TITLE_LEN) || 'Movie Drafter';
  const subtitle = (params.subtitle ?? '').trim().slice(0, MAX_OG_SUBTITLE_LEN);
  const u = new URL(`${SITE_ORIGIN}/api/og`);
  u.searchParams.set('title', title);
  if (subtitle) u.searchParams.set('subtitle', subtitle);
  return u.toString();
}
