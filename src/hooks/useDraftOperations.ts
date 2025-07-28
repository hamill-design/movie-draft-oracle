
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useDraftOperations = () => {
  const { user, guestSession, isGuest } = useAuth();

  const autoSaveDraft = useCallback(async (draftData: {
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  }, existingDraftId?: string) => {
    if (!user && !guestSession) throw new Error('No session available');

    // Generate a simple title (just the option)
    const title = draftData.option;

    if (existingDraftId) {
      // Update existing draft
      const { error: draftError } = await supabase
        .from('drafts')
        .update({
          is_complete: draftData.isComplete,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDraftId);

      if (draftError) throw draftError;

      // Delete existing picks and re-insert them
      await supabase
        .from('draft_picks')
        .delete()
        .eq('draft_id', existingDraftId);

      if (draftData.picks.length > 0) {
        const picks = draftData.picks.map((pick, index) => ({
          draft_id: existingDraftId,
          player_id: pick.playerId,
          player_name: pick.playerName,
          movie_id: pick.movie.id,
          movie_title: pick.movie.title,
          movie_year: pick.movie.year,
          movie_genre: pick.movie.genre || 'Unknown',
          category: pick.category,
          pick_order: index + 1,
          poster_path: pick.movie.posterPath || pick.movie.poster_path || null
        }));

        const { error: picksError } = await supabase
          .from('draft_picks')
          .insert(picks);

        if (picksError) throw picksError;
      }

      return existingDraftId;
    } else {
      // Create new draft
      const draftInsert: any = {
        title,
        theme: draftData.theme,
        option: draftData.option,
        participants: draftData.participants,
        categories: draftData.categories,
        is_complete: draftData.isComplete,
      };

      if (user) {
        draftInsert.user_id = user.id;
      } else if (guestSession) {
        draftInsert.guest_session_id = guestSession.id;
        draftInsert.user_id = '00000000-0000-0000-0000-000000000000'; // Placeholder UUID for guest drafts
      }

      const { data: draft, error: draftError } = await supabase
        .from('drafts')
        .insert(draftInsert)
        .select()
        .single();

      if (draftError) throw draftError;

      // Save picks if any exist
      if (draftData.picks.length > 0) {
      const picks = draftData.picks.map((pick, index) => ({
        draft_id: draft.id,
        player_id: pick.playerId,
        player_name: pick.playerName,
        movie_id: pick.movie.id,
        movie_title: pick.movie.title,
        movie_year: pick.movie.year,
        movie_genre: pick.movie.genre || 'Unknown',
        category: pick.category,
        pick_order: index + 1,
        poster_path: pick.movie.posterPath || pick.movie.poster_path || null
      }));

        const { error: picksError } = await supabase
          .from('draft_picks')
          .insert(picks);

        if (picksError) throw picksError;
      }

      return draft.id;
    }
  }, [user, guestSession]);

  const saveDraft = useCallback(async (draftData: {
    title: string;
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  }) => {
    if (!user) throw new Error('User not authenticated for permanent save');

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .insert({
        title: draftData.title,
        theme: draftData.theme,
        option: draftData.option,
        participants: draftData.participants,
        categories: draftData.categories,
        is_complete: draftData.isComplete,
        user_id: user.id
      })
      .select()
      .single();

    if (draftError) throw draftError;

    // Save picks if any exist
    if (draftData.picks.length > 0) {
      const picks = draftData.picks.map((pick, index) => ({
        draft_id: draft.id,
        player_id: pick.playerId,
        player_name: pick.playerName,
        movie_id: pick.movie.id,
        movie_title: pick.movie.title,
        movie_year: pick.movie.year,
        movie_genre: pick.movie.genre || 'Unknown',
        category: pick.category,
        pick_order: index + 1,
        poster_path: pick.movie.posterPath || pick.movie.poster_path || null
      }));

      const { error: picksError } = await supabase
        .from('draft_picks')
        .insert(picks);

      if (picksError) throw picksError;
    }

    return draft;
  }, [user]);

  const getDraftWithPicks = useCallback(async (draftId: string, isPublicAccess: boolean = false) => {
    try {
      console.log('Fetching draft with ID:', draftId, 'Public access:', isPublicAccess);
      
      const { data: draft, error: draftError } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', draftId)
        .maybeSingle();

      if (draftError) {
        console.error('Draft fetch error:', draftError);
        throw draftError;
      }

      if (!draft) {
        throw new Error('Draft not found or you do not have access to this draft');
      }

      console.log('Draft fetched successfully:', draft);

      const { data: picks, error: picksError } = await supabase
        .from('draft_picks')
        .select('*')
        .eq('draft_id', draftId)
        .order('pick_order');

      if (picksError) {
        console.error('Picks fetch error:', picksError);
        throw picksError;
      }

      console.log('Picks fetched successfully:', picks);

      return { draft, picks };
    } catch (error) {
      console.error('Error in getDraftWithPicks:', error);
      throw error;
    }
  }, []);

  const makeDraftPublic = useCallback(async (draftId: string) => {
    if (!user && !guestSession) throw new Error('No session available');

    const { error } = await supabase
      .from('drafts')
      .update({ is_public: true })
      .eq('id', draftId);

    if (error) throw error;
  }, [user, guestSession]);

  return {
    autoSaveDraft,
    saveDraft,
    getDraftWithPicks,
    makeDraftPublic
  };
};
