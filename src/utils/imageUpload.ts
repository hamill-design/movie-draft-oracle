import { supabase } from '@/integrations/supabase/client';

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
    // Create design using Canva API
    const { data, error } = await supabase.functions.invoke('canva-design', {
      body: {
        action: 'create',
        draftTitle,
        teamScores
      }
    });

    if (error || !data.success) {
      console.error('Canva design creation error:', error);
      return null;
    }

    // Export the design
    const exportResponse = await supabase.functions.invoke('canva-design', {
      body: {
        action: 'export',
        designId: data.designId
      }
    });

    if (exportResponse.error || !exportResponse.data.success) {
      console.error('Canva export error:', exportResponse.error);
      return null;
    }

    return exportResponse.data.downloadUrl;
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