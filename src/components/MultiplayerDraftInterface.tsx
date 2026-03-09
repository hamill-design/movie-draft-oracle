import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { useAIPick } from '@/hooks/useAIPick';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Clock, Film, Trophy, Loader2, Vote } from 'lucide-react';
import { MultiPersonIcon } from '@/components/icons/MultiPersonIcon';
import { PersonIcon } from '@/components/icons/PersonIcon';
import MovieSearch from '@/components/MovieSearch';
import EnhancedCategorySelection from '@/components/EnhancedCategorySelection';
import PickConfirmation from '@/components/PickConfirmation';
import DraftBoard from '@/components/DraftBoard';

import { getCleanActorName } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Participant, normalizeParticipants } from '@/types/participant';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { QRCodeSVG } from 'qrcode.react';

interface MultiplayerDraftInterfaceProps {
  draftId?: string;
  initialData?: {
    theme: string;
    option: string;
    participants: string[] | Participant[];
    categories: string[];
    isHost?: boolean;
  };
  /** When provided (e.g. from Index), allows load-draft to run before child's session is ready (fixes stuck loading for guests). */
  participantId?: string | null;
}

export const MultiplayerDraftInterface = ({
  draftId,
  initialData,
  participantId: participantIdFromParent
}: MultiplayerDraftInterfaceProps) => {
  const {
    participantId,
    loading: sessionLoading
  } = useCurrentUser();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const { user, guestSession } = useAuth();
  const { enableVoting, submitDraftVote } = useDraftOperations();
  const {
    draft,
    participants,
    picks,
    loading,
    isMyTurn,
    isConnected,
    createMultiplayerDraft,
    makePick,
    loadDraft,
    startDraft,
    manualRefresh
  } = useMultiplayerDraft(draftId, undefined, participantIdFromParent);
  // Use parent's participantId when available so we don't show "Authentication Required" while parent has session
  const effectiveParticipantId = participantIdFromParent ?? participantId;
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [checkingOscarStatus, setCheckingOscarStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [specDraftName, setSpecDraftName] = useState<string | null>(null);
  const [votingMeta, setVotingMeta] = useState<{ voting_ends_at: string | null; allow_public_voting?: boolean } | null>(null);
  const [votingJustEnabled, setVotingJustEnabled] = useState(false);
  const [addVoting, setAddVoting] = useState<boolean | null>(null);
  const [votingPublic, setVotingPublic] = useState(false);
  const [votingDuration, setVotingDuration] = useState(60);
  const [votes, setVotes] = useState<{ voted_participant_id: string | null; voter_user_id: string | null; voter_guest_session_id: string | null }[]>([]);
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [selectedVoteParticipantId, setSelectedVoteParticipantId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { pickMovie: aiPickMovie, loading: aiPicking } = useAIPick();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [isAITurn, setIsAITurn] = useState(false);
  const isMakingAIPickRef = useRef(false);
  // Per-AI shuffled category order so AI doesn't always pick in left-to-right category order
  const aiCategoryOrderByParticipantIdRef = useRef<Map<string, string[]>>(new Map());
  // Stable row order: once draft has started, keep using last known turn order so rows don't flip on reload
  const lastStableTurnOrderIdsRef = useRef<{ draftId: string; participantIds: string[] } | null>(null);
  const playerIdToDisplayIndexRef = useRef<Map<number, number> | null>(null);
  const playerIdMapDraftIdRef = useRef<string | null>(null);

  // Fetch spec draft name if theme is spec-draft
  useEffect(() => {
    const fetchSpecDraftName = async () => {
      if (draft?.theme === 'spec-draft' && draft.option) {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await (supabase as any)
            .from('spec_drafts')
            .select('name')
            .eq('id', draft.option)
            .single();

          if (error) throw error;
          if (data) {
            setSpecDraftName(data.name);
          }
        } catch (err) {
          console.error('Error fetching spec draft name:', err);
        }
      }
    };

    if (draft?.theme === 'spec-draft') {
      fetchSpecDraftName();
    }
  }, [draft?.theme, draft?.option]);

  const DURATION_OPTIONS = [{ label: '5 min', value: 5 }, { label: '1 hr', value: 60 }, { label: '24 hr', value: 1440 }] as const;

  // Fetch voting meta when draft is complete; also sync from realtime draft updates so other players see voting without refetch
  useEffect(() => {
    if (!draft?.id || !draft?.is_complete) return;
    const fromDraft = (d: typeof draft) => {
      const endsAt = (d as any).voting_ends_at ?? null;
      const allowPublic = (d as any).allow_public_voting;
      if (endsAt != null || allowPublic !== undefined) {
        setVotingMeta(prev => ({ ...prev, voting_ends_at: endsAt ?? prev?.voting_ends_at ?? null, allow_public_voting: allowPublic ?? prev?.allow_public_voting }));
      }
    };
    fromDraft(draft);
    const fetchVotingMeta = async () => {
      try {
        if (guestSession) await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
        const { data, error } = await supabase.from('drafts').select('voting_ends_at, allow_public_voting').eq('id', draft.id).maybeSingle();
        if (!error && data) setVotingMeta({ voting_ends_at: data.voting_ends_at ?? null, allow_public_voting: data.allow_public_voting });
        else if (error) setVotingMeta(prev => prev);
      } catch {
        setVotingMeta(prev => prev);
      }
    };
    fetchVotingMeta();
  }, [draft?.id, draft?.is_complete, (draft as any)?.voting_ends_at, (draft as any)?.allow_public_voting, guestSession]);

  useEffect(() => {
    if (!draft?.id || !votingMeta?.voting_ends_at) return;
    const fetchVotes = async () => {
      try {
        if (guestSession) await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
        const { data, error } = await supabase.from('draft_votes').select('voted_participant_id, voter_user_id, voter_guest_session_id').eq('draft_id', draft.id);
        if (!error) setVotes(data ?? []);
      } catch {
        setVotes([]);
      }
    };
    fetchVotes();
  }, [draft?.id, votingMeta?.voting_ends_at, guestSession]);

  const votingEndsAt = votingMeta?.voting_ends_at ? new Date(votingMeta.voting_ends_at).getTime() : null;
  const votingOpen = votingEndsAt != null && now < votingEndsAt;
  const votingConfigured = votingEndsAt != null;

  const votingTimeRemaining = votingEndsAt != null && now < votingEndsAt ? votingEndsAt - now : 0;
  const formatVotingCountdown = (ms: number) => {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const myParticipantId = useMemo(() => {
    if (!effectiveParticipantId || !participants.length) return null;
    const p = participants.find(
      (dp: any) =>
        String(dp.participant_id || dp.user_id || dp.guest_participant_id || '') === String(effectiveParticipantId)
    );
    return p?.id ?? null;
  }, [participants, effectiveParticipantId]);

  const voteCountsByParticipantId = useMemo(() => {
    const map = new Map<string, number>();
    votes.forEach(v => {
      if (v.voted_participant_id) map.set(v.voted_participant_id, (map.get(v.voted_participant_id) ?? 0) + 1);
    });
    return map;
  }, [votes]);

  const humanParticipantCount = useMemo(() => participants.filter((p: any) => !p.is_ai).length, [participants]);
  const allHumansHaveVoted = votingConfigured && humanParticipantCount > 0 && votes.length >= humanParticipantCount;
  // Enable for everyone: no voting, or (public: timer ended; non-public: all humans voted OR timer ended so non-host can open too)
  const finalScoresClickable = !votingConfigured || (votingConfigured && (votingMeta?.allow_public_voting ? !votingOpen : (allHumansHaveVoted || !votingOpen)));

  const myVote = votes.find(
    v => (user && v.voter_user_id === user.id) || (guestSession && v.voter_guest_session_id === guestSession.id)
  );

  const handleVotingSetupSubmit = async () => {
    if (!draft?.id || addVoting !== true) return;
    setSubmittingSetup(true);
    setVotingJustEnabled(false);
    try {
      await enableVoting(draft.id, votingPublic, votingDuration);
      if (guestSession) await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
      const { data } = await supabase.from('drafts').select('voting_ends_at, allow_public_voting').eq('id', draft.id).single();
      if (data) setVotingMeta({ voting_ends_at: data.voting_ends_at ?? null, allow_public_voting: data.allow_public_voting });
      setVotingJustEnabled(true);
      toast({ title: 'Voting enabled', description: votingPublic ? 'Share the link below so others can vote.' : 'Participants can now vote.' });
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to enable voting';
      const hint = msg.includes('enable_draft_voting') || msg.includes('schema cache')
        ? ' Apply the migration supabase/migrations/20260226120000_add_draft_voting.sql to your Supabase project.'
        : '';
      toast({ title: 'Error', description: msg + hint, variant: 'destructive' });
    } finally {
      setSubmittingSetup(false);
    }
  };

  const handleVote = async (participantId: string) => {
    if (!draft?.id) return;
    setSubmittingVote(true);
    try {
      await submitDraftVote(draft.id, { participantId });
      if (guestSession) await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
      const { data, error } = await supabase.from('draft_votes').select('voted_participant_id, voter_user_id, voter_guest_session_id').eq('draft_id', draft.id);
      if (!error) setVotes(data ?? []);
      toast({ title: 'Vote recorded' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Failed to submit vote', variant: 'destructive' });
    } finally {
      setSubmittingVote(false);
    }
  };

  // Get base category for movie search
  const getBaseCategory = () => {
    if (!draft) return '';
    if (draft.theme === 'spec-draft') {
      return 'spec-draft';
    }
    if (draft.theme === 'people') {
      return 'person';
    }
    if (draft.theme === 'year') {
      return 'year';  // Critical for debouncing
    }
    return 'popular';
  };

  // For theme-based drafts, pass the theme option (year, person name, or spec draft ID) as the constraint
  // This will fetch ALL movies for that year/person/spec draft
  const themeConstraint = draft?.theme === 'year' || draft?.theme === 'people' || draft?.theme === 'spec-draft' 
    ? draft.option 
    : '';
  const {
    movies,
    loading: moviesLoading
  } = useMovies(getBaseCategory(), themeConstraint, searchQuery);

  // Scroll to top when component mounts or draft loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [draftId]);

  // Create draft if this is a new multiplayer draft
  useEffect(() => {
    // Wait for session to load AND participantId to be available before creating draft
    if (sessionLoading || !participantId) return;
    
    if (initialData && !draftId) {
      const createDraft = async () => {
        try {
          // Normalize participants to handle both string[] and Participant[] formats
          const normalizedParticipants = normalizeParticipants(initialData.participants);
          
          // Separate human participants (emails) from AI participants
          const humanParticipants = normalizedParticipants
            .filter(p => !p.isAI)
            .map(p => p.name);
          const aiParticipants = normalizedParticipants
            .filter(p => p.isAI)
            .map(p => p.name);

          const newDraftId = await createMultiplayerDraft({
            title: initialData.option,
            theme: initialData.theme,
            option: initialData.option,
            categories: initialData.categories,
            participantEmails: humanParticipants,
            aiParticipantNames: aiParticipants
          });

          // Update URL without navigating to avoid remounting component
          window.history.replaceState(null, '', `/draft/${newDraftId}`);
          
          // Trigger React Router to update by navigating with replace
          navigate(`/draft/${newDraftId}`, {
            replace: true,
            state: { skipRemount: true }
          });
        } catch (error: any) {
          console.error('Failed to create draft:', error);
          
          // Check if this is a migration issue
          let errorMessage = error instanceof Error ? error.message : 'Failed to create multiplayer draft';
          if (error?.code === 'PGRST202' || error?.message?.includes('schema cache')) {
            errorMessage = 'Database migration not applied. Please run: supabase migration up';
          }
          
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive"
          });
        }
      };
      createDraft();
    }
  }, [initialData, draftId, participantId, sessionLoading, createMultiplayerDraft, navigate, toast]);

  const handleMovieSelect = async (movie: any) => {
    setSelectedMovie(movie);
    
    // Simple Oscar status check - just check cache, no synchronous enrichment
    if (movie.id) {
      setCheckingOscarStatus(true);
      try {
        // Try cache lookup by tmdb_id (with or without year)
        const { data: cached } = await supabase
          .from('oscar_cache')
          .select('oscar_status')
          .eq('tmdb_id', movie.id)
          .maybeSingle();
        
        if (cached) {
          const updatedMovie = {
            ...movie,
            oscar_status: cached.oscar_status || 'unknown',
            hasOscar: cached.oscar_status === 'winner' || cached.oscar_status === 'nominee'
          };
          setSelectedMovie(updatedMovie);
          setCheckingOscarStatus(false);
        } else {
          // If not in cache, enrich in background (async, non-blocking)
          supabase.functions.invoke('enrich-movie-data', {
            body: { movieId: movie.id, movieTitle: movie.title, movieYear: movie.year }
          }).then(({ data: enrichmentData }) => {
            if (enrichmentData?.enrichmentData) {
              const updatedMovie = {
                ...movie,
                oscar_status: enrichmentData.enrichmentData.oscarStatus || enrichmentData.enrichmentData.oscar_status || 'unknown',
                hasOscar: enrichmentData.enrichmentData.oscarStatus === 'winner' || 
                         enrichmentData.enrichmentData.oscarStatus === 'nominee' ||
                         enrichmentData.enrichmentData.oscar_status === 'winner' ||
                         enrichmentData.enrichmentData.oscar_status === 'nominee'
              };
              setSelectedMovie(updatedMovie);
            }
            setCheckingOscarStatus(false);
          }).catch(err => {
            console.log('Background Oscar fetch failed:', err);
            setCheckingOscarStatus(false);
          });
        }
      } catch (error) {
        console.log('Oscar status check failed:', error);
        setCheckingOscarStatus(false);
      }
    } else {
      setCheckingOscarStatus(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const confirmPick = async () => {
    if (!selectedMovie || !selectedCategory) {
      return;
    }
    
    // Double-check it's the user's turn before making the pick
    if (!isMyTurn) {
      toast({
        title: "Not Your Turn",
        description: "It's not your turn to make a pick. Please wait for your turn.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await makePick(selectedMovie.id, selectedMovie.title, selectedMovie.releaseDate ? new Date(selectedMovie.releaseDate).getFullYear() : new Date().getFullYear(), selectedMovie.genre_names?.[0] || 'Unknown', selectedCategory, selectedMovie.poster_path);
      setSelectedMovie(null);
      setSelectedCategory('');
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to make pick in interface:', error);
    }
  };

  const copyInviteCode = async () => {
    if (!draft?.invite_code) return;
    try {
      await navigator.clipboard.writeText(draft.invite_code);
      setCopySuccess(true);
      toast({
        title: "Invite Code Copied",
        description: "Share this code with friends to join the draft"
      });
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite code:', error);
    }
  };

  const getCurrentTurnPlayer = () => {
    if (!draft || !participants.length) return null;

    // Use unified field if available, fallback to legacy field
    const currentTurnId = draft.current_turn_participant_id || draft.current_turn_user_id;
    if (!currentTurnId) return null;
    return participants.find(p => {
      // For AI participants, use the row id as participant_id
      const participantId = p.participant_id || p.user_id || p.guest_participant_id || (p.is_ai ? p.id : null);
      return participantId && String(participantId) === String(currentTurnId);
    });
  };

  const currentTurnPlayer = getCurrentTurnPlayer();
  const currentTurnIsAI = currentTurnPlayer?.is_ai === true;

  // Check if current user is the host (must be declared before useEffect that uses it)
  const isHost = useMemo(() => {
    if (!participants.length || !effectiveParticipantId) return false;
    return participants.some(p => {
      if (p.is_host) {
        const pId = p.user_id || p.guest_participant_id;
        return pId === effectiveParticipantId;
      }
      return false;
    });
  }, [participants, effectiveParticipantId]);

  // Detect AI turn and handle auto-pick
  useEffect(() => {
    if (!draft || draft.is_complete || !currentTurnIsAI || aiPicking || !currentTurnPlayer) {
      setIsAITurn(false);
      return;
    }
    
    setIsAITurn(true);
    
    // Only host can make picks for AI (they own the draft)
    if (!isHost) {
      // Not the host, just show that AI is thinking
      return;
    }

    // Prevent double-fire when effect re-runs (e.g. after draft state update)
    if (isMakingAIPickRef.current) {
      return;
    }
    isMakingAIPickRef.current = true;

    // AI's turn and we're the host - make pick after short delay
    const makeAIPick = async () => {
      try {
        // Wait 1-2 seconds to simulate "thinking"
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Reload draft from server so we use current turn / pick number (fixes AI second+ pick in multiplayer)
        let freshDraft = draft;
        let freshParticipants = participants;
        let freshPicksFromReload: any[] = picks;
        if (draft?.id) {
          try {
            const fresh = await loadDraft(draft.id, { background: true, returnData: true });
            if (fresh) {
              freshDraft = fresh.draft;
              freshParticipants = fresh.participants;
              freshPicksFromReload = fresh.picks ?? picks;
            }
          } catch (_) {
            // Keep using current state if reload fails
          }
        }

        if (!freshDraft || freshDraft.is_complete) {
          return;
        }

        const currentTurnId = freshDraft.current_turn_participant_id || freshDraft.current_turn_user_id;
        const findCurrentPlayer = (list: typeof participants) => currentTurnId ? list.find(p => {
          const pid = p.participant_id || p.user_id || p.guest_participant_id || (p.is_ai ? p.id : null);
          return pid && String(pid) === String(currentTurnId);
        }) : null;

        let stillCurrentPlayer = findCurrentPlayer(freshParticipants);
        // Fallback: if reload returned different participant shape, use pre-reload participants so we don't skip AI's turn
        if (!stillCurrentPlayer && currentTurnId) {
          stillCurrentPlayer = findCurrentPlayer(participants);
        }

        if (!stillCurrentPlayer || !stillCurrentPlayer.is_ai) {
          return;
        }

        const aiParticipantId = stillCurrentPlayer.participant_id ||
                                stillCurrentPlayer.user_id ||
                                stillCurrentPlayer.guest_participant_id ||
                                (stillCurrentPlayer.is_ai ? stillCurrentPlayer.id : null);

        // Use fresh draft/participants/picks so second+ AI turn uses server state (fixes multiplayer)
        const currentPickNumber = freshDraft.current_pick_number || 1;
        const picksPerCategory = freshParticipants.length;
        const currentRound = Math.floor((currentPickNumber - 1) / picksPerCategory);
        const defaultCategory = freshDraft.categories?.[currentRound] || freshDraft.categories?.[0] || '';
        // Backend stores picks with integer player_id (1-based index in participants created_at order). Participants from load_draft don't include player_id, so derive from position.
        const aiIndex = freshParticipants.findIndex(p =>
          (p.id != null && stillCurrentPlayer?.id != null && p.id === stillCurrentPlayer.id) ||
          (p.participant_id != null && stillCurrentPlayer?.participant_id != null && String(p.participant_id) === String(stillCurrentPlayer.participant_id))
        );
        const aiPlayerId = (stillCurrentPlayer as { player_id?: number })?.player_id ?? (aiIndex >= 0 ? aiIndex + 1 : undefined);
        const aiPicksSoFar = typeof aiPlayerId === 'number' ? freshPicksFromReload.filter((p: any) => Number(p.player_id) === aiPlayerId).length : 0;
        let order = aiParticipantId != null ? aiCategoryOrderByParticipantIdRef.current.get(String(aiParticipantId)) : undefined;
        if (!order && freshDraft.categories?.length) {
          order = [...freshDraft.categories].sort(() => Math.random() - 0.5);
          if (aiParticipantId != null) aiCategoryOrderByParticipantIdRef.current.set(String(aiParticipantId), order);
        }
        const currentCategory = (order && order[aiPicksSoFar] != null) ? order[aiPicksSoFar] : defaultCategory;

        if (!currentCategory) {
          console.error('No category found for AI pick');
          toast({
            title: "AI Pick Failed",
            description: "No category for this pick.",
            variant: "destructive",
          });
          return;
        }

        const alreadyPickedMovieIds = freshPicksFromReload.map((p: any) => p.movie_id);

        const selectedMovie = await aiPickMovie({
          draftTheme: freshDraft.theme || '',
          draftOption: freshDraft.option || '',
          currentCategory: currentCategory,
          alreadyPickedMovieIds: alreadyPickedMovieIds,
          allCategories: freshDraft.categories || [],
        });

        if (selectedMovie && stillCurrentPlayer) {
          if (!aiParticipantId) {
            toast({
              title: "AI Pick Failed",
              description: "Could not identify AI participant.",
              variant: "destructive",
            });
            return;
          }

          try {
            await makePick(
              selectedMovie.id,
              selectedMovie.title,
              selectedMovie.year || new Date().getFullYear(),
              selectedMovie.genre || 'Unknown',
              currentCategory,
              selectedMovie.poster_path,
              aiParticipantId,
              effectiveParticipantId
            );
            // Success: makePick shows "Pick Made!" toast; no error toast
          } catch (error: any) {
            const msg = error?.message ?? String(error);
            // Don't show or log "Not your turn" — usually race/double-fire after pick already succeeded
            if (msg.includes('Not your turn')) {
              return;
            }
            console.error('Failed to make AI pick:', error);
            toast({
              title: "AI Pick Failed",
              description: msg || "The AI couldn't make its pick. Please try again.",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "AI Pick Failed",
            description: "The AI couldn't find a suitable movie to pick.",
            variant: "destructive",
          });
        }
      } finally {
        isMakingAIPickRef.current = false;
        setIsAITurn(false);
      }
    };

    makeAIPick();
  }, [draft, currentTurnIsAI, currentTurnPlayer, isHost, aiPicking, participants.length, picks, aiPickMovie, makePick, loadDraft, toast]);

  // Helper: Get participants sorted by created_at (matching backend ORDER BY created_at ASC NULLS LAST, id ASC)
  // MUST be before early returns to maintain consistent hook order
  const getParticipantsSortedByCreatedAt = useMemo(() => {
    return [...participants].sort((a, b) => {
      const aTime = a.created_at ?? a.joined_at ?? '';
      const bTime = b.created_at ?? b.joined_at ?? '';
      // Null/missing sorts last (NULLS LAST)
      if (!aTime && !bTime) {
        const aId = String(a.id ?? a.participant_id ?? a.user_id ?? a.guest_participant_id ?? '');
        const bId = String(b.id ?? b.participant_id ?? b.user_id ?? b.guest_participant_id ?? '');
        return aId.localeCompare(bId);
      }
      if (!aTime) return 1;
      if (!bTime) return -1;
      const timeDiff = new Date(aTime).getTime() - new Date(bTime).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Tie-break by id to match backend id ASC
      const aId = String(a.id ?? a.participant_id ?? a.user_id ?? a.guest_participant_id ?? '');
      const bId = String(b.id ?? b.participant_id ?? b.user_id ?? b.guest_participant_id ?? '');
      return aId.localeCompare(bId);
    });
  }, [participants]);

  // Check if draft has been started (has turn order)
  const draftHasStarted = draft?.turn_order && draft.turn_order.length > 0;

  // Helper: Get players in turn order (for display)
  // Use turn_order first round if available; sort by pick_number for stable order.
  // Once draft has started, keep using last known turn order (ref) so rows don't flip when reload returns partial state.
  const getPlayersInTurnOrder = useMemo(() => {
    const draftId = draft?.id;
    if (draftId && lastStableTurnOrderIdsRef.current && lastStableTurnOrderIdsRef.current.draftId !== draftId) {
      lastStableTurnOrderIdsRef.current = null;
    }
    const stored = lastStableTurnOrderIdsRef.current;
    const hasStoredOrder = stored?.draftId === draftId && (stored?.participantIds?.length ?? 0) > 0;

    if (draftHasStarted && draft?.turn_order && Array.isArray(draft.turn_order) && draft.turn_order.length > 0) {
      // Extract first round (round can be number 1 or string "1" from JSON)
      const firstRound = draft.turn_order
        .filter((item: any) => item.round === 1 || item.round === '1')
        .sort((a: any, b: any) => (Number(a.pick_number) ?? 0) - (Number(b.pick_number) ?? 0));

      const orderedIds: string[] = [];
      const seenIds = new Set<string>();
      firstRound.forEach((item: any) => {
        const pid = item.participant_id || item.user_id || item.guest_participant_id;
        if (pid && !seenIds.has(String(pid))) {
          seenIds.add(String(pid));
          orderedIds.push(String(pid));
        }
      });
      if (orderedIds.length > 0) {
        lastStableTurnOrderIdsRef.current = { draftId: draftId!, participantIds: orderedIds };
      }

      const turnOrderParticipants: any[] = [];
      orderedIds.forEach(pid => {
        const participant = participants.find(p => {
          const pId = p.participant_id || p.user_id || p.guest_participant_id || (p.is_ai ? p.id : null);
          return pId && String(pId) === pid;
        });
        if (participant) turnOrderParticipants.push(participant);
      });

      participants.forEach(p => {
        const pId = p.participant_id || p.user_id || p.guest_participant_id || (p.is_ai ? p.id : null);
        if (pId && !seenIds.has(String(pId))) turnOrderParticipants.push(p);
      });

      return turnOrderParticipants;
    }

    // Draft started but turn_order missing (e.g. mid-reload): use last stable order so rows don't flip
    if (draftId && hasStoredOrder && stored?.participantIds) {
      const orderedIds = stored.participantIds;
      const turnOrderParticipants: any[] = [];
      const seenIds = new Set<string>();
      orderedIds.forEach(pid => {
        const participant = participants.find(p => {
          const pId = p.participant_id || p.user_id || p.guest_participant_id || (p.is_ai ? p.id : null);
          return pId && String(pId) === pid;
        });
        if (participant) {
          seenIds.add(pid);
          turnOrderParticipants.push(participant);
        }
      });
      participants.forEach(p => {
        const pId = p.participant_id || p.user_id || p.guest_participant_id || (p.is_ai ? p.id : null);
        if (pId && !seenIds.has(String(pId))) turnOrderParticipants.push(p);
      });
      return turnOrderParticipants;
    }

    // New draft or not started: clear stored order and use created_at
    if (!draftId || !draftHasStarted) {
      lastStableTurnOrderIdsRef.current = null;
    }
    return getParticipantsSortedByCreatedAt;
  }, [participants, draft?.id, draft?.turn_order, draftHasStarted, getParticipantsSortedByCreatedAt]);

  // Create mapping: database player_id -> display position
  // Backend assigns player_id = row_number() OVER (ORDER BY created_at ASC NULLS LAST, id ASC).
  // Freeze map in ref when draft has started so the same pick doesn't jump rows between subscription and reload.
  const playerIdToDisplayIndex = useMemo(() => {
    const draftId = draft?.id ?? null;
    if (draftId !== playerIdMapDraftIdRef.current) {
      playerIdToDisplayIndexRef.current = null;
      playerIdMapDraftIdRef.current = draftId;
    }
    const map = new Map<number, number>();
    const sameParticipant = (a: any, b: any) => {
      const aId = a.participant_id ?? a.user_id ?? a.guest_participant_id ?? (a.is_ai ? a.id : null);
      const bId = b.participant_id ?? b.user_id ?? b.guest_participant_id ?? (b.is_ai ? b.id : null);
      return aId != null && bId != null && String(aId) === String(bId);
    };
    getParticipantsSortedByCreatedAt.forEach((participant, i) => {
      const playerId = i + 1; // 1-based, matches backend row_number() ORDER BY created_at NULLS LAST, id
      const displayIndex = getPlayersInTurnOrder.findIndex(p => sameParticipant(p, participant));
      if (displayIndex >= 0) map.set(playerId, displayIndex);
    });
    if (draftHasStarted && map.size > 0) {
      playerIdToDisplayIndexRef.current = new Map(map);
    }
    return map;
  }, [draft?.id, draftHasStarted, getPlayersInTurnOrder, getParticipantsSortedByCreatedAt]);

  // Normalize player_id to number for map lookup (picks from API may have string player_id).
  // Use frozen ref when draft has started so mapping is stable between subscription update and reload.
  const getDisplayIndexForPlayerId = (playerId: number | string): number => {
    const n = typeof playerId === 'number' ? playerId : parseInt(String(playerId), 10);
    if (Number.isNaN(n)) return 0;
    const map = draftHasStarted && playerIdToDisplayIndexRef.current
      ? playerIdToDisplayIndexRef.current
      : playerIdToDisplayIndex;
    return map.get(n) ?? 0;
  };

  // Single gentle loading screen (session or draft loading) — avoids big skeleton flicker when landing after create
  const showDraftLoading = (loading || sessionLoading) || (draftId && !draft);
  if (showDraftLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-purple-300 mb-4" />
        <p className="text-greyscale-blue-100 text-lg font-medium">Loading your draft...</p>
      </div>
    );
  }

  // Only show "Authentication Required" if session is done loading but no participant id (from parent or child)
  if (!sessionLoading && !effectiveParticipantId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription style={{color: 'var(--Text-Primary, #FCFFFF)'}}>
              Loading your session to participate in the draft...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Only show "Draft Not Found" if we don't have a draftId (user navigated directly to invalid URL)
  if (!draft) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Draft Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The draft you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isComplete = draft.is_complete;

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'
    }}>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="p-6 rounded-[8px]">
            <div className="flex flex-col justify-center items-center gap-4 text-center">
              <span className="text-purple-300 text-[32px] font-brockmann font-bold leading-9 tracking-[1.28px]">
                NOW DRAFTING
              </span>
              <div 
                className="font-chaney font-normal text-center break-words"
                style={{
                  fontSize: '64px',
                  lineHeight: '64px',
                  maxWidth: '100%'
                }}
              >
                <span className="text-greyscale-blue-100">
                  {draft.theme === 'spec-draft' 
                    ? (specDraftName || draft.option).toUpperCase()
                    : draft.theme === 'people' 
                      ? getCleanActorName(draft.option).toUpperCase() + ' '
                      : draft.option.toString() + ' '}
                </span>
                {draft.theme !== 'spec-draft' && (
                  <span className="text-purple-300">
                    MOVIES
                  </span>
                )}
              </div>
              
            </div>
          </div>
        </div>

        {/* Status and Participants */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px 24px',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: '100%'
        }}>
          <div style={{
            flex: '1 1 0',
            minWidth: '342px',
            height: '100%', 
            padding: '24px', 
            background: 'var(--Section-Container, #0E0E0F)', 
            boxShadow: '0px 0px 6px #3B0394', 
            borderRadius: '8px', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: '24px', 
            display: 'inline-flex'
          }}>
            <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'inline-flex'}}>
              <div style={{width: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex'}}>
                <Clock size={24} color="#907AFF" />
              </div>
              <div style={{
                flex: '1 1 0', 
                justifyContent: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'var(--Text-Primary, #FCFFFF)', 
                fontSize: '20px', 
                fontFamily: 'Brockmann', 
                fontWeight: '500', 
                lineHeight: '28px', 
                wordWrap: 'break-word'
              }}>Draft Status</div>
            </div>
            
            {isComplete ? (
              <>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex'}}>
                  <div style={{
                    alignSelf: 'stretch', 
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Primary, #FCFFFF)', 
                    fontSize: '16px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: '600', 
                    lineHeight: '24px', 
                    wordWrap: 'break-word'
                  }}>Draft Complete</div>
                  <div style={{
                    alignSelf: 'stretch', 
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Light-grey, #BDC3C2)', 
                    fontSize: '14px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: '400', 
                    lineHeight: '20px', 
                    wordWrap: 'break-word'
                  }}>All picks have been made!</div>
                </div>
              </>
            ) : (
              <>
                {!draftHasStarted && participants.length >= 2 && !isHost ? (
                  <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'flex'}}>
                    <div style={{
                      alignSelf: 'stretch',
                      textAlign: 'center',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Text-Primary, #FCFFFF)',
                      fontSize: '16px',
                      fontFamily: 'Brockmann',
                      fontWeight: '600',
                      lineHeight: '24px',
                      wordWrap: 'break-word'
                    }}>
                      Waiting on the Host to start the draft
                    </div>
                    <div style={{
                      alignSelf: 'stretch',
                      textAlign: 'center',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Text-Light-grey, #BDC3C2)',
                      fontSize: '14px',
                      fontFamily: 'Brockmann',
                      fontWeight: '400',
                      lineHeight: '20px',
                      wordWrap: 'break-word'
                    }}>
                      The host will begin the draft when ready.
                    </div>
                  </div>
                ) : (
                <>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Light-grey, #BDC3C2)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '400', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>Pick Number:</div>
                    </div>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Primary, #FCFFFF)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '500', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>{draft.current_pick_number}</div>
                    </div>
                  </div>
                  <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Light-grey, #BDC3C2)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '400', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>Current Turn:</div>
                    </div>
                    <div style={{
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #FCFFFF)', 
                      fontSize: '14px', 
                      fontFamily: 'Brockmann', 
                      fontWeight: '500', 
                      lineHeight: '20px', 
                      wordWrap: 'break-word'
                    }}>{currentTurnPlayer?.participant_name || 'Unknown'}</div>
                  </div>
                </div>
                {!isMyTurn && draftHasStarted && (
                  <div style={{
                    width: '100%', 
                    height: '100%', 
                    paddingTop: '22px', 
                    paddingBottom: '24px', 
                    paddingLeft: '24px', 
                    paddingRight: '24px', 
                    background: 'var(--UI-Primary, #1D1D1F)', 
                    borderRadius: '8px', 
                    outline: '1px var(--Item-Stroke, #49474B) solid', 
                    outlineOffset: '-1px', 
                    flexDirection: 'column', 
                    justifyContent: 'flex-start', 
                    alignItems: 'flex-start', 
                    display: 'inline-flex'
                  }}>
                    <div style={{
                      alignSelf: 'stretch', 
                      flexDirection: 'column', 
                      justifyContent: 'flex-start', 
                      alignItems: 'center', 
                      gap: '12px', 
                      display: 'flex'
                    }}>
                      <div style={{
                        width: '24px', 
                        padding: '2px', 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '10px', 
                        display: 'flex'
                      }}>
                        <Clock size={20} color="#BDC3C2" />
                      </div>
                      <div style={{
                        alignSelf: 'stretch', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        alignItems: 'center', 
                        gap: '4px', 
                        display: 'flex'
                      }}>
                        <div style={{
                          alignSelf: 'stretch', 
                          textAlign: 'center', 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: 'var(--Text-Primary, #FCFFFF)', 
                          fontSize: '16px', 
                          fontFamily: 'Brockmann', 
                          fontWeight: '600', 
                          lineHeight: '24px', 
                          letterSpacing: '0.32px', 
                          wordWrap: 'break-word'
                        }}>
                          Waiting for {currentTurnPlayer?.participant_name}
                        </div>
                        <div style={{
                          alignSelf: 'stretch', 
                          textAlign: 'center', 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: 'var(--Text-Light-grey, #BDC3C2)', 
                          fontSize: '14px', 
                          fontFamily: 'Brockmann', 
                          fontWeight: '400', 
                          lineHeight: '20px', 
                          wordWrap: 'break-word'
                        }}>
                          It's their turn to make a pick
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isMyTurn && (
                  <div style={{width: '100%', height: '100%', padding: '24px', background: 'var(--Purple-800, #25015E)', borderRadius: '8px', outline: '3px var(--Purple-500, #680AFF) solid', outlineOffset: '-3px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '12px', display: 'flex'}}>
                      <div style={{width: '24px', height: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'flex'}}>
                        <Film size={24} color="#FFD60A" />
                      </div>
                      <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '3px', display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '16px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '24px', letterSpacing: '0.32px', wordWrap: 'break-word'}}>It's Your Turn!</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>Make your next pick to your movie roster</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
                )}
              </>
            )}
          </div>

          {/* Unified participants container with background treatment */}
          <div style={{
            flex: '1 1 0',
            minWidth: '342px',
            height: '100%', 
            padding: '24px', 
            background: 'var(--Section-Container, #0E0E0F)', 
            boxShadow: '0px 0px 6px #3B0394', 
            borderRadius: '8px', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: '24px', 
            display: 'inline-flex'
          }}>
            {/* Join Code section */}
            <div style={{
              alignSelf: 'stretch', 
              flexDirection: 'column',
              justifyContent: 'flex-start', 
              alignItems: 'flex-start', 
              gap: '16px',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                display: 'inline-flex', 
                flexWrap: 'wrap'
              }}>
                <div style={{
                  minWidth: '120px', 
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  color: 'var(--Text-Primary, #FCFFFF)', 
                  fontSize: '24px', 
                  fontFamily: 'Brockmann', 
                  fontWeight: '700', 
                  lineHeight: '24px', 
                  letterSpacing: '0.24px', 
                  wordWrap: 'break-word'
                }}>
                  Join Code
                </div>
              </div>
              {draft.invite_code && <div style={{
                alignSelf: 'flex-end',
                flexDirection: 'row', 
                justifyContent: 'flex-end', 
                alignItems: 'center', 
                gap: '8px', 
                display: 'inline-flex'
              }}>
                  <div style={{
                    paddingLeft: '14px', 
                    paddingRight: '14px', 
                    paddingTop: '4px', 
                    paddingBottom: '4px', 
                    background: 'var(--UI-Primary, #1D1D1F)', 
                    borderRadius: '9999px', 
                    outline: '1px var(--Text-Primary, #FCFFFF) solid', 
                    outlineOffset: '-1px', 
                    justifyContent: 'flex-start', 
                    alignItems: 'center', 
                    display: 'flex'
                  }}>
                    <div style={{
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #FCFFFF)', 
                      fontSize: '18px', 
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', 
                      fontWeight: '400', 
                      lineHeight: '28px', 
                      letterSpacing: '1.08px', 
                      wordWrap: 'break-word'
                    }}>
                      {draft.invite_code}
                    </div>
                  </div>
                  <button 
                    onClick={copyInviteCode}
                    style={{
                      paddingLeft: '12px', 
                      paddingRight: '12px', 
                      paddingTop: '8px', 
                      paddingBottom: '8px', 
                      background: 'var(--UI-Primary, #1D1D1F)', 
                      borderRadius: '2px', 
                      outline: '1px var(--Text-Primary, #FCFFFF) solid', 
                      outlineOffset: '-1px', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '8px', 
                      display: 'flex',
                      cursor: 'pointer',
                      border: 'none'
                    }}
                  >
                    <div style={{
                      width: '16px', 
                      height: '16px', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '10px', 
                      display: 'inline-flex'
                    }}>
                      {copySuccess ? <Check size={16} color="#FCFFFF" /> : <Copy size={16} color="#FCFFFF" />}
                    </div>
                    <div style={{
                      textAlign: 'center', 
                      justifyContent: 'center', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      color: 'var(--Text-Primary, #FCFFFF)', 
                      fontSize: '14px', 
                      fontFamily: 'Brockmann', 
                      fontWeight: '500', 
                      lineHeight: '20px', 
                      wordWrap: 'break-word'
                    }}>
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </div>
                  </button>
              </div>}
            </div>
            
            {/* Participants section */}
            <div style={{
              alignSelf: 'stretch', 
              flexDirection: 'column', 
              justifyContent: 'flex-start', 
              alignItems: 'flex-start', 
              gap: '16px', 
              display: 'flex'
            }}>
              <div style={{
                justifyContent: 'flex-start', 
                alignItems: 'center', 
                gap: '8px', 
                display: 'inline-flex'
              }}>
                <div style={{
                  width: '24px', 
                  height: '24px', 
                  padding: '2px', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '10px', 
                  display: 'inline-flex',
                  color: 'var(--Text-Purple, #907AFF)'
                }}>
                  <MultiPersonIcon className="w-6 h-6" />
                </div>
                <div style={{
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  color: 'var(--Text-Primary, #FCFFFF)', 
                  fontSize: '20px', 
                  fontFamily: 'Brockmann', 
                  fontWeight: '500', 
                  lineHeight: '28px', 
                  wordWrap: 'break-word'
                }}>
                  Participants
                </div>
              </div>
              
              {/* Participants list with proper gap */}
              <div style={{
                alignSelf: 'stretch', 
                flexDirection: 'column', 
                justifyContent: 'flex-start', 
                alignItems: 'flex-start', 
                gap: '8px', 
                display: 'flex'
              }}>
                {getParticipantsSortedByCreatedAt.map(participant => {
                  const pId = participant.participant_id || participant.user_id || participant.guest_participant_id || (participant.is_ai ? participant.id : null);
                  const currentTurnId = draft.current_turn_participant_id || draft.current_turn_user_id;
                  const isCurrentTurn = pId && currentTurnId && String(pId) === String(currentTurnId);
                  return (
                    <div key={participant.id} style={{
                      alignSelf: 'stretch', 
                      paddingTop: '12px', 
                      paddingBottom: '12px', 
                      paddingLeft: '16px', 
                      paddingRight: '12px', 
                      background: 'var(--UI-Primary, #1D1D1F)', 
                      borderRadius: '2px', 
                      outline: '0.50px var(--Item-Stroke, #49474B) solid', 
                      outlineOffset: '-0.50px', 
                      justifyContent: 'flex-start', 
                      alignItems: 'center', 
                      gap: '8px', 
                      display: 'inline-flex'
                    }}>
                      <div style={{
                        flex: '1 1 0', 
                        paddingBottom: '2px', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        alignItems: 'flex-start', 
                        gap: '4px', 
                        display: 'inline-flex'
                      }}>
                        <div style={{
                          alignSelf: 'stretch', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          display: 'inline-flex'
                        }}>
                          <div style={{
                            flex: '1 1 0', 
                            flexDirection: 'column', 
                            justifyContent: 'flex-start', 
                            alignItems: 'flex-start', 
                            display: 'inline-flex'
                          }}>
                            <div style={{
                              justifyContent: 'center', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              color: 'var(--Text-Primary, #FCFFFF)', 
                              fontSize: '16px', 
                              fontFamily: 'Brockmann', 
                              fontWeight: '600', 
                              lineHeight: '24px', 
                              letterSpacing: '0.32px', 
                              wordWrap: 'break-word'
                            }}>
                              {participant.participant_name}
                            </div>
                          </div>
                          <div style={{
                            justifyContent: 'flex-start', 
                            alignItems: 'center', 
                            gap: '4px', 
                            display: 'flex'
                          }}>
                            {participant.is_ai && (
                              <div style={{
                                paddingLeft: '8px', 
                                paddingRight: '8px', 
                                paddingTop: '2px', 
                                paddingBottom: '2px', 
                                background: 'var(--Greyscale-Blue-800, #1A1D29)', 
                                borderRadius: '4px', 
                                justifyContent: 'flex-start', 
                                alignItems: 'center', 
                                display: 'flex'
                              }}>
                                <div style={{
                                  color: 'var(--Greyscale-Blue-300, #828786)', 
                                  fontSize: '12px', 
                                  fontFamily: 'Brockmann', 
                                  fontWeight: '500', 
                                  lineHeight: '16px', 
                                  wordWrap: 'break-word'
                                }}>
                                  AI
                                </div>
                              </div>
                            )}
                            {participant.is_host && <div style={{
                              paddingLeft: '12px', 
                              paddingRight: '12px', 
                              paddingTop: '4px', 
                              paddingBottom: '4px', 
                              background: 'var(--Purple-100, #EDEBFF)', 
                              borderRadius: '9999px', 
                              outline: '0.50px var(--Purple-800, #25015E) solid', 
                              outlineOffset: '-0.50px', 
                              justifyContent: 'flex-start', 
                              alignItems: 'center', 
                              display: 'flex'
                            }}>
                              <div style={{
                                justifyContent: 'center', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                color: 'var(--Purple-900, #100029)', 
                                fontSize: '12px', 
                                fontFamily: 'Brockmann', 
                                fontWeight: '600', 
                                lineHeight: '16px', 
                                wordWrap: 'break-word'
                              }}>
                                Host
                              </div>
                            </div>}
                            {isCurrentTurn && !isComplete && draftHasStarted && <div style={{
                              paddingLeft: '12px', 
                              paddingRight: '12px', 
                              paddingTop: '4px', 
                              paddingBottom: '4px', 
                              background: 'var(--Brand-Primary, #7142FF)', 
                              borderRadius: '9999px', 
                              justifyContent: 'flex-start', 
                              alignItems: 'center', 
                              display: 'flex'
                            }}>
                              <div style={{
                                justifyContent: 'center', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                color: 'var(--Text-Primary, #FCFFFF)', 
                                fontSize: '12px', 
                                fontFamily: 'Brockmann', 
                                fontWeight: '600', 
                                lineHeight: '16px', 
                                wordWrap: 'break-word'
                              }}>
                                Current Turn
                              </div>
                            </div>}
                          </div>
                        </div>
                        <div style={{
                          alignSelf: 'stretch', 
                          justifyContent: 'flex-start', 
                          alignItems: 'flex-start', 
                          gap: '4px', 
                          display: 'inline-flex'
                        }}>
                          <div style={{
                            justifyContent: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            color: 'var(--Teal-500, #0AFFBE)', 
                            fontSize: '12px', 
                            fontFamily: 'Brockmann', 
                            fontWeight: '400', 
                            lineHeight: '16px', 
                            wordWrap: 'break-word'
                          }}>
                            {participant.status === 'joined' ? 'Joined' : participant.status}
                          </div>
                          {participant.email && <div style={{
                            justifyContent: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            color: 'var(--Text-Light-grey, #BDC3C2)', 
                            fontSize: '12px', 
                            fontFamily: 'Brockmann', 
                            fontWeight: '400', 
                            lineHeight: '16px', 
                            wordWrap: 'break-word'
                          }}>
                            {participant.email}
                          </div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Start Draft Button - Show only to host when conditions are met */}
        {!draftHasStarted && participants.length >= 2 && !isComplete && isHost && <div style={{width: '100%', height: '100%', padding: '24px', borderRadius: '8px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', display: 'flex'}}>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px', fontFamily: 'Brockmann', fontWeight: '500', lineHeight: '28px', wordWrap: 'break-word'}}>Everybody Ready?</div>
                </div>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>{participants.length} players have joined. Click below to randomize turn order and start the draft!</div>
                </div>
              </div>
              <div 
                onClick={() => startDraft(draft.id)}
                onMouseEnter={(e) => e.currentTarget.style.background = '#794DFF'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--Purple-500, #680AFF)'}
                style={{paddingLeft: '32px', paddingRight: '32px', paddingTop: '16px', paddingBottom: '16px', background: 'var(--Purple-500, #680AFF)', borderRadius: '2px', justifyContent: 'center', alignItems: 'center', display: 'inline-flex', cursor: 'pointer', transition: 'background 0.2s ease'}}
              >
                <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '18px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '24px', wordWrap: 'break-word'}}>
                  {loading ? 'Starting...' : 'Start Draft'}
                </div>
              </div>
            </div>
          </div>}

        {/* Waiting for Players - Show when not enough players */}
        {!draftHasStarted && participants.length < 2 && <div style={{width: '100%', height: '100%', padding: '24px', borderRadius: '8px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
            <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', display: 'flex'}}>
              <div style={{width: '24px', height: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'flex', color: '#FCFFFF'}}>
                <PersonIcon className="w-6 h-6" />
              </div>
              <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '8px', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px', fontFamily: 'Brockmann', fontWeight: '500', lineHeight: '28px', wordWrap: 'break-word'}}>Waiting For Players</div>
                </div>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>Need at least 2 players to start the draft. Share the invite code above!</div>
                </div>
              </div>
            </div>
          </div>}

        {/* Draft Content */}
        <div className="space-y-6">
          {/* Draft Board */}
          {draftHasStarted && (
          <div>
            <DraftBoard picks={picks.map(pick => {
              const displayIndex = (draft?.player_id_to_display_row && Object.keys(draft.player_id_to_display_row).length > 0)
                ? (draft.player_id_to_display_row[String(pick.player_id)] ?? 0)
                : getDisplayIndexForPlayerId(pick.player_id);
              return {
                playerId: displayIndex + 1,  // Display position (1-based)
                playerName: pick.player_name,
                movie: {
                  id: pick.movie_id,
                  title: pick.movie_title,
                  year: pick.movie_year,
                  poster_path: pick.poster_path
                },
                category: pick.category
              };
            })} players={getPlayersInTurnOrder.map((p, index) => ({
              id: index + 1,  // Display position (1-based)
              name: p.participant_name
            }))} categories={draft.categories} theme={draft.theme} draftOption={getCleanActorName(draft.option)} currentPlayer={currentTurnPlayer ? (() => {
              const displayIndex = getPlayersInTurnOrder.findIndex(p => {
                // For AI participants, also check row id
                const pId = p.participant_id || p.user_id || p.guest_participant_id || (p.is_ai ? p.id : null);
                const currentPlayerId = currentTurnPlayer.participant_id || currentTurnPlayer.user_id || currentTurnPlayer.guest_participant_id || (currentTurnPlayer.is_ai ? currentTurnPlayer.id : null);
                return pId && currentPlayerId && String(pId) === String(currentPlayerId);
              });
              return {
                id: displayIndex >= 0 ? displayIndex + 1 : 1,
                name: currentTurnPlayer.participant_name
              };
            })() : undefined} />
          </div>
          )}

          {/* Voting setup (host) and voting UI - when draft is complete */}
          {isComplete && draft?.id && (
            <div className="flex flex-col gap-3 w-full max-w-md mx-auto px-4">
              {!votingConfigured && (
                <>
                  {isHost ? (
                    <div
                      className="w-full rounded-lg flex flex-wrap justify-center align-content-start"
                      style={{
                        background: 'var(--Section-Container, #0E0E0F)',
                        boxShadow: '0px 0px 6px #3B0394',
                        borderRadius: 8,
                      }}
                    >
                      <div className="flex-1 min-w-0 p-6 flex flex-col gap-6 items-center text-center" style={{ minWidth: 295 }}>
                        <div className="flex flex-col justify-center items-center gap-2">
                          <div className="text-center font-brockmann font-medium text-[20px] leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">Enable Voting?</div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 w-full min-w-0">
                          <button
                            type="button"
                            onClick={() => setAddVoting(true)}
                            className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                            style={{
                              background: addVoting === true ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                              outline: '1px solid var(--Item-Stroke, #49474B)',
                              outlineOffset: -1,
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddVoting(false)}
                            className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                            style={{
                              background: addVoting === false ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                              outline: '1px solid var(--Item-Stroke, #49474B)',
                              outlineOffset: -1,
                            }}
                          >
                            No
                          </button>
                        </div>
                        {addVoting === true && (
                          <>
                            <div className="flex flex-col justify-center items-center gap-2">
                              <div className="text-center font-brockmann font-medium text-[20px] leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">Gather Public Votes?</div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 w-full min-w-0">
                              <button
                                type="button"
                                onClick={() => setVotingPublic(true)}
                                className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                                style={{
                                  background: votingPublic === true ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                                  outline: '1px solid var(--Item-Stroke, #49474B)',
                                  outlineOffset: -1,
                                }}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setVotingPublic(false)}
                                className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                                style={{
                                  background: votingPublic === false ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                                  outline: '1px solid var(--Item-Stroke, #49474B)',
                                  outlineOffset: -1,
                                }}
                              >
                                No
                              </button>
                            </div>
                            {votingPublic && draft?.id && (
                              <div className="flex flex-wrap justify-center items-center gap-2.5 w-full">
                                <input
                                  readOnly
                                  value={typeof window !== 'undefined' ? `${window.location.origin}/vote/${draft.id}` : ''}
                                  className="flex-1 min-w-0 py-1 px-3.5 rounded-full font-mono text-sm leading-7 tracking-[1.08px] text-[var(--Text-Primary,#FCFFFF)] truncate"
                                  style={{
                                    background: 'var(--UI-Primary, #1D1D1F)',
                                    outline: '1px solid var(--Text-Primary, #FCFFFF)',
                                    outlineOffset: -1,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = `${window.location.origin}/vote/${draft.id}`;
                                    navigator.clipboard.writeText(url);
                                    toast({ title: 'Link copied', description: 'Share link copied to clipboard.' });
                                  }}
                                  className="py-2 px-3 rounded-sm font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] flex items-center gap-2 shrink-0"
                                  style={{
                                    background: 'var(--UI-Primary, #1D1D1F)',
                                    outline: '1px solid var(--Text-Primary, #FCFFFF)',
                                    outlineOffset: -1,
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </button>
                              </div>
                            )}
                            <div className="flex flex-col justify-center items-center gap-2">
                              <div className="text-center font-brockmann font-medium text-[20px] leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">Set A Time Limit</div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 w-full min-w-0">
                              {DURATION_OPTIONS.map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setVotingDuration(opt.value)}
                                  className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                                  style={{
                                    background: votingDuration === opt.value ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                                    outline: '1px solid var(--Item-Stroke, #49474B)',
                                    outlineOffset: -1,
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={submittingSetup}
                              onClick={handleVotingSetupSubmit}
                              className="w-fit py-3 px-6 rounded-sm font-brockmann font-semibold text-base leading-6 tracking-[0.32px] text-[var(--Text-Primary,#FCFFFF)] disabled:opacity-50 transition-opacity"
                              style={{ background: 'var(--Brand-Primary, #7142FF)' }}
                            >
                              {submittingSetup ? 'Enabling...' : 'Begin Voting'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-greyscale-blue-300 text-sm font-brockmann text-center py-2">Waiting for host to set up voting...</div>
                  )}
                </>
              )}
              {/* Share vote link + QR: show for host when just enabled, and for everyone (including non-host) when voting is open and public */}
              {votingConfigured && votingMeta?.allow_public_voting && draft?.id && (votingJustEnabled && isHost || votingOpen) && (
                <div
                  className="w-full flex flex-wrap justify-center align-content-start rounded-lg"
                  style={{
                    background: 'var(--Section-Container, #0E0E0F)',
                    boxShadow: '0px 0px 6px #3B0394',
                    borderRadius: 8,
                  }}
                >
                  <div className="flex-1 min-w-0 p-6 flex flex-col justify-start items-center gap-6">
                    <div className="w-full flex flex-col justify-start items-start gap-2">
                      <div className="w-full flex flex-col justify-start items-center">
                        <div className="w-full text-center text-[20px] font-brockmann font-medium leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">
                          Voting is Open
                        </div>
                      </div>
                      <div className="w-full flex flex-col justify-start items-center">
                        <p className="w-full text-center text-sm font-brockmann font-normal leading-5 text-[var(--Text-Primary,#FCFFFF)]">
                          Other participants will see the voting option on this page. Share the link or scan the QR code below so anyone can vote.
                        </p>
                      </div>
                    </div>
                    {votingMeta?.allow_public_voting && draft?.id && (
                      <>
                        <div className="w-full min-w-[295px] flex flex-nowrap justify-center items-center gap-2.5">
                          <div
                            className="flex-1 min-w-0 py-1 px-3.5 rounded-full flex justify-start items-center font-mono text-lg leading-7 tracking-[1.08px] text-[var(--Text-Primary,#FCFFFF)] truncate"
                            style={{
                              background: 'var(--UI-Primary, #1D1D1F)',
                              outline: '1px solid var(--Text-Primary, #FCFFFF)',
                              outlineOffset: -1,
                            }}
                          >
                            {typeof window !== 'undefined' ? `${window.location.origin}/vote/${draft.id}` : ''}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}/vote/${draft.id}`;
                              navigator.clipboard.writeText(url);
                              toast({ title: 'Link copied', description: 'Share link copied to clipboard.' });
                            }}
                            className="py-2 px-3 rounded-sm flex justify-center items-center gap-2 shrink-0 font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)]"
                            style={{
                              background: 'var(--UI-Primary, #1D1D1F)',
                              outline: '1px solid var(--Text-Primary, #FCFFFF)',
                              outlineOffset: -1,
                            }}
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                        </div>
                        <QRCodeSVG
                          value={typeof window !== 'undefined' ? `${window.location.origin}/vote/${draft.id}` : ''}
                          size={120}
                          className="bg-white rounded p-1"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
              {votingConfigured && votingOpen && participants.length > 0 && (
                <div
                  className="w-full flex flex-wrap justify-center align-content-start rounded-lg"
                  style={{
                    background: 'var(--Section-Container, #0E0E0F)',
                    boxShadow: '0px 0px 6px #3B0394',
                    borderRadius: 8,
                  }}
                >
                  <div className="flex-1 min-w-0 p-6 flex flex-col justify-start items-center gap-6">
                    {participants.find((p: any) => p.id === myParticipantId)?.is_ai ? (
                      <div className="w-full max-w-[617px] text-center text-sm font-brockmann text-[var(--Text-Primary,#FCFFFF)]">AI players cannot vote.</div>
                    ) : myVote ? (
                      <div className="w-full max-w-[617px] flex flex-col justify-start items-start gap-6">
                        <div className="w-full flex flex-col justify-start items-center">
                          <div className="w-full text-center text-[20px] font-brockmann font-medium leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">
                            You Voted For {participants.find((p: any) => p.id === myVote.voted_participant_id)?.participant_name ?? 'Unknown'}
                          </div>
                        </div>
                        <div className="w-full flex flex-col justify-start items-start gap-3">
                          {participants.map((p: any) => {
                            const count = voteCountsByParticipantId.get(p.id) ?? 0;
                            const total = Array.from(voteCountsByParticipantId.values()).reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                              <div key={p.id} className="w-full flex flex-col justify-start items-start gap-2">
                                <div className="w-full flex justify-between items-center">
                                  <span className="text-xs font-brockmann font-normal leading-4 text-[var(--Text-Primary,#FCFFFF)]">{p.participant_name}</span>
                                  <span className="text-xs font-brockmann font-semibold leading-4 text-[var(--Text-Primary,#FCFFFF)]">{pct}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--Greyscale-(Purp)-800, #2C2B2D)' }}>
                                  <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: 'var(--Brand-Primary, #7142FF)' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-full max-w-[617px] flex flex-col justify-center items-center gap-2">
                          <div className="w-full text-center text-[20px] font-brockmann font-medium leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">
                            Cast Your Vote For Who Won
                          </div>
                        </div>
                        <div className="w-full max-w-[617px] flex flex-col justify-start items-start gap-4">
                          {participants.filter((p: any) => p.id !== myParticipantId).map((p: any) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedVoteParticipantId((prev) => (prev === p.id ? null : p.id))}
                              disabled={submittingVote}
                              className="w-full min-w-[294px] py-3 px-6 rounded text-center text-sm font-brockmann font-medium leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                              style={{
                                background: selectedVoteParticipantId === p.id ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                                outline: '1px solid var(--Item-Stroke, #49474B)',
                                outlineOffset: -1,
                              }}
                            >
                              {p.participant_name}
                            </button>
                          ))}
                        </div>
                        {selectedVoteParticipantId && (
                          <button
                            type="button"
                            disabled={submittingVote}
                            onClick={async () => {
                              if (!selectedVoteParticipantId) return;
                              await handleVote(selectedVoteParticipantId);
                              setSelectedVoteParticipantId(null);
                            }}
                            className="px-6 py-3 rounded-sm font-brockmann font-semibold text-base leading-6 tracking-[0.32px] text-[var(--Greyscale-(Blue)-800,#2B2D2D)] disabled:opacity-50 transition-opacity"
                            style={{ background: 'var(--Yellow-500, #FFD60A)' }}
                          >
                            Confirm Choice
                          </button>
                        )}
                      </>
                    )}
                    {!myVote && voteCountsByParticipantId.size > 0 && (
                      <div className="w-full max-w-[617px] text-center text-xs font-brockmann text-[var(--Text-Primary,#FCFFFF)] opacity-80">
                        {participants.map((p: any) => voteCountsByParticipantId.get(p.id) != null ? `${p.participant_name}: ${voteCountsByParticipantId.get(p.id)}` : null).filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {votingConfigured && !votingOpen && <div className="text-greyscale-blue-300 text-sm font-brockmann text-center py-2">Voting closed</div>}
            </div>
          )}

          {/* Voting countdown - when voting is open with a timer */}
          {isComplete && votingConfigured && votingOpen && votingEndsAt != null && (
            <div className="flex justify-center">
              <div className="text-center text-sm font-brockmann text-[var(--Text-Primary,#FCFFFF)]">
                Voting ends in <span className="font-semibold tabular-nums">{formatVotingCountdown(votingTimeRemaining)}</span>
              </div>
            </div>
          )}

          {/* View Final Scores Button - Show when draft is complete; clickable when voting ended (public timer) or all humans voted (non-public) */}
          {isComplete && (
            <div className="flex justify-center">
              <div 
                onClick={() => finalScoresClickable && navigate(`/final-scores/${draft.id}`)}
                onMouseEnter={(e) => { if (finalScoresClickable) e.currentTarget.style.background = '#794DFF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = finalScoresClickable ? 'var(--Purple-500, #680AFF)' : undefined; }}
                style={{
                  paddingLeft: '24px', 
                  paddingRight: '24px', 
                  paddingTop: '12px', 
                  paddingBottom: '12px', 
                  background: finalScoresClickable ? 'var(--Purple-500, #680AFF)' : 'var(--greyscale-purp-800, #2a2a2e)', 
                  borderRadius: '2px', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  display: 'inline-flex', 
                  cursor: finalScoresClickable ? 'pointer' : 'not-allowed',
                  opacity: finalScoresClickable ? 1 : 0.7,
                  transition: 'background 0.2s ease'
                }}
                title={!finalScoresClickable && votingConfigured ? (votingMeta?.allow_public_voting ? 'Voting is still open (timer).' : 'View Final Scores when all human players have voted.') : undefined}
              >
                <div style={{
                  textAlign: 'center', 
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'row', 
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--UI-Primary, white)', 
                  fontSize: '16px', 
                  fontFamily: 'Brockmann', 
                  fontWeight: '600', 
                  lineHeight: '24px', 
                  wordWrap: 'break-word'
                }}>
                  <Trophy size={20} color="#FFD60A" />
                  View Final Scores
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-6">
            {!isComplete && currentTurnPlayer && (
              <>
                {isAITurn ? (
                  <div className="p-6 bg-greyscale-purp-900 rounded-lg flex flex-col items-center gap-4">
                    <div className="text-greyscale-blue-100 text-lg font-brockmann font-medium">
                      {currentTurnPlayer.participant_name} is thinking...
                    </div>
                    {aiPicking && (
                      <div className="text-greyscale-blue-300 text-sm">
                        Analyzing movies...
                      </div>
                    )}
                  </div>
                ) : isMyTurn ? (
                  <>
                    <MovieSearch theme={draft.theme} option={getCleanActorName(draft.option)} searchQuery={searchQuery} onSearchChange={setSearchQuery} movies={movies} loading={moviesLoading} onMovieSelect={handleMovieSelect} selectedMovie={selectedMovie} themeParameter={themeConstraint} />

                    <EnhancedCategorySelection 
                      selectedMovie={selectedMovie} 
                      categories={draft.categories} 
                      selectedCategory={selectedCategory} 
                      onCategorySelect={handleCategorySelect} 
                      picks={picks.map(pick => {
                        const displayIndex = (draft?.player_id_to_display_row && Object.keys(draft.player_id_to_display_row).length > 0)
                          ? (draft.player_id_to_display_row[String(pick.player_id)] ?? 0)
                          : getDisplayIndexForPlayerId(pick.player_id);
                        return {
                          playerId: displayIndex + 1,  // Display position (1-based)
                          playerName: pick.player_name,
                          movie: {
                            id: pick.movie_id,
                            title: pick.movie_title,
                            year: pick.movie_year,
                            poster_path: pick.poster_path
                          },
                          category: pick.category
                        };
                      })} 
                      currentPlayerId={(() => {
                        const displayIndex = getPlayersInTurnOrder.findIndex(p => 
                          (p.user_id || p.guest_participant_id) === effectiveParticipantId
                        );
                        return displayIndex >= 0 ? displayIndex + 1 : 1;
                      })()}
                      theme={draft.theme}
                      option={draft.option}
                      checkingOscarStatus={checkingOscarStatus}
                    />

                    <PickConfirmation currentPlayerName={currentTurnPlayer?.participant_name || 'You'} selectedMovie={selectedMovie} selectedCategory={selectedCategory} onConfirm={confirmPick} />
                  </>
                ) : null}
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
