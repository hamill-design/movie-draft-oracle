const STORAGE_OBJECT_PATH = '/storage/v1/object/public/';
const STORAGE_RENDER_PATH = '/storage/v1/render/image/public/';

/**
 * Supabase Storage URL -> same image resized server-side (and served as a smaller file).
 * Non-Supabase URLs are returned unchanged.
 */
export function resizedStorageUrl(url: string, width: number, quality = 75): string {
  if (!url.includes(STORAGE_OBJECT_PATH)) return url;
  return `${url.replace(STORAGE_OBJECT_PATH, STORAGE_RENDER_PATH)}?width=${width}&quality=${quality}`;
}
