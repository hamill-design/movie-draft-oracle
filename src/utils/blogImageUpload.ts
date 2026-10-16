import { supabase } from '@/integrations/supabase/client';

const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/** Longest-side cap per image kind, applied while preserving aspect ratio. */
const MAX_DIMENSIONS: Record<'cover' | 'content', number> = {
  cover: 1600,
  content: 1200,
};

/** WebP encoding quality (0–1). 0.85 is visually near-lossless with a big size win. */
const WEBP_QUALITY = 0.85;

/** Maps an image MIME type to a file extension for the stored object name. */
const EXT_BY_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
};

/**
 * Loads an image, downscales it so its longest side is at most `maxDimension`
 * (preserving aspect ratio; never upscales), and re-encodes it as WebP.
 *
 * Always returns a WebP blob, even when no resize is needed. If the browser
 * can't encode WebP, `canvas.toBlob` falls back to PNG — `blob.type` reflects
 * whatever was actually produced, so callers should trust it over the request.
 */
const resizeAndConvertToWebp = (file: File, maxDimension: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert image to WebP'));
            }
          },
          'image/webp',
          WEBP_QUALITY
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads an image for a blog post (cover photo or in-content image) to the
 * `blog-images` storage bucket, resizing it so its longest side fits within a
 * sensible limit. Returns the public URL.
 */
export const uploadBlogImage = async (
  postId: string,
  file: File,
  kind: 'cover' | 'content' = 'content'
): Promise<string> => {
  if (!VALID_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Please upload a PNG, JPEG, WebP, or GIF image.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 5MB limit. Please upload a smaller image.');
  }

  // Animated GIFs are uploaded untouched — a canvas only captures one frame, so
  // converting them to WebP here would silently drop the animation. Everything
  // else is resized and re-encoded to WebP for a smaller, faster-loading file.
  const isGif = file.type === 'image/gif';
  const uploadBlob: Blob = isGif
    ? file
    : await resizeAndConvertToWebp(file, MAX_DIMENSIONS[kind]);

  const contentType = uploadBlob.type || 'image/webp';
  const fileExt = EXT_BY_TYPE[contentType] || 'webp';
  const fileName = `${kind}-${Date.now()}.${fileExt}`;
  const filePath = `${postId}/${fileName}`;

  const { error } = await supabase.storage
    .from('blog-images')
    .upload(filePath, uploadBlob, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    if (error.message?.includes('Bucket not found') || error.message?.includes('does not exist')) {
      throw new Error('Storage bucket "blog-images" does not exist. Please apply the migration to create it.');
    }
    if (error.message?.includes('new row violates row-level security policy')) {
      throw new Error('Permission denied. Please ensure you are logged in and have admin access.');
    }
    throw error;
  }

  const { data: urlData } = supabase.storage.from('blog-images').getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded image');
  }

  return urlData.publicUrl;
};

/** Deletes a previously-uploaded blog image from storage given its public URL. */
export const deleteBlogImage = async (imageUrl: string): Promise<void> => {
  const urlParts = imageUrl.split('/blog-images/');
  if (urlParts.length !== 2) {
    throw new Error('Invalid image URL format');
  }

  const filePath = urlParts[1];

  const { error } = await supabase.storage.from('blog-images').remove([filePath]);

  if (error) {
    throw error;
  }
};
