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
    if (!user) return;

    try {
      setLoading(true);

      // Load draft
      const { data: draftData, error: draftError } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', id)
        .single();

      if (draftError) throw draftError;
      setDraft(draftData);

      // Load participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('draft_participants')
        .select('*')
        .eq('draft_id', id)
        .order('created_at');

      if (participantsError) throw participantsError;
      setParticipants(participantsData);

      // Load picks
      const { data: picksData, error: picksError } = await supabase
        .from('draft_picks')
        .select('*')
        .eq('draft_id', id)
        .order('pick_order');

      if (picksError) throw picksError;
      setPicks(picksData);

      // Check if it's the current user's turn
      setIsMyTurn(draftData.current_turn_user_id === user.id);

    } catch (error) {
      console.error('Error loading draft:', error);
      toast({
        title: "Error",
        description: "Failed to load draft",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Make a pick (only if it's your turn)
  const makePick = useCallback(async (movie: any, category: string) => {
    if (!user || !draft || !isMyTurn) {
      toast({
        title: "Error",
        description: "It's not your turn!",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('=== MAKE PICK ATTEMPT ===');
      console.log('User:', !!user, 'Draft:', !!draft, 'IsMyTurn:', isMyTurn);
      console.log('Draft current_turn_user_id:', draft?.current_turn_user_id);
      console.log('My user ID:', user?.id);
      console.log('Participants:', participants);
      console.log('Making pick for movie:', movie.title, 'category:', category);
      
      // Find current participant
      const currentParticipant = participants.find(p => p.user_id === user.id);
      if (!currentParticipant) {
        throw new Error('User not found in participants');
      }

      const currentParticipantIndex = participants.findIndex(p => p.user_id === user.id);
      console.log('Current draft state:', {
        currentPickNumber: draft.current_pick_number,
        currentTurnUserId: draft.current_turn_user_id,
        myUserId: user.id
      });
      console.log('Current participant:', currentParticipant);
      console.log('Current participant index:', currentParticipantIndex);
      
      const turnOrder = draft.turn_order;
      
      if (!turnOrder || turnOrder.length === 0) {
        console.log('Turn order is missing or empty:', turnOrder);
        throw new Error('Turn order not found - draft may not have been started properly');
      }
      
      console.log('Turn order found, length:', turnOrder.length);

      // STEP 1: Reserve the next pick number immediately to prevent race conditions
      const reservedPickNumber = draft.current_pick_number;
      const nextPickNumber = reservedPickNumber + 1;
      const nextTurnIndex = nextPickNumber - 1; // 0-based index for array lookup
      const isComplete = nextTurnIndex >= turnOrder.length;
      
      console.log('Pick calculation:', {
        reservedPickNumber,
        nextPickNumber,
        nextTurnIndex,
        isComplete,
        turnOrderLength: turnOrder.length
      });
      
      // Update draft first to reserve the pick number
      let updateData;
      if (isComplete) {
        updateData = {
          current_turn_user_id: null,
          current_pick_number: nextPickNumber,
          is_complete: true
        };
        console.log('Draft is complete, updating with:', updateData);
      } else {
        const nextTurn = turnOrder[nextTurnIndex];
        console.log('Next turn data:', nextTurn);
        updateData = {
          current_turn_user_id: nextTurn.user_id,
          current_pick_number: nextPickNumber,
        };
        console.log('Updating draft with next turn:', updateData);
      }
      
      console.log('Updating draft with data:', updateData);
      const { error: updateError } = await supabase
        .from('drafts')
        .update(updateData)
        .eq('id', draft.id);

      if (updateError) {
        console.log('Update error:', updateError);
        throw updateError;
      }
      console.log('Draft updated successfully');

      // STEP 2: Insert the pick with the reserved pick number
      const pickData = {
        draft_id: draft.id,
        player_id: currentParticipantIndex + 1,
        player_name: currentParticipant.participant_name,
        movie_id: movie.id,
        movie_title: movie.title,
        category,
        pick_order: reservedPickNumber,
        poster_path: movie.poster_path,
        movie_year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      };
      
      console.log('Inserting pick with data:', pickData);
      const { data: insertResult, error: pickError } = await supabase
        .from('draft_picks')
        .insert(pickData)
        .select();

      if (pickError) {
        console.log('Pick insert error:', pickError);
        throw pickError;
      }
      console.log('Pick inserted successfully:', insertResult);

      // Refresh only the picks to ensure they show up immediately
      const { data: updatedPicks, error: picksError } = await supabase
        .from('draft_picks')
        .select('*')
        .eq('draft_id', draft.id)
        .order('pick_order');

      if (!picksError && updatedPicks) {
        setPicks(updatedPicks);
      }

      toast({
        title: "Pick Made",
        description: `Successfully picked ${movie.title}`,
      });

    } catch (error) {
      console.error('Error making pick:', error);
      toast({
        title: "Error",
        description: "Failed to make pick",
        variant: "destructive",
      });
    }
  }, [user, draft, isMyTurn, participants, toast]);

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
          console.log('Real-time draft update received:', payload);
          if (payload.eventType === 'UPDATE') {
            console.log('Setting draft from real-time:', payload.new);
            setDraft(payload.new as MultiplayerDraft);
            console.log('Setting isMyTurn to:', payload.new.current_turn_user_id === user.id, 'because current_turn_user_id:', payload.new.current_turn_user_id, 'vs my ID:', user.id);
            setIsMyTurn(payload.new.current_turn_user_id === user.id);
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