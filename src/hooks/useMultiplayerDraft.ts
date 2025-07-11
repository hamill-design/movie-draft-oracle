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

  // Make a pick (only if it's your turn)
  const makePick = useCallback(async (movie: any, category: string) => {
    // DIAGNOSTIC v1.0 - Add unique identifier to track this code version
    console.log('🔍 DIAGNOSTIC v1.0 - makePick function called');
    console.log('🔍 Timestamp:', new Date().toISOString());
    
    if (!user || !draft || !isMyTurn) {
      console.log('🚫 DIAGNOSTIC v1.0 - Validation failed:', {
        hasUser: !!user,
        hasDraft: !!draft,
        isMyTurn,
        userId: user?.id,
        draftCurrentTurnUserId: draft?.current_turn_user_id
      });
      toast({
        title: "Error",
        description: "DIAGNOSTIC v1.0 - It's not your turn!",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔍 DIAGNOSTIC v1.0 - === MAKE PICK ATTEMPT ===');
      console.log('🔍 User exists:', !!user);
      console.log('🔍 Draft exists:', !!draft);
      console.log('🔍 IsMyTurn:', isMyTurn);
      console.log('🔍 Draft current_turn_user_id:', draft?.current_turn_user_id);
      console.log('🔍 My user ID:', user?.id);
      console.log('🔍 Participants count:', participants.length);
      console.log('🔍 Full participants array:', participants);
      console.log('🔍 Movie being picked:', { title: movie.title, id: movie.id });
      console.log('🔍 Category:', category);
      console.log('🔍 Draft turn_order type:', typeof draft.turn_order);
      console.log('🔍 Draft turn_order value:', draft.turn_order);
      console.log('🔍 Draft turn_order length:', draft.turn_order?.length || 'N/A');
      
      // DIAGNOSTIC - Find current participant
      console.log('🔍 DIAGNOSTIC v1.0 - Finding current participant...');
      const currentParticipant = participants.find(p => p.user_id === user.id);
      console.log('🔍 Current participant found:', currentParticipant);
      
      if (!currentParticipant) {
        console.log('🚫 DIAGNOSTIC v1.0 - User not found in participants!');
        console.log('🚫 User ID:', user.id);
        console.log('🚫 All participants:', participants.map(p => ({ id: p.user_id, name: p.participant_name })));
        throw new Error('DIAGNOSTIC v1.0 - User not found in participants');
      }

      const currentParticipantIndex = participants.findIndex(p => p.user_id === user.id);
      console.log('🔍 DIAGNOSTIC v1.0 - Current participant index:', currentParticipantIndex);
      
      console.log('🔍 DIAGNOSTIC v1.0 - Current draft state:', {
        currentPickNumber: draft.current_pick_number,
        currentTurnUserId: draft.current_turn_user_id,
        myUserId: user.id,
        isComplete: draft.is_complete,
        draftId: draft.id
      });
      
      console.log('🔍 DIAGNOSTIC v1.0 - Extracting turn_order from draft...');
      const turnOrder = draft.turn_order;
      console.log('🔍 DIAGNOSTIC v1.0 - Turn order extracted:', turnOrder);
      console.log('🔍 DIAGNOSTIC v1.0 - Turn order type:', typeof turnOrder);
      console.log('🔍 DIAGNOSTIC v1.0 - Turn order is array:', Array.isArray(turnOrder));
      
      if (!turnOrder || turnOrder.length === 0) {
        console.log('🚫 DIAGNOSTIC v1.0 - Turn order validation failed!');
        console.log('🚫 turnOrder exists:', !!turnOrder);
        console.log('🚫 turnOrder length:', turnOrder?.length);
        console.log('🚫 turnOrder value:', turnOrder);
        console.log('🚫 Draft object keys:', Object.keys(draft));
        console.log('🚫 Full draft object:', draft);
        throw new Error('DIAGNOSTIC v1.0 - Turn order not found - draft may not have been started properly');
      }
      
      console.log('🔍 DIAGNOSTIC v1.0 - Turn order validation passed, length:', turnOrder.length);
      console.log('🔍 DIAGNOSTIC v1.0 - Turn order contents:', turnOrder);

      // DIAGNOSTIC - STEP 1: Reserve the next pick number immediately to prevent race conditions
      console.log('🔍 DIAGNOSTIC v1.0 - Calculating pick numbers...');
      const reservedPickNumber = draft.current_pick_number;
      const nextPickNumber = reservedPickNumber + 1;
      const nextTurnIndex = nextPickNumber - 1; // 0-based index for array lookup
      const isComplete = nextTurnIndex >= turnOrder.length;
      
      console.log('🔍 DIAGNOSTIC v1.0 - Pick calculation:', {
        reservedPickNumber,
        nextPickNumber,
        nextTurnIndex,
        isComplete,
        turnOrderLength: turnOrder.length,
        currentTurnFromOrder: turnOrder[reservedPickNumber - 1] || 'INDEX_OUT_OF_BOUNDS',
        nextTurnFromOrder: turnOrder[nextTurnIndex] || 'INDEX_OUT_OF_BOUNDS'
      });
      
      // DIAGNOSTIC - Update draft first to reserve the pick number
      console.log('🔍 DIAGNOSTIC v1.0 - Preparing draft update...');
      let updateData;
      if (isComplete) {
        updateData = {
          current_turn_user_id: null,
          current_pick_number: nextPickNumber,
          is_complete: true
        };
        console.log('🔍 DIAGNOSTIC v1.0 - Draft is complete, updating with:', updateData);
      } else {
        const nextTurn = turnOrder[nextTurnIndex];
        console.log('🔍 DIAGNOSTIC v1.0 - Next turn data from array:', nextTurn);
        console.log('🔍 DIAGNOSTIC v1.0 - Next turn index:', nextTurnIndex);
        updateData = {
          current_turn_user_id: nextTurn.user_id,
          current_pick_number: nextPickNumber,
        };
        console.log('🔍 DIAGNOSTIC v1.0 - Updating draft with next turn:', updateData);
      }
      
      console.log('🔍 DIAGNOSTIC v1.0 - Final update data:', updateData);
      console.log('🔍 DIAGNOSTIC v1.0 - Updating draft ID:', draft.id);
      
      const { error: updateError } = await supabase
        .from('drafts')
        .update(updateData)
        .eq('id', draft.id);

      if (updateError) {
        console.log('🚫 DIAGNOSTIC v1.0 - Update error:', updateError);
        console.log('🚫 DIAGNOSTIC v1.0 - Update data that failed:', updateData);
        throw updateError;
      }
      console.log('✅ DIAGNOSTIC v1.0 - Draft updated successfully');

      // DIAGNOSTIC - STEP 2: Insert the pick with the reserved pick number
      console.log('🔍 DIAGNOSTIC v1.0 - Preparing pick data...');
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
      
      console.log('🔍 DIAGNOSTIC v1.0 - Pick data prepared:', pickData);
      console.log('🔍 DIAGNOSTIC v1.0 - Inserting pick into database...');
      
      const { data: insertResult, error: pickError } = await supabase
        .from('draft_picks')
        .insert(pickData)
        .select();

      if (pickError) {
        console.log('🚫 DIAGNOSTIC v1.0 - Pick insert error:', pickError);
        console.log('🚫 DIAGNOSTIC v1.0 - Pick data that failed:', pickData);
        throw pickError;
      }
      console.log('✅ DIAGNOSTIC v1.0 - Pick inserted successfully:', insertResult);

      // Refresh only the picks to ensure they show up immediately
      const { data: updatedPicks, error: picksError } = await supabase
        .from('draft_picks')
        .select('*')
        .eq('draft_id', draft.id)
        .order('pick_order');

      if (!picksError && updatedPicks) {
        setPicks(updatedPicks);
      }

      console.log('✅ DIAGNOSTIC v1.0 - Pick operation completed successfully');
      console.log('🔍 DIAGNOSTIC v1.0 - === MAKE PICK COMPLETE ===');
      
      toast({
        title: "Pick Made",
        description: `DIAGNOSTIC v1.0 - Successfully picked ${movie.title}`,
      });

    } catch (error) {
      console.error('🚫 DIAGNOSTIC v1.0 - Error making pick:', error);
      console.error('🚫 DIAGNOSTIC v1.0 - Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('🚫 DIAGNOSTIC v1.0 - Draft state when error occurred:', draft);
      console.error('🚫 DIAGNOSTIC v1.0 - User state when error occurred:', user);
      console.error('🚫 DIAGNOSTIC v1.0 - Participants when error occurred:', participants);
      
      toast({
        title: "Error",
        description: `DIAGNOSTIC v1.0 - Failed to make pick: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      throw error; // Re-throw to let caller handle if needed
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