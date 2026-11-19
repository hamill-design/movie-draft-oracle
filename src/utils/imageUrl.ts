const STORAGE_OBJECT_PATH = '/storage/v1/object/public/';
const STORAGE_RENDER_PATH = '/storage/v1/render/image/public/';

/**
 * Supabase Storage URL -> same image resized server-side (and served as a smaller file).
 * Non-Supabase URLs are returned unchanged.
 *
 * `resize=contain` matters: with only a width, Supabase's default (`cover`) keeps the ORIGINAL height
 * and center-crops the width, so a wide 5104x2676 hero came back as a tall 1920x2676 slice and the
 * banner showed a zoomed-in middle. `contain` scales the whole image to the width, aspect ratio intact.
 */
export function resizedStorageUrl(url: string, width: number, quality = 75): string {
  if (!url.includes(STORAGE_OBJECT_PATH)) return url;
  return `${url.replace(STORAGE_OBJECT_PATH, STORAGE_RENDER_PATH)}?width=${width}&quality=${quality}&resize=contain`;
}
