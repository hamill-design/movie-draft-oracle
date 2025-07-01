
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Draft {
  id: string;
  title: string;
  theme: string;
  option: string;
  participants: string[];
  categories: string[];
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface DraftPick {
  id: string;
  draft_id: string;
  player_id: number;
  player_name: string;
  movie_id: number;
  movie_title: string;
  movie_year: number | null;
  movie_genre: string | null;
  category: string;
  pick_order: number;
}

export const useDrafts = () => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchDrafts = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrafts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch drafts');
    } finally {
      setLoading(false);
    }
  };

  const autoSaveDraft = async (draftData: {
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  }, existingDraftId?: string) => {
    if (!user) throw new Error('User not authenticated');

    // Generate a title based on theme and option
    const title = `${draftData.theme === 'year' ? 'Year' : 'Person'}: ${draftData.option}`;

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
          movie_genre: pick.movie.genre,
          category: pick.category,
          pick_order: index + 1
        }));

        const { error: picksError } = await supabase
          .from('draft_picks')
          .insert(picks);

        if (picksError) throw picksError;
      }

      return existingDraftId;
    } else {
      // Create new draft
      const { data: draft, error: draftError } = await supabase
        .from('drafts')
        .insert({
          title,
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
          movie_genre: pick.movie.genre,
          category: pick.category,
          pick_order: index + 1
        }));

        const { error: picksError } = await supabase
          .from('draft_picks')
          .insert(picks);

        if (picksError) throw picksError;
      }

      return draft.id;
    }
  };

  const saveDraft = async (draftData: {
    title: string;
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  }) => {
    if (!user) throw new Error('User not authenticated');

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
        movie_genre: pick.movie.genre,
        category: pick.category,
        pick_order: index + 1
      }));

      const { error: picksError } = await supabase
        .from('draft_picks')
        .insert(picks);

      if (picksError) throw picksError;
    }

    return draft;
  };

  const getDraftWithPicks = async (draftId: string) => {
    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError) throw draftError;

    const { data: picks, error: picksError } = await supabase
      .from('draft_picks')
      .select('*')
      .eq('draft_id', draftId)
      .order('pick_order');

    if (picksError) throw picksError;

    return { draft, picks };
  };

  useEffect(() => {
    fetchDrafts();
  }, [user]);

  return {
    drafts,
    loading,
    error,
    saveDraft,
    autoSaveDraft,
    getDraftWithPicks,
    refetch: fetchDrafts
  };
};
