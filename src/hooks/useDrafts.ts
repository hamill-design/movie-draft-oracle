
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

  useEffect(() => {
    fetchDrafts();
  }, [user]);

  return {
    drafts,
    loading,
    error,
    refetch: fetchDrafts
  };
};
