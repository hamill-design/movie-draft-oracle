
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
  user_id?: string | null;
  /** Set by useDrafts: 'host' (created draft) or 'guest' (joined as player) */
  role?: 'host' | 'guest';
  /** For multiplayer drafts, derived from draft_participants. */
  participant_count?: number;
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
    if (!user?.id) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    setLoading(true);
    setError(null);
    
    try {
      const baseDraftSelect =
        'id, title, theme, option, participants, categories, is_complete, is_multiplayer, created_at, updated_at, user_id';

      // Drafts you created (host)
      const { data: ownedDraftRows, error: ownedError } = await supabase
        .from('drafts')
        .select(baseDraftSelect)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Drafts you joined as an authenticated player (guest/player, not guest-session)
      // Uses FK: draft_participants.draft_id -> drafts.id
      const { data: joinedRows, error: joinedError } = await supabase
        .from('draft_participants')
        .select(
          `
          draft_id,
          drafts!inner (${baseDraftSelect})
        `
        )
        .eq('user_id', user.id);

      if (joinedError) throw joinedError;

      const ownedDrafts: Draft[] = (ownedDraftRows || []).map((draft: any) => ({
        ...draft,
        participants: normalizeParticipants(draft.participants || []),
        role: 'host' as const,
        is_complete: draft.is_complete ?? false,
        is_multiplayer: draft.is_multiplayer ?? false,
        created_at: draft.created_at ?? '',
        updated_at: draft.updated_at ?? '',
      }));

      const joinedDrafts: Draft[] = (joinedRows || [])
        .map((row: any) => row?.drafts)
        .filter(Boolean)
        .map((draft: any) => ({
          ...draft,
          participants: normalizeParticipants(draft.participants || []),
          role: draft.user_id === user.id ? ('host' as const) : ('guest' as const),
          is_complete: draft.is_complete ?? false,
          is_multiplayer: draft.is_multiplayer ?? false,
          created_at: draft.created_at ?? '',
          updated_at: draft.updated_at ?? '',
        }));

      // Merge: prefer owned (host) version if duplicates exist
      const byId = new Map<string, Draft>();
      for (const d of joinedDrafts) byId.set(d.id, d);
      for (const d of ownedDrafts) byId.set(d.id, d);

      const merged = Array.from(byId.values());

      // Multiplayer player count comes from draft_participants (drafts.participants can be empty)
      const multiplayerIds = merged.filter(d => d.is_multiplayer).map(d => d.id);
      if (multiplayerIds.length > 0) {
        const { data: participantRows, error: participantError } = await supabase
          .from('draft_participants')
          .select('draft_id')
          .in('draft_id', multiplayerIds);

        if (participantError) throw participantError;

        const counts = new Map<string, number>();
        for (const row of participantRows || []) {
          counts.set(row.draft_id, (counts.get(row.draft_id) || 0) + 1);
        }

        for (const d of merged) {
          if (d.is_multiplayer) {
            d.participant_count = counts.get(d.id) ?? 0;
          }
        }
      }

      merged.sort((a, b) => {
        const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTs - aTs;
      });

      setDrafts(merged);
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
