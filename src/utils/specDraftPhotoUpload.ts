import { supabase } from '@/integrations/supabase/client';

/**
 * Resizes an image to 900x900 square and returns it as a Blob
 */
const resizeImageToSquare = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Create a canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set canvas size to 900x900
        canvas.width = 900;
        canvas.height = 900;

        // Calculate how to crop/center the image
        const sourceSize = Math.min(img.width, img.height);
        const sourceX = (img.width - sourceSize) / 2;
        const sourceY = (img.height - sourceSize) / 2;

        // Draw the image centered and cropped to square, then scaled to 900x900
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceSize, sourceSize, // Source rectangle (square crop)
          0, 0, 900, 900 // Destination rectangle (900x900)
        );

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          file.type || 'image/jpeg',
          0.9 // Quality (0-1)
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
 * Uploads a photo for a spec draft, resizing it to 900x900 square
 * @param specDraftId The ID of the spec draft
 * @param file The image file to upload
 * @returns The public URL of the uploaded photo
 */
export const uploadSpecDraftPhoto = async (
  specDraftId: string,
  file: File
): Promise<string> => {
  try {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a PNG, JPEG, or WebP image.');
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 5MB limit. Please upload a smaller image.');
    }

    // Check if bucket exists (but don't block if check fails - let the upload try)
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (!bucketsError && buckets) {
        const bucketExists = buckets.some(
          bucket => (bucket.name === 'spec-draft-photos') || (bucket.id === 'spec-draft-photos')
        );
        if (!bucketExists) {
          const bucketNames = buckets.map(b => b.name || b.id).join(', ') || 'none';
          throw new Error(
            `Storage bucket "spec-draft-photos" does not exist. ` +
            `Available buckets: ${bucketNames}. ` +
            `Please create the bucket in Supabase Dashboard → Storage.`
          );
        }
      }
      // If check fails, continue anyway - the upload will provide a more specific error
    } catch (checkError) {
      // If bucket check fails, continue to upload attempt
      console.warn('Bucket check failed, continuing with upload:', checkError);
    }

    // Resize image to 900x900
    const resizedBlob = await resizeImageToSquare(file);

    // Generate a unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${specDraftId}-${Date.now()}.${fileExt}`;
    const filePath = `${specDraftId}/${fileName}`;

    // Determine content type for the blob (use original file type, default to jpeg)
    const contentType = file.type || 'image/jpeg';
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('spec-draft-photos')
      .upload(filePath, resizedBlob, {
        contentType: contentType,
        upsert: false, // Don't overwrite existing files
        cacheControl: '3600',
      });

    if (error) {
      // Provide more helpful error messages
      if (error.message?.includes('Bucket not found') || error.message?.includes('does not exist')) {
        throw new Error('Storage bucket "spec-draft-photos" does not exist. Please apply the migration to create it.');
      } else if (error.message?.includes('new row violates row-level security policy')) {
        throw new Error('Permission denied. Please ensure you are logged in and have admin access.');
      } else if (error.statusCode === 400) {
        throw new Error(`Upload failed: ${error.message || 'Bad request. Please check file format and size.'}`);
      }
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('spec-draft-photos')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded photo');
    }

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading spec draft photo:', error);
    throw error;
  }
};

/**
 * Deletes a photo from storage
 * @param photoUrl The public URL of the photo to delete
 */
export const deleteSpecDraftPhoto = async (photoUrl: string): Promise<void> => {
  try {
    // Extract the file path from the URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/spec-draft-photos/[path]
    const urlParts = photoUrl.split('/spec-draft-photos/');
    if (urlParts.length !== 2) {
      throw new Error('Invalid photo URL format');
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from('spec-draft-photos')
      .remove([filePath]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting spec draft photo:', error);
    throw error;
  }
};

