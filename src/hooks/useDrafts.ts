
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Participant, normalizeParticipants } from '@/types/participant';

export interface Draft {
  id: string;
  title: string;
  theme: string;
  option: string;
  participants: Participant[];
  categories: string[];
  is_complete: boolean;
  is_multiplayer: boolean;
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
  poster_path?: string | null;
}

export const useDrafts = () => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('drafts')
        .select('id, title, theme, option, participants, categories, is_complete, is_multiplayer, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Convert participants from string[] to Participant[] when loading
      const draftsWithParticipants = (data || []).map(draft => ({
        ...draft,
        participants: normalizeParticipants(draft.participants || [])
      }));
      
      setDrafts(draftsWithParticipants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch drafts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const deleteDraft = async (draftId: string) => {
    // Optimistically remove the draft from the UI
    setDrafts(prevDrafts => prevDrafts.filter(draft => draft.id !== draftId));
    
    // Refetch to ensure consistency
    await fetchDrafts();
  };

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  return {
    drafts,
    loading,
    error,
    refetch: fetchDrafts,
    deleteDraft
  };
};
