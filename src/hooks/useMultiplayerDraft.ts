import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { useToast } from '@/hooks/use-toast';

interface DraftParticipant {
  id: string;
  user_id: string | null;
  guest_participant_id: string | null;
  participant_id?: string; // Unified ID from database
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
  const { participantId } = useCurrentUser();
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Remove initialDraftData optimization - always load fresh from database
  const [draft, setDraft] = useState<MultiplayerDraft | null>(null);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Start with loading false, set true only during operations
  const [isMyTurn, setIsMyTurn] = useState(false);

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
      setParticipants(participantsArray);

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
  }, [participantId, toast]);

  // Start the draft with pre-calculated snake draft turn order
  const startDraft = useCallback(async (draftId: string) => {
    if (!participantId) throw new Error('No participant ID available');

    try {
      setLoading(true);

      // Use unified function
      const result = await supabase.rpc('start_multiplayer_draft_unified', {
        p_draft_id: draftId,
        p_participant_id: participantId
      });

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) throw new Error('Failed to start draft');

      const updatedDraft = result.data[0];

      // Update local state
      setDraft(prev => prev ? {
        ...prev,
        turn_order: updatedDraft.draft_turn_order,
        current_turn_user_id: updatedDraft.draft_current_turn_user_id,
        current_turn_participant_id: updatedDraft.draft_current_turn_participant_id,
        current_pick_number: updatedDraft.draft_current_pick_number
      } : prev);

      // Check if it's the current user's turn using unified ID
      const currentTurnId = updatedDraft.draft_current_turn_participant_id || updatedDraft.draft_current_turn_user_id;
      setIsMyTurn(currentTurnId === participantId);

      // Get first player name from turn order
      const firstPlayerName = updatedDraft.draft_turn_order?.[0]?.participant_name || 'Unknown';

      toast({
        title: "Draft Started!",
        description: `${firstPlayerName} goes first!`,
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
  }, [participantId, toast]);

  // Join a draft by invite code
  const joinDraftByCode = useCallback(async (inviteCode: string, participantName: string) => {
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
      
      // Load additional data (participants and picks)
      await loadDraft(draftData.id);

      toast({
        title: "Successfully Joined!",
        description: "You've joined the draft. Good luck!",
      });

      return draftData.id;

    } catch (error: any) {
      console.error('Error joining draft:', error);
      
      // Enhanced error handling with specific messages
      if (error.message?.includes('Invalid invite code')) {
        toast({
          title: "Invalid Invite Code",
          description: "Please check the invite code and try again.",
          variant: "destructive",
        });
        throw new Error('INVALID_CODE');
      } else if (error.message?.includes('already complete')) {
        toast({
          title: "Draft Complete",
          description: "This draft has already been completed.",
          variant: "destructive",
        });
        throw new Error('DRAFT_COMPLETE');
      } else {
        toast({
          title: "Error Joining Draft",
          description: error.message || "Failed to join draft. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    } finally {
      setLoading(false);
    }
  }, [participantId, toast]);

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
      setParticipants(participantsArray);

      // Set picks
      const picksArray = Array.isArray(draftData.picks_data) 
        ? draftData.picks_data 
        : [];
      setPicks(picksArray);

      // Check if it's the current user's turn using unified ID
      const currentTurnId = mappedDraft.current_turn_participant_id || mappedDraft.current_turn_user_id;
      setIsMyTurn(currentTurnId === participantId);

    } catch (error) {
      console.error('Error loading draft:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load draft",
        variant: "destructive",
      });
      throw error;
    }
  }, [participantId, toast]);

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

      // Reload draft data to get updated state
      await loadDraft(draft.id);

      toast({
        title: "Pick Made!",
        description: `Successfully drafted ${movieTitle}`,
      });

    } catch (error: any) {
      console.error('Error making pick:', error);
      
      if (error.message?.includes('Not your turn')) {
        toast({
          title: "Not Your Turn",
          description: "Please wait for your turn to make a pick.",
          variant: "destructive",
        });
      } else if (error.message?.includes('already been drafted')) {
        toast({
          title: "Movie Already Drafted",
          description: "This movie has already been selected by another player.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error Making Pick",
          description: error.message || "Failed to make pick. Please try again.",
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [draft?.id, participantId, loadDraft, toast]);

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

  // Set up real-time subscriptions
  useEffect(() => {
    if (!draftId) return;

    const draftChannel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drafts',
          filter: `id=eq.${draftId}`,
        },
        (payload) => {
          console.log('Draft updated:', payload);
          if (participantId) {
            loadDraft(draftId);
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
          console.log('Participants updated:', payload);
          if (participantId) {
            loadDraft(draftId);
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
          console.log('Picks updated:', payload);
          if (participantId) {
            loadDraft(draftId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(draftChannel);
    };
  }, [draftId, participantId, loadDraft]);

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