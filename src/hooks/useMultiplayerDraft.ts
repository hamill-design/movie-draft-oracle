import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DraftParticipant {
  id: string;
  user_id: string;
  participant_name: string;
  status: 'invited' | 'joined' | 'left';
  is_host: boolean;
  joined_at: string | null;
}

interface MultiplayerDraft {
  id: string;
  title: string;
  theme: string;
  option: string;
  categories: string[];
  participants: string[];
  current_turn_user_id: string | null;
  current_pick_number: number;
  is_complete: boolean;
  is_multiplayer: boolean;
  invite_code: string | null;
  draft_order: string[] | null;
  turn_order: any;
}

export const useMultiplayerDraft = (draftId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [draft, setDraft] = useState<MultiplayerDraft | null>(null);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);

  // Create a multiplayer draft with email invitations
  const createMultiplayerDraft = useCallback(async (draftData: {
    title: string;
    theme: string;
    option: string;
    categories: string[];
    participantEmails: string[];  // Changed from participantNames to participantEmails
  }) => {
    if (!user) throw new Error('User not authenticated');

    try {
      setLoading(true);

      // Create the draft (without setting current_turn_user_id yet - draft hasn't started)
      const { data: newDraft, error: draftError } = await supabase
        .from('drafts')
        .insert({
          title: draftData.title,
          theme: draftData.theme,
          option: draftData.option,
          categories: draftData.categories,
          participants: draftData.participantEmails, // Store emails as participants
          user_id: user.id,
          is_multiplayer: true,
          current_pick_number: 1,
          // Don't set current_turn_user_id yet - draft hasn't started
        })
        .select()
        .single();

      if (draftError) throw draftError;

      // Create a participant record for the host
      const { error: hostParticipantError } = await supabase
        .from('draft_participants')
        .insert({
          draft_id: newDraft.id,
          user_id: user.id,
          participant_name: user.email || 'Host',
          status: 'joined',
          is_host: true,
          joined_at: new Date().toISOString(),
        });

      if (hostParticipantError) {
        console.error('Failed to create host participant:', hostParticipantError);
        // Don't fail the draft creation if this fails
      }

      // Send email invitations to participants
      try {
        const inviteResponse = await supabase.functions.invoke('send-draft-invitations', {
          body: {
            draftId: newDraft.id,
            draftTitle: draftData.title,
            hostName: user.email || 'Unknown Host',
            participantEmails: draftData.participantEmails,
            theme: draftData.theme,
            option: draftData.option,
          }
        });

        if (inviteResponse.error) {
          console.error('Failed to send invitations:', inviteResponse.error);
          // Don't fail the draft creation if email sending fails
        } else {
          console.log('Invitations sent successfully:', inviteResponse.data);
        }
      } catch (emailError) {
        console.error('Email invitation error:', emailError);
        // Continue with draft creation even if emails fail
      }

      return newDraft;
    } catch (error) {
      console.error('Error creating multiplayer draft:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Start the draft with pre-calculated snake draft turn order
  const startDraft = useCallback(async (draftId: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      setLoading(true);

      // Get all joined participants
      const { data: participants, error: participantsError } = await supabase
        .from('draft_participants')
        .select('*')
        .eq('draft_id', draftId)
        .eq('status', 'joined')
        .order('joined_at');

      if (participantsError) throw participantsError;
      
      if (participants.length < 2) {
        throw new Error('Need at least 2 players to start the draft');
      }

      // Get draft details to know categories
      const { data: draftData, error: draftError } = await supabase
        .from('drafts')
        .select('categories')
        .eq('id', draftId)
        .single();

      if (draftError) throw draftError;

      // Randomize the participant order
      const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
      
      // Generate complete snake draft turn order (like single-player draftOrder)
      const numPlayers = shuffledParticipants.length;
      const numCategories = draftData.categories.length;
      const turnOrder = [];
      
      for (let round = 0; round < numCategories; round++) {
        if (round % 2 === 0) {
          // Forward order
          for (let i = 0; i < numPlayers; i++) {
            turnOrder.push({
              user_id: shuffledParticipants[i].user_id,
              participant_name: shuffledParticipants[i].participant_name,
              round,
              pick_number: turnOrder.length + 1
            });
          }
        } else {
          // Reverse order (snake draft)
          for (let i = numPlayers - 1; i >= 0; i--) {
            turnOrder.push({
              user_id: shuffledParticipants[i].user_id,
              participant_name: shuffledParticipants[i].participant_name,
              round,
              pick_number: turnOrder.length + 1
            });
          }
        }
      }

      // Start the draft with the first turn
      const firstTurn = turnOrder[0];
      
      console.log('Generated complete turn order:', turnOrder);
      console.log('First player:', firstTurn.participant_name);

      const { error: updateError } = await supabase
        .from('drafts')
        .update({
          current_turn_user_id: firstTurn.user_id,
          current_pick_number: 1,
          turn_order: turnOrder
        })
        .eq('id', draftId);

      if (updateError) throw updateError;

      toast({
        title: "Draft Started!",
        description: `${firstTurn.participant_name} goes first!`,
      });

    } catch (error) {
      console.error('Error starting draft:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start draft",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Join a draft by invite code
  const joinDraftByCode = useCallback(async (inviteCode: string, participantName: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('join_draft_by_invite_code', {
        invite_code_param: inviteCode,
        participant_name_param: participantName,
      });

      if (error) throw error;

      // Find the draft by invite code to get its details
      const { data: draftData, error: draftError } = await supabase
        .from('drafts')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();

      if (draftError) throw draftError;

      toast({
        title: "Joined Draft",
        description: "Successfully joined the draft!",
      });

      // Navigate to the draft page with multiplayer flag
      navigate('/draft', {
        state: {
          theme: draftData.theme,
          option: draftData.option,
          participants: draftData.participants,
          categories: draftData.categories,
          existingDraftId: draftData.id,
          isMultiplayer: true
        }
      });

      return data;
    } catch (error: any) {
      console.error('Error joining draft:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to join draft",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, toast, navigate]);

  // Load draft data
  const loadDraft = useCallback(async (id: string) => {
    console.log('🔍 DIAGNOSTIC v1.0 - Loading draft:', id);
    if (!user) {
      console.log('🚫 DIAGNOSTIC v1.0 - No user, skipping loadDraft');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 DIAGNOSTIC v1.0 - Loading draft data...');

      // Load draft
      const { data: draftData, error: draftError } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', id)
        .single();

      if (draftError) {
        console.log('🚫 DIAGNOSTIC v1.0 - Draft load error:', draftError);
        throw draftError;
      }
      
      console.log('🔍 DIAGNOSTIC v1.0 - Draft data loaded:', draftData);
      console.log('🔍 DIAGNOSTIC v1.0 - Draft turn_order:', draftData.turn_order);
      console.log('🔍 DIAGNOSTIC v1.0 - Draft turn_order type:', typeof draftData.turn_order);
      setDraft(draftData);

      // Load participants
      console.log('🔍 DIAGNOSTIC v1.0 - Loading participants...');
      const { data: participantsData, error: participantsError } = await supabase
        .from('draft_participants')
        .select('*')
        .eq('draft_id', id)
        .order('created_at');

      if (participantsError) {
        console.log('🚫 DIAGNOSTIC v1.0 - Participants load error:', participantsError);
        throw participantsError;
      }
      
      console.log('🔍 DIAGNOSTIC v1.0 - Participants loaded:', participantsData);
      setParticipants(participantsData);

      // Load picks
      console.log('🔍 DIAGNOSTIC v1.0 - Loading picks...');
      const { data: picksData, error: picksError } = await supabase
        .from('draft_picks')
        .select('*')
        .eq('draft_id', id)
        .order('pick_order');

      if (picksError) {
        console.log('🚫 DIAGNOSTIC v1.0 - Picks load error:', picksError);
        throw picksError;
      }
      
      console.log('🔍 DIAGNOSTIC v1.0 - Picks loaded:', picksData);
      setPicks(picksData);

      // Check if it's the current user's turn
      const isMyTurn = draftData.current_turn_user_id === user.id;
      console.log('🔍 DIAGNOSTIC v1.0 - Setting isMyTurn:', isMyTurn);
      console.log('🔍 DIAGNOSTIC v1.0 - Current turn user ID:', draftData.current_turn_user_id);
      console.log('🔍 DIAGNOSTIC v1.0 - My user ID:', user.id);
      setIsMyTurn(isMyTurn);

    } catch (error) {
      console.error('🚫 DIAGNOSTIC v1.0 - Error loading draft:', error);
      toast({
        title: "Error",
        description: "DIAGNOSTIC v1.0 - Failed to load draft",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log('🔍 DIAGNOSTIC v1.0 - Load draft completed');
    }
  }, [user, toast]);

  // Make a pick using atomic database function
  const makePick = useCallback(async (movie: any, category: string) => {
    if (!user || !draft || !isMyTurn) {
      console.log('🚫 ATOMIC v1.0 - Validation failed:', {
        hasUser: !!user,
        hasDraft: !!draft,
        isMyTurn,
        userId: user?.id,
        draftCurrentTurnUserId: draft?.current_turn_user_id
      });
      toast({
        title: "Error",
        description: "It's not your turn!",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      console.log('🔍 ATOMIC v1.0 - Making pick with atomic function:', {
        draftId: draft.id,
        movieId: movie.id,
        movieTitle: movie.title,
        category,
        currentPickNumber: draft.current_pick_number,
        userId: user.id
      });

      // Use the atomic database function
      const { data, error } = await supabase.rpc('make_multiplayer_pick', {
        p_draft_id: draft.id,
        p_movie_id: movie.id,
        p_movie_title: movie.title,
        p_movie_year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        p_movie_genre: movie.genres?.[0]?.name || 'Unknown',
        p_category: category,
        p_poster_path: movie.poster_path
      });

      if (error) {
        console.error('🚫 ATOMIC v1.0 - RPC error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('No response from pick function');
      }

      const result = data[0];
      console.log('✅ ATOMIC v1.0 - Pick function result:', result);

      if (!result.success) {
        throw new Error(result.message || 'Pick failed');
      }

      console.log('✅ ATOMIC v1.0 - Pick made successfully:', {
        newPickNumber: result.new_pick_number,
        nextTurnUserId: result.next_turn_user_id
      });

      toast({
        title: "Pick Made",
        description: `Successfully picked ${movie.title}`,
      });
      
    } catch (error) {
      console.error('🚫 ATOMIC v1.0 - Error making pick:', error);
      toast({
        title: "Error",
        description: `Failed to make pick: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, draft, isMyTurn, toast]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!draftId || !user) return;

    const channel = supabase
      .channel(`draft-${draftId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drafts',
          filter: `id=eq.${draftId}`,
        },
        (payload) => {
          console.log('🔄 DIAGNOSTIC v1.0 - Real-time draft update received:', payload.eventType);
          console.log('🔄 DIAGNOSTIC v1.0 - Payload new data:', payload.new);
          console.log('🔄 DIAGNOSTIC v1.0 - Payload old data:', payload.old);
          
          if (payload.eventType === 'UPDATE') {
            console.log('🔄 DIAGNOSTIC v1.0 - Processing draft UPDATE event');
            console.log('🔄 DIAGNOSTIC v1.0 - New draft data turn_order:', payload.new.turn_order);
            console.log('🔄 DIAGNOSTIC v1.0 - New draft data current_turn_user_id:', payload.new.current_turn_user_id);
            console.log('🔄 DIAGNOSTIC v1.0 - New draft data current_pick_number:', payload.new.current_pick_number);
            
            setDraft(payload.new as MultiplayerDraft);
            
            const newIsMyTurn = payload.new.current_turn_user_id === user.id;
            console.log('🔄 DIAGNOSTIC v1.0 - Setting isMyTurn to:', newIsMyTurn);
            console.log('🔄 DIAGNOSTIC v1.0 - Because current_turn_user_id:', payload.new.current_turn_user_id, 'vs my ID:', user.id);
            setIsMyTurn(newIsMyTurn);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_picks',
          filter: `draft_id=eq.${draftId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPicks(prev => [...prev, payload.new].sort((a, b) => a.pick_order - b.pick_order));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_participants',
          filter: `draft_id=eq.${draftId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParticipants(prev => [...prev, payload.new as DraftParticipant]);
          } else if (payload.eventType === 'UPDATE') {
            setParticipants(prev => 
              prev.map(p => p.id === payload.new.id ? payload.new as DraftParticipant : p)
            );
          }
        }
      )
      .subscribe();

    // Load initial data
    loadDraft(draftId);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [draftId, user, loadDraft]);

  return {
    draft,
    participants,
    picks,
    loading,
    isMyTurn,
    createMultiplayerDraft,
    joinDraftByCode,
    makePick,
    loadDraft,
    startDraft,
  };
};