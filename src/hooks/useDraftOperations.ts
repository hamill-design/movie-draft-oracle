
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Participant, participantsToStrings, normalizeParticipants } from '@/types/participant';

export const useDraftOperations = () => {
  const { user, guestSession } = useAuth();

  const autoSaveDraft = useCallback(async (draftData: {
    theme: string;
    option: string;
    participants: string[] | Participant[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  }, existingDraftId?: string) => {
    // Normalize participants and convert to string[] for database storage
    const normalizedParticipants = normalizeParticipants(draftData.participants);
    const participantsForDB = participantsToStrings(normalizedParticipants);
    if (!user && !guestSession) throw new Error('No session available');

    // Generate a simple title (just the option)
    const title = draftData.option;

    if (existingDraftId) {
      // Update existing draft
      const updateData: any = {
        is_complete: draftData.isComplete,
        updated_at: new Date().toISOString()
      };
      
      // For guest drafts, mark as public when completed so they can be viewed
      if (draftData.isComplete && !user && guestSession) {
        updateData.is_public = true;
        
        // Set guest session context before updating so RLS policy can match
        try {
          await supabase.rpc('set_guest_session_context', {
            session_id: guestSession.id
          });
        } catch (contextError) {
          console.warn('Failed to set guest session context:', contextError);
          // Continue anyway - the update might still work if RLS allows it
        }
      }
      
      console.log('Draft updated:', existingDraftId);
      
      const { error: draftError } = await supabase
        .from('drafts')
        .update(updateData)
        .eq('id', existingDraftId);

      if (draftError) {
        console.error('Draft update error:', draftError);
        throw draftError;
      }

      // Delete existing picks and re-insert them
      await supabase
        .from('draft_picks')
        .delete()
        .eq('draft_id', existingDraftId);

      if (draftData.picks.length > 0) {
        const picks = draftData.picks.map((pick, index) => {
          const pickWithScoring = pick as any;
          return {
            draft_id: existingDraftId,
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

      return existingDraftId;
    } else {
      // Create new draft
      const draftInsert: any = {
        title,
        theme: draftData.theme,
        option: draftData.option,
        participants: participantsForDB,
        categories: draftData.categories,
        is_complete: draftData.isComplete,
      };

      if (user) {
        draftInsert.user_id = user.id;
      } else if (guestSession) {
        draftInsert.guest_session_id = guestSession.id;
        draftInsert.user_id = '00000000-0000-0000-0000-000000000000'; // Placeholder UUID for guest drafts
        
        // For guest drafts, mark as public when completed so they can be viewed
        if (draftData.isComplete) {
          draftInsert.is_public = true;
        }
      }

      const { data: draft, error: draftError } = await supabase
        .from('drafts')
        .insert(draftInsert)
        .select()
        .single();

      if (draftError) throw draftError;
      
      console.log('Draft created with ID:', draft.id, 'Theme:', draftData.theme, 'Guest:', !!guestSession);

      // Save picks if any exist
      if (draftData.picks.length > 0) {
      const picks = draftData.picks.map((pick, index) => {
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

      return draft.id;
    }
  }, [user, guestSession]);

  const saveDraft = useCallback(async (draftData: {
    title: string;
    theme: string;
    option: string;
    participants: string[] | Participant[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  }) => {
    if (!user) throw new Error('User not authenticated for permanent save');

    // Validate draft data structure
    if (!draftData.theme || !draftData.option || !Array.isArray(draftData.participants) || !Array.isArray(draftData.categories)) {
      throw new Error('Invalid draft data structure');
    }

    // Normalize participants and convert to string[] for database storage
    const normalizedParticipants = normalizeParticipants(draftData.participants);
    const participantsForDB = participantsToStrings(normalizedParticipants);

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .insert({
        title: draftData.title,
        theme: draftData.theme,
        option: draftData.option,
        participants: participantsForDB,
        categories: draftData.categories,
        is_complete: draftData.isComplete,
        user_id: user.id
      })
      .select()
      .single();

    if (draftError) throw draftError;

    // Save picks if any exist
    if (draftData.picks.length > 0) {
      const picks = draftData.picks.map((pick, index) => {
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

  const findExistingDraft = useCallback(async (draftData: {
    theme: string;
    option: string;
    participants: string[] | Participant[];
    categories: string[];
  }) => {
    // Normalize participants and convert to string[] for comparison
    const normalizedParticipants = normalizeParticipants(draftData.participants);
    const participantsForComparison = participantsToStrings(normalizedParticipants);
    if (!user && !guestSession) return null;

    try {
      let query = supabase
        .from('drafts')
        .select('id, is_complete, created_at')
        .eq('theme', draftData.theme)
        .eq('option', draftData.option)
        .eq('is_multiplayer', false) // Only check local drafts
        .order('created_at', { ascending: false })
        .limit(1);

      if (user) {
        query = query.eq('user_id', user.id);
      } else if (guestSession) {
        query = query.eq('guest_session_id', guestSession.id);
      }

      const { data: drafts, error } = await query;

      if (error) {
        console.error('Error finding existing draft:', error);
        return null;
      }

      if (!drafts || drafts.length === 0) {
        return null;
      }

      // Check if participants and categories match (arrays need special comparison)
      const draft = drafts[0];
      const { data: fullDraft } = await supabase
        .from('drafts')
        .select('participants, categories')
        .eq('id', draft.id)
        .single();

      if (!fullDraft) return null;

      // Compare participants arrays
      // Normalize both to Participant[] format first, then compare names
      const draftParticipants = normalizeParticipants(fullDraft.participants || []);
      const normalizedForComparison = normalizeParticipants(draftData.participants);
      const draftNames = draftParticipants.map(p => p.name).sort();
      const comparisonNames = normalizedForComparison.map(p => p.name).sort();
      const participantsMatch = JSON.stringify(draftNames) === JSON.stringify(comparisonNames);
      
      const categoriesMatch = 
        JSON.stringify([...fullDraft.categories].sort()) === 
        JSON.stringify([...draftData.categories].sort());

      if (participantsMatch && categoriesMatch) {
        return draft.id;
      }

      return null;
    } catch (error) {
      console.error('Error in findExistingDraft:', error);
      return null;
    }
  }, [user, guestSession]);

  return {
    autoSaveDraft,
    saveDraft,
    getDraftWithPicks,
    makeDraftPublic,
    findExistingDraft
  };
};
