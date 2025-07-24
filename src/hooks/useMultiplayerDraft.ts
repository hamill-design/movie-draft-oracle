import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DraftParticipant {
  id: string;
  user_id: string | null;
  guest_participant_id: string | null;
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

export const useMultiplayerDraft = (draftId?: string, initialDraftData?: { draft: any; participants: any[]; picks: any[] }) => {
  const { user, guestSession, isGuest } = useAuth();
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Remove initialDraftData optimization - always load fresh from database
  const [draft, setDraft] = useState<MultiplayerDraft | null>(null);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Start with loading false, set true only during operations
  const [isMyTurn, setIsMyTurn] = useState(false);

  // Remove unused setGuestContext function

  // Create a multiplayer draft with email invitations
  const createMultiplayerDraft = useCallback(async (draftData: {
    title: string;
    theme: string;
    option: string;
    categories: string[];
    participantEmails: string[];
  }) => {
    if (!user && !guestSession) throw new Error('No user or guest session found');

    try {
      setLoading(true);

      let newDraft: any;

      if (!user && guestSession) {
        // Add extensive logging for debugging
        console.log('Creating guest multiplayer draft with data:', {
          guestSessionId: guestSession.id,
          title: draftData.title,
          theme: draftData.theme,
          option: draftData.option,
          categories: draftData.categories,
          participantEmails: draftData.participantEmails
        });
        
        // Validate and add fallbacks for parameters
        const validatedData = {
          p_guest_session_id: guestSession.id,
          p_title: draftData.title || 'Movie Draft',
          p_theme: draftData.theme || 'year',
          p_option: draftData.option || '2024',
          p_categories: draftData.categories?.length > 0 ? draftData.categories : ['Action/Adventure'],
          p_participants: draftData.participantEmails?.length > 0 ? draftData.participantEmails : [],
          p_participant_name: 'Host'
        };
        
        console.log('Calling create_guest_multiplayer_draft with validated data:', validatedData);
        
        // Use RPC function for guest users - now returns complete draft object
        const { data: draftArray, error: guestError } = await supabase.rpc('create_guest_multiplayer_draft', validatedData);

        if (guestError) {
          console.error('Error creating guest multiplayer draft:', guestError);
          console.error('Error details:', JSON.stringify(guestError, null, 2));
          throw guestError;
        }

        if (!draftArray || draftArray.length === 0) {
          throw new Error('No draft returned from function');
        }
        
        // The function now returns the complete draft object directly
        newDraft = draftArray[0];
        console.log('Successfully created draft with ID:', newDraft.id);
      } else {
        // Regular authenticated user flow
        const draftInsert: any = {
          title: draftData.title,
          theme: draftData.theme,
          option: draftData.option,
          categories: draftData.categories,
          participants: draftData.participantEmails,
          is_multiplayer: true,
          current_pick_number: 1,
          user_id: user.id,
        };

        const { data: createdDraft, error: draftError } = await supabase
          .from('drafts')
          .insert(draftInsert)
          .select()
          .single();

        if (draftError) throw draftError;

        // Create a participant record for the host
        const { error: hostParticipantError } = await supabase
          .from('draft_participants')
          .insert({
            draft_id: createdDraft.id,
            user_id: user.id,
            participant_name: user.email || 'Host',
            status: 'joined',
            is_host: true,
            joined_at: new Date().toISOString(),
          });

        if (hostParticipantError) {
          console.error('Failed to create host participant:', hostParticipantError);
        }

        newDraft = createdDraft;
      }

      // Only send email invitations if there are participants to invite
      if (draftData.participantEmails && draftData.participantEmails.length > 0) {
        console.log('📧 EMAIL DEBUG - Starting email invitation process:', {
          draftId: newDraft.id,
          hostEmail: user?.email || 'Guest User',
          participantEmails: draftData.participantEmails,
          inviteCode: newDraft.invite_code
        });

        let emailResults = null;
        try {
          const invitePayload = {
            draftId: newDraft.id,
            draftTitle: draftData.title,
            hostName: 'Host',
            participantEmails: draftData.participantEmails,
            theme: draftData.theme,
            option: draftData.option,
          };

          console.log('📧 EMAIL DEBUG - Calling edge function with payload:', invitePayload);

          const inviteResponse = await supabase.functions.invoke('send-draft-invitations', {
            body: invitePayload
          });

          console.log('📧 EMAIL DEBUG - Edge function response:', {
            data: inviteResponse.data,
            error: inviteResponse.error
          });

          if (inviteResponse.error) {
            console.error('📧 EMAIL DEBUG - Edge function error:', inviteResponse.error);
            emailResults = { success: false, error: inviteResponse.error };
          } else {
            console.log('📧 EMAIL DEBUG - Invitations processed:', inviteResponse.data);
            emailResults = inviteResponse.data;
          }
        } catch (emailError) {
          console.error('📧 EMAIL DEBUG - Exception during email call:', emailError);
          emailResults = { success: false, error: emailError.message };
        }

        // Show detailed results to user
        if (emailResults) {
          if (emailResults.success && emailResults.invitations) {
            const successful = emailResults.invitations.filter(inv => inv.status === 'sent').length;
            const failed = emailResults.invitations.filter(inv => inv.status === 'failed').length;
            const simulated = emailResults.invitations.filter(inv => inv.status === 'simulated').length;
            
            if (simulated > 0) {
              toast({
                title: "⚠️ Email Setup Required",
                description: `Draft created! ${simulated} invitations were simulated. Set up Resend API key for actual emails.`,
                variant: "default",
              });
            } else if (successful > 0 && failed === 0) {
              toast({
                title: "✅ All Invitations Sent",
                description: `Successfully sent ${successful} email invitations!`,
              });
            } else if (successful > 0) {
              toast({
                title: "⚠️ Partial Success",
                description: `${successful} emails sent, ${failed} failed. Check console for details.`,
                variant: "default",
              });
            } else {
              toast({
                title: "❌ Email Sending Failed",
                description: "All email invitations failed. Use invite code: " + newDraft.invite_code,
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "❌ Email System Error",
              description: "Email service failed. Share invite code: " + newDraft.invite_code,
              variant: "destructive",
            });
          }
        }
      }

      return newDraft;
    } catch (error) {
      console.error('Error creating multiplayer draft:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, guestSession]);

  // Start the draft with pre-calculated snake draft turn order
  const startDraft = useCallback(async (draftId: string) => {
    if (!user && !guestSession) throw new Error('No user or guest session found');

    try {
      setLoading(true);

      // Set guest session context if needed
      if (guestSession?.id) {
        await supabase.rpc('set_guest_session_context', {
          session_id: guestSession.id
        });
      }

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
        .maybeSingle();

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
              guest_participant_id: shuffledParticipants[i].guest_participant_id,
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
              guest_participant_id: shuffledParticipants[i].guest_participant_id,
              participant_name: shuffledParticipants[i].participant_name,
              round,
              pick_number: turnOrder.length + 1
            });
          }
        }
      }

      // Start the draft with the first turn
      const firstTurn = turnOrder[0];
      
      // Use the appropriate ID for the current turn (user_id for authenticated, guest_participant_id for guests)
      const currentTurnId = firstTurn.user_id || firstTurn.guest_participant_id;
      
      console.log('Generated complete turn order:', turnOrder);
      console.log('First player:', firstTurn.participant_name, 'ID:', currentTurnId);

      const { data: updatedDraft, error: updateError } = await supabase
        .from('drafts')
        .update({
          current_turn_user_id: currentTurnId,
          current_pick_number: 1,
          turn_order: turnOrder
        })
        .eq('id', draftId)
        .select()
        .single();

      if (updateError) {
        console.error('Error starting draft:', updateError);
        throw updateError;
      }

      console.log('Draft started successfully with data:', updatedDraft);
      
      // Update local state immediately instead of reloading
      setDraft(prevDraft => ({
        ...prevDraft!,
        current_turn_user_id: currentTurnId,
        current_pick_number: 1,
        turn_order: turnOrder
      }));
      
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
  }, [user, guestSession, toast]);

  // Join a draft by invite code
  const joinDraftByCode = useCallback(async (inviteCode: string, participantName: string) => {
    if (!user && !guestSession) throw new Error('No user or guest session found');

    try {
      setLoading(true);

      let joinResult;

      if (user) {
        // Authenticated user - use the simple join function
        const { data: participantId, error } = await supabase.rpc('join_draft_by_invite_code', {
          invite_code_param: inviteCode,
          participant_name_param: participantName
        });

        if (error) throw error;

        // Get draft details after joining
        const { data: draftData, error: draftError } = await supabase
          .from('drafts')
          .select('*')
          .eq('invite_code', inviteCode)
          .maybeSingle();

        if (draftError) throw draftError;

        setDraft(draftData);
        
        // Return the draft ID for navigation
        return draftData.id;
      } else {
        // Guest user - use the enhanced guest function
        const { data, error } = await supabase.rpc('join_draft_by_invite_code_guest', {
          invite_code_param: inviteCode,
          participant_name_param: participantName,
          p_guest_session_id: guestSession?.id || null,
        });

        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No data returned from join operation');

        joinResult = data[0];

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
          is_complete: joinResult.draft_is_complete,
          turn_order: joinResult.draft_turn_order,
          draft_order: null,
          created_at: joinResult.draft_created_at,
          updated_at: joinResult.draft_updated_at,
          user_id: null,
          guest_session_id: guestSession?.id || null
        };

        // Set the draft state
        setDraft(draftData);
        
        // Return the draft ID for navigation
        return draftData.id;
      }

      // Load additional data (participants and picks) for both user types
      const draftId = user ? (draft?.id || joinResult?.draft_id) : joinResult?.draft_id;
      
      if (draftId) {
        // Set guest session context if needed for subsequent queries
        if (guestSession?.id) {
          await supabase.rpc('set_guest_session_context', {
            session_id: guestSession.id
          });
        }

        // Load participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('draft_participants')
          .select('*')
          .eq('draft_id', draftId)
          .order('created_at');

        if (!participantsError && participantsData) {
          setParticipants(participantsData);
        }

        // Load picks
        const { data: picksData, error: picksError } = await supabase
          .from('draft_picks')
          .select('*')
          .eq('draft_id', draftId)
          .order('pick_order');

        if (!picksError && picksData) {
          setPicks(picksData);
        }

        // Check if it's the current user's turn
        const currentUserId = user?.id || guestSession?.id;
        const currentDraft = draft || (joinResult ? {
          current_turn_user_id: joinResult.draft_current_turn_user_id
        } : null);
        
        if (currentDraft) {
          const isMyTurn = currentDraft.current_turn_user_id === currentUserId;
          setIsMyTurn(isMyTurn);
        }

        toast({
          title: "Successfully Joined!",
          description: "You've joined the draft. Good luck!",
        });

        return draftId;
      }

      throw new Error('No draft ID available after join');

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
      } else if (error.message?.includes('already a participant') || error.message?.includes('already participating')) {
        toast({
          title: "Already Joined",
          description: "You are already a participant in this draft.",
          variant: "destructive",
        });
        throw new Error('ALREADY_JOINED');
      } else {
        toast({
          title: "Join Failed",
          description: "Unable to join the draft. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    } finally {
      setLoading(false);
    }
  }, [user, guestSession, draft, toast]);

  
  // Load draft data - ALWAYS from database with better error handling
  const loadDraft = useCallback(async (id: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      console.log(`Loading draft from database: ${id}`);
      
      // Get current user context for debugging
      const currentUserId = user?.id;
      const currentGuestId = guestSession?.id;
      console.log('Current user ID:', currentUserId);
      console.log('Current guest session ID:', currentGuestId);

      // Set guest session context if needed
      if (guestSession?.id) {
        await supabase.rpc('set_guest_session_context', {
          session_id: guestSession.id
        });
      }

      // Fetch draft data with better error handling
      console.log('Fetching draft with ID:', id);
      const { data: draftData, error: draftError } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid PGRST116 error

      if (draftError) {
        console.error('Draft fetch error:', draftError);
        throw draftError;
      }

      if (!draftData) {
        console.error('Draft not found or no access');
        throw new Error('Draft not found or you do not have access to this draft');
      }

      console.log('Draft data loaded:', draftData);

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('draft_participants')
        .select('*')
        .eq('draft_id', id)
        .order('created_at', { ascending: true });

      if (participantsError) {
        console.error('Participants fetch error:', participantsError);
        throw participantsError;
      }

      console.log('Participants loaded:', participantsData);

      // Fetch picks
      const { data: picksData, error: picksError } = await supabase
        .from('draft_picks')
        .select('*')
        .eq('draft_id', id)
        .order('pick_order', { ascending: true });

      if (picksError) {
        console.error('Picks fetch error:', picksError);
        // Don't throw error for picks - they might not exist yet
        console.warn('No picks found yet, continuing...');
      }

      console.log('Picks loaded:', picksData);
      
      setDraft(draftData);
      setParticipants(participantsData || []);
      setPicks(picksData || []);
      
    } catch (error) {
      console.error('Error loading draft:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, guestSession]);

  // Make a pick using atomic database function
  const makePick = useCallback(async (movie: any, category: string) => {
    if ((!user && !guestSession) || !draft || !isMyTurn) {
      console.log('🚫 ATOMIC v1.0 - Validation failed:', {
        hasUser: !!user,
        hasGuestSession: !!guestSession,
        hasDraft: !!draft,
        isMyTurn,
        userId: user?.id || guestSession?.id,
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
        userId: user?.id || guestSession?.id
      });

      // Check if this movie has already been drafted
      if (picks.some(pick => pick.movie_id === movie.id)) {
        toast({
          title: "Movie Already Drafted",
          description: `${movie.title} has already been selected by another player.`,
          variant: "destructive",
        });
        return;
      }

      // Use the atomic database function
      const { data, error } = await supabase.rpc('make_multiplayer_pick', {
        p_draft_id: draft.id,
        p_movie_id: movie.id,
        p_movie_title: movie.title,
        p_movie_year: movie.year || movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        p_movie_genre: movie.genre || 'Unknown',
        p_category: category,
        p_poster_path: movie.poster_path || movie.posterPath
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
  }, [user, guestSession, draft, isMyTurn, toast]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!draftId || (!user && !guestSession)) return;

    // Set loading to true when we have a draftId to load
    setLoading(true);

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
          
          if (payload.eventType === 'UPDATE') {
            console.log('🔄 DIAGNOSTIC v1.0 - Processing draft UPDATE event');
            setDraft(payload.new as MultiplayerDraft);
            
            const currentUserId = user?.id || guestSession?.id;
            const newIsMyTurn = payload.new.current_turn_user_id === currentUserId;
            console.log('🔄 DIAGNOSTIC v1.0 - Setting isMyTurn to:', newIsMyTurn);
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

    // Always load fresh data from database - no more initialDraftData optimization
    loadDraft(draftId);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [draftId, user, guestSession, loadDraft]);

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
