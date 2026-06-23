import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { useAIPick } from '@/hooks/useAIPick';
import { useDraftBoardPicker } from '@/hooks/useDraftBoardPicker';
import { useActorSpecCategories } from '@/hooks/useActorSpecCategories';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Loader2 } from 'lucide-react';
import { InteractiveDraftBoard } from '@/components/draft-board/InteractiveDraftBoard';
import { DraftLobbyStatusParticipants } from '@/components/draft-board/DraftLobbyStatusParticipants';
import type { BoardRailParticipant } from '@/components/draft-board/DraftBoardPlayerRail';

import { getCleanActorName } from '@/lib/utils';
import { DraftPageHeaderSection } from '@/components/DraftPageHeaderSection';
import { DraftHeadingTitle } from '@/components/DraftHeadingTitle';
import { supabase } from '@/integrations/supabase/client';
import { Participant, normalizeParticipants } from '@/types/participant';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { getEligibleCategories } from '@/utils/movieCategoryUtils';
import { PublicVoteShareCard } from '@/components/PublicVoteShareCard';
import { VotingSetupWizard } from '@/components/VotingSetupWizard';
import { CastVotePanel, VotingSessionCard } from '@/components/CastVotePanel';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { SITE_ORIGIN, dynamicOgImageUrl, OG_IMAGE_ALT } from '@/config/socialShareMeta';
import { buildInteractiveBoardModelFromMultiplayer } from '@/utils/interactiveBoardModel';
import { Movie } from '@/data/movies';

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
    createMultiplayerDraft,
    makePick,
    loadDraft,
    startDraft
  } = useMultiplayerDraft(draftId, undefined, participantIdFromParent);
  // Use parent's participantId when available so we don't show "Authentication Required" while parent has session
  const effectiveParticipantId = participantIdFromParent ?? participantId;
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

  const DURATION_OPTIONS = [
    { label: '5 min', value: 5 },
    { label: '1 hour', value: 60 },
    { label: '24 hours', value: 1440 }
  ] as const;

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
    if (!draft?.id) return;
    if (!votingMeta) return;
    if (!votingMeta.allow_public_voting && !votingMeta.voting_ends_at) return;
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
  }, [draft?.id, votingMeta?.voting_ends_at, votingMeta?.allow_public_voting, guestSession]);

  const votingEndsAt = votingMeta?.voting_ends_at ? new Date(votingMeta.voting_ends_at).getTime() : null;
  const votingOpen =
    Boolean(votingMeta?.allow_public_voting && votingEndsAt == null) ||
    (votingEndsAt != null && now < votingEndsAt);
  const votingConfigured = votingEndsAt != null || votingMeta?.allow_public_voting === true;

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

  // Get base category for movie search (used after picker hook initializes)
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
              selectedMovie.posterPath ?? undefined,
              aiParticipantId,
              effectiveParticipantId ?? undefined
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

  // Count of participants who have actually opened this draft (status ===
  // 'joined'), as opposed to participants.length which counts every row
  // pre-created when the draft was scheduled (most still 'invited'). Used
  // for the host's pre-start "Everybody Ready?" panel — without this, that
  // panel claimed "4 players have joined" the instant a scheduled draft was
  // opened, when really only the host had.
  const joinedParticipantsCount = useMemo(
    () => getParticipantsSortedByCreatedAt.filter(participant => participant.status === 'joined').length,
    [getParticipantsSortedByCreatedAt]
  );

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

  // Active drafters only — exclude pre-invited rows that haven't joined yet
  const draftBoardParticipants = useMemo(
    () => getPlayersInTurnOrder.filter((p) => p.status !== 'invited'),
    [getPlayersInTurnOrder]
  );

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

  const actorNameForSpec =
    draft?.theme === 'people' ? getCleanActorName(draft.option || '') : null;
  const { specCategories } = useActorSpecCategories(actorNameForSpec);

  const currentPlayerBoardId = useMemo(() => {
    if (!currentTurnPlayer || draftBoardParticipants.length === 0) return 1;
    const displayIndex = draftBoardParticipants.findIndex((p) => {
      const pId = p.participant_id || p.user_id || p.guest_participant_id || (p.is_ai ? p.id : null);
      const currentPlayerId =
        currentTurnPlayer.participant_id ||
        currentTurnPlayer.user_id ||
        currentTurnPlayer.guest_participant_id ||
        (currentTurnPlayer.is_ai ? currentTurnPlayer.id : null);
      return pId && currentPlayerId && String(pId) === String(currentPlayerId);
    });
    return displayIndex >= 0 ? displayIndex + 1 : 1;
  }, [currentTurnPlayer, draftBoardParticipants]);

  const interactiveBoardModel = useMemo(() => {
    if (!draft) {
      return { boardCategories: [] as string[], boardPlayers: [], boardPicks: [] };
    }
    return buildInteractiveBoardModelFromMultiplayer(
      draft,
      picks,
      draftBoardParticipants.map((p) => ({
        id: p.id,
        participant_name: p.participant_name,
        is_ai: p.is_ai,
        user_id: p.user_id,
        guest_participant_id: p.guest_participant_id,
        created_at: p.created_at,
        participant_id: p.participant_id,
      })),
      getDisplayIndexForPlayerId
    );
  }, [draft, picks, draftBoardParticipants, getDisplayIndexForPlayerId]);

  const boardPicksForPicker = useMemo(
    () =>
      interactiveBoardModel.boardPicks.map((p) => ({
        playerId: p.playerId,
        category: p.category,
      })),
    [interactiveBoardModel.boardPicks]
  );

  const handlePickSubmit = useCallback(
    async (movie: Movie, category: string, options?: { houseOverride?: boolean }) => {
      if (!isMyTurn || currentTurnIsAI) {
        toast({
          title: 'Not Your Turn',
          description: "It's not your turn to make a pick. Please wait for your turn.",
          variant: 'destructive',
        });
        return;
      }

      if (!options?.houseOverride) {
        const eligible = getEligibleCategories(
          movie,
          draft?.categories ?? [],
          draft?.theme,
          draft?.option,
          specCategories
        );
        if (!eligible.includes(category)) {
          toast({
            title: 'Invalid Category',
            description: `${movie.title} cannot be placed in ${category}.`,
            variant: 'destructive',
          });
          return;
        }

        const movieYear = movie.releaseDate
          ? new Date(movie.releaseDate).getFullYear()
          : movie.year || new Date().getFullYear();
        if (
          draft?.theme === 'year' &&
          draft?.option &&
          movieYear !== parseInt(draft.option, 10)
        ) {
          toast({
            title: 'Invalid Category',
            description: `${movie.title} (${movieYear}) is not from ${draft.option}.`,
            variant: 'destructive',
          });
          return;
        }
      }

      const year = movie.releaseDate
        ? new Date(movie.releaseDate).getFullYear()
        : movie.year || new Date().getFullYear();
      const genre = movie.genre_names?.[0] || movie.genre || 'Unknown';

      await makePick(
        movie.id,
        movie.title,
        year,
        genre,
        category,
        movie.poster_path ?? movie.posterPath ?? undefined
      );
    },
    [isMyTurn, currentTurnIsAI, draft, specCategories, makePick, toast]
  );

  const {
    pickerState,
    submitting: pickerSubmitting,
    startSelect,
    cancel: cancelPicker,
    selectMovie,
    confirmPick,
    setSearchQuery,
    isCategoryAvailable,
  } = useDraftBoardPicker({
    isMyTurn: isMyTurn && !currentTurnIsAI && !draft?.is_complete,
    currentPlayerId: currentPlayerBoardId,
    picks: boardPicksForPicker,
    onSubmit: handlePickSubmit,
  });

  const themeConstraint =
    draft?.theme === 'year' || draft?.theme === 'people' || draft?.theme === 'spec-draft'
      ? draft.option
      : '';
  const { movies, loading: moviesLoading } = useMovies(
    getBaseCategory(),
    themeConstraint,
    pickerState.searchQuery
  );

  const currentTurnBoardPlayer = useMemo(() => {
    if (!currentTurnPlayer) return undefined;
    return {
      id: currentPlayerBoardId,
      name: currentTurnPlayer.participant_name,
    };
  }, [currentTurnPlayer, currentPlayerBoardId]);

  const railParticipants: BoardRailParticipant[] = useMemo(
    () =>
      draftBoardParticipants.map((p) => {
        const pId = p.participant_id || p.user_id || p.guest_participant_id || p.id;
        const isCurrent =
          currentTurnPlayer &&
          String(pId) ===
            String(
              currentTurnPlayer.participant_id ||
                currentTurnPlayer.user_id ||
                currentTurnPlayer.guest_participant_id ||
                (currentTurnPlayer.is_ai ? currentTurnPlayer.id : null)
            );
        return {
          id: String(pId),
          name: p.participant_name,
          avatarUrl: p.avatar_url,
          isCurrentTurn: Boolean(isCurrent),
          showOnlineStatus: true,
          isOnline: p.status === 'joined',
        };
      }),
    [draftBoardParticipants, currentTurnPlayer]
  );

  const canonicalDraftUrl = draftId ? `${SITE_ORIGIN}/draft/${draftId}` : `${SITE_ORIGIN}/draft`;

  // Single gentle loading screen (session or draft loading) — avoids big skeleton flicker when landing after create
  const showDraftLoading = (loading || sessionLoading) || (draftId && !draft);
  if (showDraftLoading) {
    const loadTitle = 'Movie Drafter - Loading draft';
    const loadDesc = 'Loading your multiplayer movie drafting game on Movie Drafter: fantasy movie draft picks across categories with friends.';
    return (
      <>
        <Helmet>
          <title>{loadTitle}</title>
          <meta name="description" content={loadDesc} />
          <link rel="canonical" href={canonicalDraftUrl} />
          <meta property="og:title" content={loadTitle} />
          <meta property="og:description" content={loadDesc} />
          <meta property="og:url" content={canonicalDraftUrl} />
          {socialShareImageMetaNodes()}
          <meta name="twitter:title" content={loadTitle} />
          <meta name="twitter:description" content={loadDesc} />
        </Helmet>
        <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
          <Loader2 className="h-8 w-8 animate-spin text-purple-300 mb-4" />
          <p className="text-greyscale-blue-100 text-lg font-medium">Loading your draft...</p>
        </div>
      </>
    );
  }

  // Only show "Authentication Required" if session is done loading but no participant id (from parent or child)
  if (!sessionLoading && !effectiveParticipantId) {
    const authTitle = 'Movie Drafter - Join movie drafting game';
    const authDesc = 'Sign in or continue as a guest to join this multiplayer movie drafting game on Movie Drafter.';
    return (
      <>
        <Helmet>
          <title>{authTitle}</title>
          <meta name="description" content={authDesc} />
          <link rel="canonical" href={canonicalDraftUrl} />
          <meta property="og:title" content={authTitle} />
          <meta property="og:description" content={authDesc} />
          <meta property="og:url" content={canonicalDraftUrl} />
          {socialShareImageMetaNodes()}
          <meta name="twitter:title" content={authTitle} />
          <meta name="twitter:description" content={authDesc} />
        </Helmet>
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
      </>
    );
  }

  // Only show "Draft Not Found" if we don't have a draftId (user navigated directly to invalid URL)
  if (!draft) {
    const nfTitle = 'Movie Drafter - Draft not found';
    const nfDesc = 'This draft does not exist or you do not have permission to view it. Start a new movie drafting game on Movie Drafter.';
    return (
      <>
        <Helmet>
          <title>{nfTitle}</title>
          <meta name="description" content={nfDesc} />
          <link rel="canonical" href={canonicalDraftUrl} />
          <meta property="og:title" content={nfTitle} />
          <meta property="og:description" content={nfDesc} />
          <meta property="og:url" content={canonicalDraftUrl} />
          {socialShareImageMetaNodes()}
          <meta name="twitter:title" content={nfTitle} />
          <meta name="twitter:description" content={nfDesc} />
        </Helmet>
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
      </>
    );
  }

  const isComplete = draft.is_complete;

  const pageTitle = `Movie Drafter - ${draft.title}`;
  const pageDescription = `“${draft.title}” — multiplayer movie drafting game on Movie Drafter. Fantasy movie draft picks across categories with friends.`;
  const shareOgUrl = dynamicOgImageUrl({
    title: draft.title,
    subtitle: 'Multiplayer movie draft — join on Movie Drafter',
  });
  const shareOgAlt = `Movie Drafter draft: ${draft.title}`.slice(0, 200);

  return (
    <>
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={canonicalDraftUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={canonicalDraftUrl} />
      {socialShareImageMetaNodes({ imageUrl: shareOgUrl, imageAlt: shareOgAlt || OG_IMAGE_ALT })}
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
    </Helmet>
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-4">
        <DraftPageHeaderSection className="mb-0" contentClassName="px-6 py-4">
          <DraftHeadingTitle
            option={draft.option}
            theme={draft.theme}
            specDraftName={specDraftName}
          />
        </DraftPageHeaderSection>
      </div>

      {draftHasStarted && (
        <InteractiveDraftBoard
          players={interactiveBoardModel.boardPlayers}
          categories={interactiveBoardModel.boardCategories}
          picks={interactiveBoardModel.boardPicks}
          theme={draft.theme}
          draftOption={getCleanActorName(draft.option)}
          currentPlayer={currentTurnBoardPlayer}
          railParticipants={railParticipants}
          isMyTurn={isMyTurn && !isComplete}
          isAiThinking={isAITurn || currentTurnIsAI}
          aiThinkingName={currentTurnPlayer?.participant_name}
          aiPicking={aiPicking}
          pickerState={pickerState}
          movies={movies}
          moviesLoading={moviesLoading}
          onStartSelect={startSelect}
          onCancel={cancelPicker}
          onSearchChange={setSearchQuery}
          onMovieSelect={selectMovie}
          onConfirm={confirmPick}
          confirming={pickerSubmitting}
          isCategoryAvailable={isCategoryAvailable}
          specCategories={specCategories}
        />
      )}

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <DraftLobbyStatusParticipants
          draft={draft}
          isComplete={isComplete}
          draftHasStarted={Boolean(draftHasStarted)}
          isHost={isHost}
          isMyTurn={isMyTurn}
          currentTurnPlayer={currentTurnPlayer}
          participants={participants}
          sortedParticipants={getParticipantsSortedByCreatedAt}
          joinedParticipantsCount={joinedParticipantsCount}
          copySuccess={copySuccess}
          loading={loading}
          onCopyInviteCode={copyInviteCode}
          onStartDraft={() => startDraft(draft.id)}
        />

        {/* Draft Content */}
        <div className="space-y-6">
          {/* Voting setup (host) and voting UI - when draft is complete */}
          {isComplete && draft?.id && (
            <div className="flex flex-col gap-3 w-full max-w-[680px] mx-auto">
              {!votingConfigured && (
                <>
                  {isHost ? (
                    <VotingSetupWizard
                      variant="full"
                      addVoting={addVoting}
                      votingPublic={votingPublic}
                      votingDuration={votingDuration}
                      durationOptions={DURATION_OPTIONS}
                      submittingSetup={submittingSetup}
                      sharePillText={
                        draft.invite_code
                          ? String(draft.invite_code)
                          : draft.id.replace(/-/g, '').slice(0, 8).toUpperCase()
                      }
                      shareCopyValue={
                        typeof window !== 'undefined' ? `${window.location.origin}/vote/${draft.id}` : ''
                      }
                      toastCopySuccess={() =>
                        toast({ title: 'Link copied', description: 'Share link copied to clipboard.' })
                      }
                      onEnableYes={() => setAddVoting(true)}
                      onEnableNo={() => setAddVoting(false)}
                      onGatherPublicYes={() => setVotingPublic(true)}
                      onGatherPublicNo={() => setVotingPublic(false)}
                      onDurationChange={setVotingDuration}
                      onBeginVoting={handleVotingSetupSubmit}
                    />
                  ) : (
                    <div className="text-greyscale-blue-300 text-sm font-brockmann text-center py-2">Waiting for host to set up voting...</div>
                  )}
                </>
              )}
              {/* Share vote link + QR: show for host when just enabled, and for everyone (including non-host) when voting is open and public */}
              {votingConfigured && votingMeta?.allow_public_voting && draft?.id && (votingJustEnabled && isHost || votingOpen) && (
                <PublicVoteShareCard
                  voteUrl={typeof window !== 'undefined' ? `${window.location.origin}/vote/${draft.id}` : ''}
                  onCopy={() => {
                    const url = `${window.location.origin}/vote/${draft.id}`;
                    void navigator.clipboard.writeText(url).then(() =>
                      toast({ title: 'Link copied', description: 'Share link copied to clipboard.' })
                    );
                  }}
                />
              )}
              {votingConfigured && votingOpen && participants.length > 0 && (
                <>
                  {participants.find((p: any) => p.id === myParticipantId)?.is_ai ? (
                    <VotingSessionCard>
                      <div className="w-full max-w-[617px] text-center text-sm font-brockmann text-[var(--Text-Primary,#FCFFFF)]">
                        AI players cannot vote.
                      </div>
                    </VotingSessionCard>
                  ) : myVote ? (
                    <VotingSessionCard>
                      <div className="w-full max-w-[617px] flex flex-col justify-start items-start gap-6">
                        <div className="w-full flex flex-col justify-start items-center">
                          <div className="w-full text-center text-xl font-brockmann font-medium leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">
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
                                <div className="w-full flex justify-between items-center gap-2 min-w-0">
                                  <span className="min-w-0 truncate text-xs font-brockmann font-normal leading-4 text-[var(--Text-Primary,#FCFFFF)]" title={p.participant_name}>{p.participant_name}</span>
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
                    </VotingSessionCard>
                  ) : (
                    <CastVotePanel
                      options={participants
                        .filter((p: any) => p.id !== myParticipantId)
                        .map((p: any) => ({ key: String(p.id), label: p.participant_name }))}
                      selectedKey={selectedVoteParticipantId != null ? String(selectedVoteParticipantId) : null}
                      onOptionClick={key =>
                        setSelectedVoteParticipantId(prev =>
                          prev != null && String(prev) === key ? null : key
                        )
                      }
                      submitting={submittingVote}
                      onConfirm={async () => {
                        if (!selectedVoteParticipantId) return;
                        await handleVote(selectedVoteParticipantId);
                        setSelectedVoteParticipantId(null);
                      }}
                      footer={
                        voteCountsByParticipantId.size > 0 ? (
                          <div className="w-full max-w-[617px] text-center text-xs font-brockmann text-[var(--Text-Primary,#FCFFFF)] opacity-80">
                            {participants
                              .map((p: any) =>
                                voteCountsByParticipantId.get(p.id) != null
                                  ? `${p.participant_name}: ${voteCountsByParticipantId.get(p.id)}`
                                  : null
                              )
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        ) : undefined
                      }
                    />
                  )}
                </>
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
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = finalScoresClickable
                    ? 'var(--Purple-500, #680AFF)'
                    : 'var(--greyscale-purp-800, #2a2a2e)';
                }}
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

        </div>
      </div>
    </div>
    </>
  );
};
