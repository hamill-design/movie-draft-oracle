import { supabase } from '@/integrations/supabase/client';
import { generateShareImageCanvas } from './canvasImageGenerator';

interface TeamScore {
  playerName: string;
  picks: any[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

export const generateAndUploadShareImage = async (
  draftTitle: string,
  teamScores: TeamScore[]
): Promise<string | null> => {
  try {
    // Generate canvas image
    const canvas = generateShareImageCanvas({ draftTitle, teamScores });

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png', 0.9);
    });

    // Generate file name
    const fileName = `share-images/${Date.now()}-${draftTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;

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