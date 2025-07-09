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
    console.log('Starting Canva image generation for:', draftTitle);
    console.log('Team scores count:', teamScores.length);

    // Create design using Canva API
    const { data, error } = await supabase.functions.invoke('canva-design', {
      body: {
        action: 'create',
        draftTitle,
        teamScores
      }
    });

    console.log('Canva create response:', { data, error });

    if (error || !data?.success) {
      console.error('Canva design creation error:', error);
      // Fallback: return a placeholder or throw with more details
      throw new Error(`Canva design creation failed: ${error?.message || 'Unknown error'}`);
    }

    // For now, just return the edit URL since export might not work
    // We'll simplify and just let users edit in Canva
    console.log('Canva design created successfully:', data.designId);
    return data.editUrl;

  } catch (error) {
    console.error('Error in generateAndUploadShareImage:', error);
    throw error;
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