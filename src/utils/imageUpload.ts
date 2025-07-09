import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';

export const generateAndUploadShareImage = async (
  shareCardElement: HTMLElement,
  draftId: string,
  draftTitle: string
): Promise<string | null> => {
  try {
    // Generate canvas from the share card
    const canvas = await html2canvas(shareCardElement, {
      backgroundColor: null,
      scale: 2,
      width: 400,
      height: 600,
      useCORS: true,
    });

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png', 0.9);
    });

    // Generate file name
    const fileName = `share-images/${draftId}-${Date.now()}.png`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('share-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('share-images')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Error generating/uploading share image:', error);
    return null;
  }
};

export const ensureStorageBucketExists = async () => {
  try {
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const shareImagesBucket = buckets?.find(bucket => bucket.name === 'share-images');
    
    if (!shareImagesBucket) {
      // Create the bucket if it doesn't exist
      const { error } = await supabase.storage.createBucket('share-images', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: 1024 * 1024 * 2 // 2MB limit
      });
      
      if (error && !error.message.includes('already exists')) {
        console.error('Error creating storage bucket:', error);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking/creating storage bucket:', error);
    return false;
  }
};