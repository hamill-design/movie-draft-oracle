import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getPendingDraft, clearPendingDraft } from '@/utils/draftStorage';

/**
 * Saves the draft a guest stashed in the browser (see `storePendingDraft`) to the account that just signed in,
 * then clears the stash. Shared by the sign-in page and the sign-in popup. Does nothing if nothing was stashed.
 */
export async function savePendingDraftForUser(userId: string): Promise<void> {
  // Check for pending draft in localStorage
  const pendingDraft = getPendingDraft();
  
  if (!pendingDraft) {
    console.log('No pending draft found in localStorage');
    return;
  }

  try {
    console.log('Saving pending draft after login:', pendingDraft);
    
    // Generate a default title with timestamp if not provided
    const now = new Date();
    const defaultTitle = pendingDraft.draftData.title || 
      `Copy of ${pendingDraft.draftData.option || 'Draft'} - ${now.toLocaleDateString()}`;
    
    // Save the draft directly using supabase (don't rely on hook's user state)
    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .insert({
        title: defaultTitle,
        theme: pendingDraft.draftData.theme,
        option: pendingDraft.draftData.option,
        participants: pendingDraft.draftData.participants,
        categories: pendingDraft.draftData.categories,
        is_complete: pendingDraft.draftData.isComplete,
        user_id: userId
      })
      .select()
      .single();

    if (draftError) throw draftError;

    // Save picks if any exist, including scoring data
    if (pendingDraft.draftData.picks.length > 0) {
      const picks = pendingDraft.draftData.picks.map((pick: any, index: number) => {
        const pickWithScoring = pick as any;
        return {
          draft_id: draft.id,
          player_id: pick.playerId,
          player_name: pick.playerName,
          movie_id: pick.movie.id,
          movie_title: pick.movie.title,
          movie_year: pick.movie.year,
          movie_genre: pick.movie.genre || 'Unknown',
          category: pick.category,
          pick_order: index + 1,
          poster_path: pick.movie.posterPath || pick.movie.poster_path || null,
          // Include scoring data if available
          calculated_score: pickWithScoring.calculated_score ?? null,
          rt_critics_score: pickWithScoring.rt_critics_score ?? null,
          rt_audience_score: pickWithScoring.rt_audience_score ?? null,
          imdb_rating: pickWithScoring.imdb_rating ?? null,
          metacritic_score: pickWithScoring.metacritic_score ?? null,
          movie_budget: pickWithScoring.movie_budget ?? null,
          movie_revenue: pickWithScoring.movie_revenue ?? null,
          oscar_status: pickWithScoring.oscar_status ?? null,
          scoring_data_complete: pickWithScoring.scoring_data_complete ?? false
        };
      });

      const { error: picksError } = await supabase
        .from('draft_picks')
        .insert(picks);

      if (picksError) throw picksError;
    }

    // Clear the pending draft from localStorage
    clearPendingDraft();

    toast({
      title: "Draft Saved!",
      description: "Your draft has been saved successfully.",
    });
  } catch (error) {
    console.error('Failed to save pending draft after login:', error);
    toast({
      title: "Save Failed",
      description: "Your draft couldn't be saved automatically. You can try saving it again from the draft page.",
      variant: "destructive",
    });
    // Don't clear localStorage on error - user might want to retry
  }
}
