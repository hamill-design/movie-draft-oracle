import { supabase } from '@/integrations/supabase/client';

const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/** Longest-side cap per image kind, applied while preserving aspect ratio. */
const MAX_DIMENSIONS: Record<'cover' | 'content', number> = {
  cover: 1600,
  content: 1200,
};

/**
 * Resizes an image so its longest side is at most `maxDimension`, preserving aspect ratio.
 * Returns the original file untouched if it's already small enough.
 */
const resizeImageToMaxDimension = (file: File, maxDimension: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;

        if (width <= maxDimension && height <= maxDimension) {
          resolve(file);
          return;
        }

        const scale = maxDimension / Math.max(width, height);
        const targetWidth = Math.round(width * scale);
        const targetHeight = Math.round(height * scale);

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
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          file.type || 'image/jpeg',
          0.9
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

  const resizedBlob = await resizeImageToMaxDimension(file, MAX_DIMENSIONS[kind]);

  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${kind}-${Date.now()}.${fileExt}`;
  const filePath = `${postId}/${fileName}`;
  const contentType = file.type || 'image/jpeg';

  const { error } = await supabase.storage
    .from('blog-images')
    .upload(filePath, resizedBlob, {
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
