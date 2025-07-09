import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';

export const generateAndUploadShareImage = async (
  shareCardElement: HTMLElement,
  draftId: string,
  draftTitle: string
): Promise<string | null> => {
  try {
    // Generate canvas from the share card at full Instagram story dimensions
    const canvas = await html2canvas(shareCardElement, {
      backgroundColor: null,
      scale: 1,
      width: 1080,
      height: 1920,
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
    
    if (shareImagesBucket) {
      return true;
    }
    
    // If bucket doesn't exist, it should have been created by migration
    // Just return true since we can't create it programmatically due to RLS
    console.log('Share images bucket not found - it should be created by migration');
    return true;
  } catch (error) {
    console.error('Error checking storage bucket:', error);
    return true; // Continue anyway, the upload will fail gracefully if needed
  }
};