import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { useGuestSession } from './useGuestSession';
import { useToast } from '@/hooks/use-toast';

// Helper function to extract detailed error information
const getErrorMessage = (error: any): string => {
  const parts: string[] = [];
  
  if (error.message) parts.push(error.message);
  if (error.hint) parts.push(`Hint: ${error.hint}`);
  if (error.details) parts.push(`Details: ${error.details}`);
  if (error.code) parts.push(`Code: ${error.code}`);
  
  return parts.length > 0 
    ? parts.join(' | ') 
    : 'An unknown error occurred';
};

interface DraftParticipant {
  id: string;
  user_id: string | null;
  guest_participant_id: string | null;
  participant_id?: string; // Unified ID from database
  participant_name: string;
  status: 'invited' | 'joined' | 'left';
  is_host: boolean;
  joined_at: string | null;
  email?: string | null; // User's email from profiles
}

interface MultiplayerDraft {
  id: string;
  title: string;
  theme: string;
  option: string;
  categories: string[];
  participants: string[];
  current_turn_user_id: string | null; // Legacy field
  current_turn_participant_id?: string | null; // New unified field
  current_pick_number: number;
  is_complete: boolean;
  is_multiplayer: boolean;
  invite_code: string | null;
  draft_order: string[] | null;
  turn_order: any;
}

export const useMultiplayerDraft = (draftId?: string, initialDraftData?: { draft: any; participants: any[]; picks: any[] }) => {
  const { participantId, isGuest, user } = useCurrentUser();
  const { guestSession } = useGuestSession(user);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Use ref to track current participantId for real-time subscriptions
  const participantIdRef = useRef(participantId);
  
  // Remove initialDraftData optimization - always load fresh from database
  const [draft, setDraft] = useState<MultiplayerDraft | null>(null);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Start with loading false, set true only during operations
  const [isMyTurn, setIsMyTurn] = useState(false);

  // Update ref when participantId changes
  useEffect(() => {
    participantIdRef.current = participantId;
  }, [participantId]);

  // Presence channel for real-time updates
  const presenceChannelRef = useRef<any>(null);

  // Broadcast queue for messages sent before channel is ready
  const broadcastQueueRef = useRef<Array<{type: string, payload: any, participantName?: string}>>([]);
  const channelReadyRef = useRef(false);

  // Get current participant name
  const getCurrentParticipantName = useCallback(() => {
    const currentParticipant = participants.find(p => 
      p.participant_id === participantId || 
      p.user_id === participantId || 
      p.guest_participant_id === participantId
    );
    return currentParticipant?.participant_name || 'Unknown Player';
  }, [participants, participantId]);

  // Process queued broadcasts when channel becomes ready
  const processQueuedBroadcasts = useCallback(() => {
    if (!channelReadyRef.current || !presenceChannelRef.current || broadcastQueueRef.current.length === 0) {
      return;
    }

    console.log('Processing queued broadcasts:', broadcastQueueRef.current.length);
    
    // Process each queued broadcast with small delays to prevent overwhelming
    broadcastQueueRef.current.forEach(({ type, payload, participantName }, index) => {
      setTimeout(() => {
        const message = {
          type,
          participantId,
          participantName: participantName || getCurrentParticipantName(),
          draftId: draft?.id,
          timestamp: new Date().toISOString(),
          ...payload
        };

        try {
          presenceChannelRef.current?.send({
            type: 'broadcast',
            event: 'draft-change',
            payload: message
          });
          console.log('Sent queued broadcast:', type);
        } catch (error) {
          console.error('Failed to send queued broadcast:', error);
        }
      }, index * 100); // 100ms delay between broadcasts
    });

    // Clear the queue
    broadcastQueueRef.current = [];
  }, [participantId, draft?.id, getCurrentParticipantName]);

  // Broadcast draft change to all participants with queue system
  const broadcastDraftChange = useCallback((type: string, payload: any = {}, participantName?: string) => {
    console.log('Broadcasting:', type, 'Channel ready:', channelReadyRef.current, 'ParticipantId:', participantId);
    
    if (!participantId) {
      console.warn('Cannot broadcast: missing participantId');
      return;
    }

    // If channel is not ready, queue the message
    if (!channelReadyRef.current || !presenceChannelRef.current) {
      console.log('Queueing broadcast until channel is ready:', type);
      broadcastQueueRef.current.push({ type, payload, participantName });
      return;
    }

    const message = {
      type,
      participantId,
      participantName: participantName || getCurrentParticipantName(),
      draftId: draft?.id,
      timestamp: new Date().toISOString(),
      ...payload
    };

    console.log('Sending broadcast message:', message);

    try {
      presenceChannelRef.current.send({
        type: 'broadcast',
        event: 'draft-change',
        payload: message
      });
    } catch (error) {
      console.error('Failed to broadcast:', error);
      // Re-queue the message if it failed
      broadcastQueueRef.current.push({ type, payload, participantName });
    }
  }, [participantId, draft?.id, getCurrentParticipantName]);

  // Enrich participants with emails from profiles
  const enrichParticipantsWithEmails = useCallback(async (participants: DraftParticipant[]): Promise<DraftParticipant[]> => {
    // Extract unique user_ids that are not null
    const userIds = participants
      .map(p => p.user_id)
      .filter((id): id is string => id !== null);
    
    if (userIds.length === 0) {
      // No authenticated users, return participants as-is
      return participants;
    }

    // Fetch emails from profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    if (error) {
      console.error('Error fetching participant emails:', error);
      // Return participants without enrichment on error
      return participants;
    }

    // Create a map of user_id -> email
    const emailMap = new Map<string, string>();
    if (profiles) {
      profiles.forEach(profile => {
        if (profile.email) {
          emailMap.set(profile.id, profile.email);
        }
      });
    }

    // Enrich participants with emails
    return participants.map(participant => ({
      ...participant,
      email: participant.user_id ? emailMap.get(participant.user_id) || null : null
    }));
  }, []);

  // Create a multiplayer draft with email invitations
  const createMultiplayerDraft = useCallback(async (draftData: {
    title: string;
    theme: string;
    option: string;
    categories: string[];
    participantEmails: string[];
  }) => {
    if (!participantId) throw new Error('No participant ID available');

    try {
      setLoading(true);

      // Use the new unified function for both authenticated and guest users
      const result = await supabase.rpc('create_multiplayer_draft_unified', {
        p_participant_id: participantId,
        p_title: draftData.title,
        p_theme: draftData.theme,
        p_option: draftData.option,
        p_categories: draftData.categories,
        p_participants: draftData.participantEmails,
        p_participant_name: 'Host'
      });

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) throw new Error('No draft returned from function');
      
      // The function now returns the complete draft object with participants and picks
      const functionResult = result.data[0];
      
      // Set the complete draft data from the function response
      const newDraft = {
        id: functionResult.draft_id,
        user_id: functionResult.draft_user_id,
        guest_session_id: functionResult.draft_guest_session_id,
        title: functionResult.draft_title,
        theme: functionResult.draft_theme,
        option: functionResult.draft_option,
        categories: functionResult.draft_categories,
        participants: functionResult.draft_participants,
        is_multiplayer: functionResult.draft_is_multiplayer,
        invite_code: functionResult.draft_invite_code,
        current_pick_number: functionResult.draft_current_pick_number,
        current_turn_user_id: functionResult.draft_current_turn_user_id,
        current_turn_participant_id: functionResult.draft_current_turn_user_id, // Use available field
        is_complete: functionResult.draft_is_complete,
        turn_order: functionResult.draft_turn_order,
        draft_order: functionResult.draft_draft_order,
        created_at: functionResult.draft_created_at,
        updated_at: functionResult.draft_updated_at
      };

      // Set participants and picks from the function response
      const participantsArray = Array.isArray(functionResult.participants_data) 
        ? (functionResult.participants_data as unknown as DraftParticipant[])
        : [];
      
      // Enrich participants with emails from profiles
      const enrichedParticipants = await enrichParticipantsWithEmails(participantsArray);
      setParticipants(enrichedParticipants);

      const picksArray = Array.isArray(functionResult.picks_data) 
        ? functionResult.picks_data 
        : [];
      setPicks(picksArray);

      // Update the draft state with complete data
      setDraft(newDraft);

      // Only send email invitations if there are participants to invite
      if (draftData.participantEmails && draftData.participantEmails.length > 0) {
        try {
          const invitePayload = {
            draftId: newDraft.id,
            draftTitle: draftData.title,
            hostName: 'Host',
            participantEmails: draftData.participantEmails,
            theme: draftData.theme,
            option: draftData.option,
          };

          const inviteResponse = await supabase.functions.invoke('send-draft-invitations', {
            body: invitePayload
          });

          if (inviteResponse.error) {
            console.error('Email function error:', inviteResponse.error);
          } else {
            const emailResults = inviteResponse.data;
            if (emailResults?.success && emailResults.invitations) {
              const successful = emailResults.invitations.filter(inv => inv.status === 'sent').length;
              const simulated = emailResults.invitations.filter(inv => inv.status === 'simulated').length;
              
              if (simulated > 0) {
                toast({
                  title: "⚠️ Email Setup Required",
                  description: `Draft created! ${simulated} invitations were simulated. Set up Resend API key for actual emails.`,
                  variant: "default",
                });
              } else if (successful > 0) {
                toast({
                  title: "✅ Invitations Sent",
                  description: `Successfully sent ${successful} email invitations!`,
                });
              }
            }
          }
        } catch (emailError) {
          console.error('Email exception:', emailError);
        }
      }

      return newDraft;
    } catch (error) {
      console.error('Error creating multiplayer draft:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [participantId, toast, enrichParticipantsWithEmails]);

  // Start the draft with pre-calculated snake draft turn order
  const startDraft = useCallback(async (draftId: string) => {
    if (!participantId) throw new Error('No participant ID available');

    try {
      setLoading(true);
      console.log('🚀 Starting draft with draftId:', draftId, 'participantId:', participantId);

      // Use unified function
      const result = await supabase.rpc('start_multiplayer_draft_unified', {
        p_draft_id: draftId,
        p_participant_id: participantId
      });

      console.log('📊 Start draft result:', result);

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) throw new Error('Failed to start draft');

      const updatedDraft = result.data[0];
      console.log('📋 Updated draft data:', updatedDraft);

      // Update local state
      const newDraftState = {
        ...draft,
        turn_order: updatedDraft.draft_turn_order,
        current_turn_user_id: updatedDraft.draft_current_turn_user_id,
        current_turn_participant_id: updatedDraft.draft_current_turn_participant_id,
        current_pick_number: updatedDraft.draft_current_pick_number
      };
      
      console.log('🔄 Setting new draft state:', newDraftState);
      setDraft(newDraftState);

      // Check if it's the current user's turn using unified ID
      const currentTurnId = updatedDraft.draft_current_turn_participant_id || updatedDraft.draft_current_turn_user_id;
      const isCurrentUserTurn = currentTurnId === participantId;
      console.log('🎯 Current turn ID:', currentTurnId, 'ParticipantId:', participantId, 'Is my turn:', isCurrentUserTurn);
      setIsMyTurn(isCurrentUserTurn);

      // Get first player name from turn order
      const firstPlayerName = updatedDraft.draft_turn_order?.[0]?.participant_name || 'Unknown';
      console.log('👤 First player:', firstPlayerName, 'Turn order:', updatedDraft.draft_turn_order);

      // Broadcast the draft start
      broadcastDraftChange('DRAFT_STARTED');

      toast({
        title: "Draft Started!",
        description: `${firstPlayerName} goes first!`,
      });

    } catch (error) {
      console.error('Error starting draft:', error);
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Error Starting Draft",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [participantId, toast, broadcastDraftChange, draft]);

  // Load draft data
  const loadDraft = useCallback(async (id: string) => {
    if (!participantId) throw new Error('No participant ID available');

    try {
      // Use unified function
      const result = await supabase.rpc('load_draft_unified', {
        p_draft_id: id,
        p_participant_id: participantId
      });

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) throw new Error('Draft not found');

      const draftData = result.data[0];
      
      // Map the response to our draft structure
      const mappedDraft = {
        id: draftData.draft_id,
        title: draftData.draft_title,
        theme: draftData.draft_theme,
        option: draftData.draft_option,
        categories: draftData.draft_categories,
        participants: draftData.draft_participants,
        current_turn_user_id: draftData.draft_current_turn_user_id,
        current_turn_participant_id: draftData.draft_current_turn_participant_id,
        current_pick_number: draftData.draft_current_pick_number,
        is_complete: draftData.draft_is_complete,
        is_multiplayer: draftData.draft_is_multiplayer,
        invite_code: draftData.draft_invite_code,
        draft_order: draftData.draft_draft_order,
        turn_order: draftData.draft_turn_order,
      };

      setDraft(mappedDraft);

      // Set participants with unified ID
      const participantsArray = Array.isArray(draftData.participants_data) 
        ? (draftData.participants_data as unknown as DraftParticipant[])
        : [];
      
      // Enrich participants with emails from profiles
      const enrichedParticipants = await enrichParticipantsWithEmails(participantsArray);
      setParticipants(enrichedParticipants);

      // Set picks
      const picksArray = Array.isArray(draftData.picks_data) 
        ? draftData.picks_data 
        : [];
      setPicks(picksArray);

      // Check if it's the current user's turn using unified ID
      const currentTurnId = mappedDraft.current_turn_participant_id || mappedDraft.current_turn_user_id;
      setIsMyTurn(currentTurnId === participantId);

      // Broadcast that this participant is now active (with throttling)
      // Only broadcast if we're an existing participant (found in participants list)
      const isExistingParticipant = participantsArray.some(p => 
        p.participant_id === participantId || 
        p.user_id === participantId || 
        p.guest_participant_id === participantId
      );
      
      if (isExistingParticipant) {
        console.log('🟡 Broadcasting PARTICIPANT_ACTIVE for existing participant');
        broadcastDraftChange('PARTICIPANT_ACTIVE');
      }

    } catch (error) {
      console.error('Error loading draft:', error);
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Error Loading Draft",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  }, [participantId, toast, enrichParticipantsWithEmails, broadcastDraftChange]);

  // Join a draft by invite code
  const joinDraftByCode = useCallback(async (inviteCode: string, participantName: string) => {
    console.log('🔵 joinDraftByCode called with:', { inviteCode, participantName, participantId });
    
    if (!participantId) throw new Error('No participant ID available');

    try {
      setLoading(true);

      // Use unified function
      const result = await supabase.rpc('join_draft_by_invite_code_guest', {
        invite_code_param: inviteCode,
        participant_name_param: participantName,
        p_guest_session_id: participantId
      });

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) throw new Error('No data returned from join operation');

      const joinResult = result.data[0];

      // The function returns complete draft details, so we can use them directly
      const draftData = {
        id: joinResult.draft_id,
        title: joinResult.draft_title,
        theme: joinResult.draft_theme,
        option: joinResult.draft_option,
        categories: joinResult.draft_categories,
        participants: joinResult.draft_participants,
        is_multiplayer: joinResult.draft_is_multiplayer,
        invite_code: joinResult.draft_invite_code,
        current_pick_number: joinResult.draft_current_pick_number,
        current_turn_user_id: joinResult.draft_current_turn_user_id,
        current_turn_participant_id: joinResult.draft_current_turn_user_id, // Use available field
        is_complete: joinResult.draft_is_complete,
        turn_order: joinResult.draft_turn_order,
        draft_order: null,
        created_at: joinResult.draft_created_at,
        updated_at: joinResult.draft_updated_at,
        user_id: null,
        guest_session_id: participantId
      };

      // Set the draft state
      setDraft(draftData);
      
      // Broadcast the participant join immediately with the participant name
      console.log('🟢 About to broadcast join for participant:', participantName);
      console.log('🟢 Channel exists:', !!presenceChannelRef.current);
      broadcastDraftChange('PARTICIPANT_JOINED', { participantName }, participantName);

      // Load additional data (participants and picks) after broadcast
      await loadDraft(draftData.id);

      toast({
        title: "Successfully Joined!",
        description: "You've joined the draft. Good luck!",
      });

      return draftData.id;

    } catch (error: any) {
      console.error('Error joining draft:', error);
      
      const errorMessage = getErrorMessage(error);
      
      // Enhanced error handling with specific messages
      if (error.message?.includes('Invalid invite code')) {
        toast({
          title: "Invalid Invite Code",
          description: errorMessage,
          variant: "destructive",
        });
        throw new Error('INVALID_CODE');
      } else if (error.message?.includes('already complete')) {
        toast({
          title: "Draft Complete",
          description: errorMessage,
          variant: "destructive",
        });
        throw new Error('DRAFT_COMPLETE');
      } else {
        toast({
          title: "Error Joining Draft",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      }
    } finally {
      setLoading(false);
    }
  }, [participantId, toast, loadDraft, broadcastDraftChange]);

  // Make a pick
  const makePick = useCallback(async (movieId: number, movieTitle: string, movieYear: number, movieGenre: string, category: string, posterPath?: string) => {
    if (!draft?.id || !participantId) return;
    
    try {
      // Use unified function
      const result = await supabase.rpc('make_multiplayer_pick_unified', {
        p_draft_id: draft.id,
        p_participant_id: participantId,
        p_movie_id: movieId,
        p_movie_title: movieTitle,
        p_movie_year: movieYear,
        p_movie_genre: movieGenre,
        p_category: category,
        p_poster_path: posterPath
      });

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) throw new Error('No response from pick function');

      const pickResult = result.data[0];
      
      if (!pickResult.success) {
        throw new Error(pickResult.message || 'Failed to make pick');
      }

      // Broadcast the pick
      broadcastDraftChange('PICK_MADE', { movieTitle, category });

      // Reload draft data to get updated state
      await loadDraft(draft.id);

      toast({
        title: "Pick Made!",
        description: `Successfully drafted ${movieTitle}`,
      });

    } catch (error: any) {
      console.error('Error making pick:', error);
      
      const errorMessage = getErrorMessage(error);
      
      if (error.message?.includes('Not your turn')) {
        toast({
          title: "Not Your Turn",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (error.message?.includes('already been drafted')) {
        toast({
          title: "Movie Already Drafted",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error Making Pick",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [draft?.id, participantId, loadDraft, toast, broadcastDraftChange]);

  // Compute isMyTurn using unified participant ID
  const computedIsMyTurn = useMemo(() => {
    if (!draft || !participantId) return false;
    
    // Use new unified field if available, fallback to legacy field
    const currentTurnId = draft.current_turn_participant_id || draft.current_turn_user_id;
    return currentTurnId === participantId;
  }, [draft?.current_turn_participant_id, draft?.current_turn_user_id, participantId]);

  // Update isMyTurn when computed value changes
  useEffect(() => {
    setIsMyTurn(computedIsMyTurn);
  }, [computedIsMyTurn]);

  // Load draft when draftId changes
  useEffect(() => {
    if (draftId && participantId) {
      loadDraft(draftId);
    }
  }, [draftId, participantId, loadDraft]);

  // Separate effect to reload draft when participantId becomes available
  useEffect(() => {
    if (draftId && participantId && !draft) {
      loadDraft(draftId);
    }
  }, [draftId, participantId, draft, loadDraft]);


  // Set up real-time presence channel with fixed communication
  useEffect(() => {
    if (!draftId || !participantId) return;

    console.log(`🔴 Setting up presence channel for draft: ${draftId}, participant: ${participantId}`);

    // Use consistent channel naming between all participants
    const channelName = `multiplayer-draft-${draftId}`;
    const presenceChannel = supabase
      .channel(channelName, {
        config: { 
          broadcast: { self: false }, // Don't receive our own broadcasts
          presence: { key: participantId }
        }
      })
      .on('broadcast', { event: 'draft-change' }, (payload) => {
        console.log('📥 Received broadcast:', payload);
        console.log('📥 Payload structure:', JSON.stringify(payload, null, 2));
        
        // Extract the actual message - handle both nested and direct payload structures
        const message = payload?.payload || payload;
        console.log('📥 Message:', JSON.stringify(message, null, 2));
        
        // Don't process our own broadcasts (double check)
        if (message.participantId === participantId) {
          console.log('🔄 Ignoring own broadcast');
          return;
        }

        const { type, participantName } = message;
        console.log(`📨 Processing broadcast: ${type} from ${participantName}`);
        
        // Handle different broadcast types with immediate data reload
        switch (type) {
          case 'PARTICIPANT_JOINED':
            console.log('👋 New participant joined:', participantName);
            toast({
              title: "Player Joined",
              description: `${participantName} joined the draft`,
            });
            // Immediate reload for participant changes
            setTimeout(() => loadDraft(draftId), 200);
            break;
            
          case 'PICK_MADE':
            console.log('🎬 Pick made by:', participantName);
            toast({
              title: "Pick Made",
              description: `${participantName} made a pick`,
            });
            setTimeout(() => loadDraft(draftId), 200);
            break;
            
          case 'DRAFT_STARTED':
            console.log('🚀 Draft started by:', participantName);
            toast({
              title: "Draft Started",
              description: "The draft has begun!",
            });
            // Immediate reload to get the new turn order
            loadDraft(draftId);
            break;
            
          case 'PARTICIPANT_ACTIVE':
            console.log('✅ Participant active:', participantName);
            // Reload data for active participants to catch any missed updates
            setTimeout(() => loadDraft(draftId), 300);
            break;
            
          default:
            console.log('❓ Unknown broadcast type:', type);
        }
      })
      .subscribe((status) => {
        console.log('Presence channel status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('Presence channel ready for broadcasting');
          channelReadyRef.current = true;
          
          // Process any queued broadcasts first
          setTimeout(() => {
            processQueuedBroadcasts();
          }, 100);
          
          // Then broadcast that this participant is active
          // Only if we have a draft and we're a participant
          if (draft && participants.length > 0) {
            const isParticipant = participants.some(p => 
              p.participant_id === participantId || 
              p.user_id === participantId || 
              p.guest_participant_id === participantId
            );
            
            if (isParticipant) {
              console.log('🟡 Channel ready - broadcasting PARTICIPANT_ACTIVE');
              // Small delay to ensure all participants' channels are ready
              setTimeout(() => {
                broadcastDraftChange('PARTICIPANT_ACTIVE');
              }, 500);
            }
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error occurred');
          channelReadyRef.current = false;
        } else if (status === 'CLOSED') {
          console.log('📪 Channel closed');
          channelReadyRef.current = false;
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      if (presenceChannelRef.current) {
        console.log('🧹 Cleaning up presence channel');
        channelReadyRef.current = false;
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [draftId, participantId, loadDraft, toast, processQueuedBroadcasts, broadcastDraftChange, draft, participants]);

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