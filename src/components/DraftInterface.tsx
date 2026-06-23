
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraftGame } from '@/hooks/useDraftGame';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Participant, normalizeParticipants } from '@/types/participant';
import { useAIPick } from '@/hooks/useAIPick';
import { useDraftBoardPicker } from '@/hooks/useDraftBoardPicker';
import { useActorSpecCategories } from '@/hooks/useActorSpecCategories';
import { getEligibleCategories } from '@/utils/movieCategoryUtils';
import { BOX_OFFICE_FLOP_PENALTY } from '@/utils/scoreCalculator';
import { InteractiveDraftBoard } from '@/components/draft-board/InteractiveDraftBoard';
import type { BoardRailParticipant } from '@/components/draft-board/DraftBoardPlayerRail';
import { buildInteractiveBoardModelFromLocal } from '@/utils/interactiveBoardModel';
import { Movie } from '@/data/movies';
import { getCleanActorName } from '@/lib/utils';

import DraftComplete from './DraftComplete';
import { MultiplayerDraftInterface } from './MultiplayerDraftInterface';

interface DraftInterfaceProps {
  draftState: {
    theme: string;
    option: string;
    participants: string[] | Participant[];
    categories: string[];
    existingDraftId?: string;
    isMultiplayer?: boolean;
    inviteCode?: string;
    forceNewDraft?: boolean;
  };
  existingPicks?: any[];
}

// Generate a local draftId as fallback when database save fails
const generateLocalDraftId = () => {
  // Use crypto.randomUUID if available, otherwise generate a simple UUID
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const DraftInterface = ({ draftState, existingPicks }: DraftInterfaceProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const hasShownToast = useRef(false);
  
  // Ensure draftState has required properties with defaults.
  // Must be memoized — an inline object literal would get a new reference on every render,
  // which would cause performAutoSave and the AI-turn effect to re-run on every render.
  const safeDraftState = useMemo(() => ({
    ...(draftState || {}),
    participants: draftState?.participants || [],
    categories: draftState?.categories || [],
  }), [draftState]);
  const skipResumeSameSetup =
    !!draftState?.forceNewDraft && !safeDraftState.isMultiplayer;
  
  // Show success message for multiplayer draft creation
  useEffect(() => {
    if (safeDraftState.isMultiplayer && !safeDraftState.existingDraftId && !hasShownToast.current) {
      const participantsCount = Array.isArray(safeDraftState.participants) ? safeDraftState.participants.length : 0;
      hasShownToast.current = true;
      toast({
        title: "Multiplayer Draft Created!",
        description: `Email invitations have been sent to ${participantsCount} participant(s)`,
      });
    }
  }, [safeDraftState.isMultiplayer, safeDraftState.existingDraftId, safeDraftState.participants, toast]);
  
  // If this is a multiplayer draft, use the multiplayer interface
  if (safeDraftState.isMultiplayer) {
    return (
      <MultiplayerDraftInterface 
        draftId={safeDraftState.existingDraftId}
        initialData={safeDraftState.existingDraftId ? undefined : {
          theme: safeDraftState.theme,
          option: safeDraftState.option,
          participants: safeDraftState.participants,
          categories: safeDraftState.categories,
          isHost: true
        }}
      />
    );
  }

  // Single player draft logic (existing code)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(safeDraftState?.existingDraftId || null);
  // Use ref to track draftId immediately (before state update)
  const draftIdRef = useRef<string | null>(safeDraftState?.existingDraftId || null);
  // Track if initialization has been attempted to prevent duplicate runs
  const hasInitialized = useRef(false);
  
  // Update currentDraftId when existingDraftId changes (e.g., when restored from database)
  useEffect(() => {
    if (safeDraftState?.existingDraftId && !currentDraftId) {
      setCurrentDraftId(safeDraftState.existingDraftId);
      draftIdRef.current = safeDraftState.existingDraftId;
    }
  }, [safeDraftState?.existingDraftId, currentDraftId]);
  
  // Sync ref with state
  useEffect(() => {
    draftIdRef.current = currentDraftId;
  }, [currentDraftId]);

  // Persist draftId to localStorage whenever it changes
  useEffect(() => {
    if (currentDraftId) {
      const storageKey = `draft_${safeDraftState.theme}_${safeDraftState.option}_${JSON.stringify(safeDraftState.participants)}_${JSON.stringify(safeDraftState.categories)}`;
      localStorage.setItem(storageKey, currentDraftId);
    }
  }, [currentDraftId, safeDraftState.theme, safeDraftState.option, safeDraftState.participants, safeDraftState.categories]);
  
  const { autoSaveDraft, findExistingDraft, getDraftWithPicks } = useDraftOperations();

  // Normalize participants to Participant[] format
  const normalizedParticipants = useMemo(() => normalizeParticipants(safeDraftState.participants), [safeDraftState.participants]);

  // Compute the draft pick order ONCE and keep it stable across re-renders.
  // If the draft already has an ID it exists in the database — use the order
  // stored there (which was the original shuffled order from creation).
  // Only shuffle for genuinely brand-new drafts that have no ID yet.
  const effectiveParticipantsRef = useRef<Participant[] | null>(null);
  if (effectiveParticipantsRef.current === null && normalizedParticipants.length > 0) {
    if (safeDraftState?.existingDraftId) {
      // Resuming an existing draft — use the DB order as-is
      effectiveParticipantsRef.current = normalizedParticipants;
    } else {
      // Brand-new draft — shuffle once so pick order is random
      effectiveParticipantsRef.current = [...normalizedParticipants].sort(() => Math.random() - 0.5);
    }
  }
  const effectiveParticipants = effectiveParticipantsRef.current ?? normalizedParticipants;

  const {
    picks,
    currentPlayer,
    isComplete,
    randomizedPlayers,
    addPick,
    loadExistingPicks
  } = useDraftGame(effectiveParticipants, safeDraftState.categories);

  const { pickMovie: aiPickMovie, loading: aiPicking } = useAIPick();
  const [isAITurn, setIsAITurn] = useState(false);
  // Prevent infinite retry when AI returns null (e.g. no movies at all)
  const aiPickFailedForPickCountRef = useRef<number | null>(null);
  // Per-AI shuffled category order so AI doesn't always pick in left-to-right category order
  const aiCategoryOrderByPlayerIdRef = useRef<Map<number, string[]>>(new Map());
  
  // State to track enriched picks (with scoring data)
  const [enrichedPicks, setEnrichedPicks] = useState<any[] | null>(null);
  const [enriching, setEnriching] = useState(false);
  
  // Check localStorage for existing draftId on mount
  const hasCheckedLocalStorage = useRef(false);
  useEffect(() => {
    if (skipResumeSameSetup) return;
    if (!currentDraftId && !hasInitialized.current && !hasCheckedLocalStorage.current) {
      hasCheckedLocalStorage.current = true;
      const storageKey = `draft_${safeDraftState.theme}_${safeDraftState.option}_${JSON.stringify(safeDraftState.participants)}_${JSON.stringify(safeDraftState.categories)}`;
      const storedDraftId = localStorage.getItem(storageKey);
      if (storedDraftId) {
        // Navigate to URL with stored draftId instead of loading here
        navigate(`/draft/${storedDraftId}`, { replace: true });
        return;
      }
    }
  }, [currentDraftId, safeDraftState, navigate, skipResumeSameSetup]);

  // Create draft immediately on mount if it doesn't exist
  // This applies to ALL local drafts: spec-draft, year, people, etc.
  // Works for both authenticated users and guest sessions
  useEffect(() => {
    const initializeDraft = async () => {
      // Skip if we already have a draftId, if we're loading existing picks, or if we've already initialized
      if (currentDraftId || existingPicks?.length || hasInitialized.current) return;
      
      hasInitialized.current = true;
      
      try {
        // Optionally skip resume so identical setup creates a new draft row
        const existingDraftId = skipResumeSameSetup
          ? null
          : await findExistingDraft({
              theme: safeDraftState.theme,
              option: safeDraftState.option,
              participants: normalizedParticipants,
              categories: safeDraftState.categories,
            });

        if (existingDraftId) {
          console.log('Found existing draft with ID:', existingDraftId);
          setCurrentDraftId(existingDraftId);
          draftIdRef.current = existingDraftId;
          
          // Navigate to URL with draftId
          navigate(`/draft/${existingDraftId}`, { replace: true });
          
          // Load picks for the existing draft
          try {
            const { draft, picks } = await getDraftWithPicks(existingDraftId);
            if (picks && picks.length > 0) {
              loadExistingPicks(picks, safeDraftState.participants);
            }
          } catch (error) {
            console.error('Error loading existing picks:', error);
          }
          return;
        }

        // No existing draft found, create a new one — save the shuffled order
        const draftId = await autoSaveDraft({
          theme: safeDraftState.theme, // Can be 'spec-draft', 'year', 'people', etc.
          option: safeDraftState.option,
          participants: effectiveParticipants,
          categories: safeDraftState.categories,
          picks: [], // Empty picks initially
          isComplete: false // Always start as incomplete - completion will be saved separately
        }, undefined); // No existing draftId
        
        if (draftId) {
          setCurrentDraftId(draftId);
          draftIdRef.current = draftId;
          console.log('Draft initialized with ID:', draftId, 'Theme:', safeDraftState.theme);
          
          // Navigate to URL with draftId
          navigate(`/draft/${draftId}`, { replace: true });
        }
      } catch (error) {
        console.error('Failed to initialize draft:', error);
        // Generate a local draftId as fallback so the draft can still work
        const localDraftId = generateLocalDraftId();
        setCurrentDraftId(localDraftId);
        draftIdRef.current = localDraftId;
        console.log('Generated local draftId as fallback:', localDraftId);
        // Don't block user - they can still make picks or view completion
        // The draft will be created on first pick attempt
        // For guest sessions, RLS errors are expected but draft should still be created
      }
    };
    
    initializeDraft();
  }, [currentDraftId, existingPicks, safeDraftState, skipResumeSameSetup, autoSaveDraft, findExistingDraft, getDraftWithPicks, loadExistingPicks, navigate]);

  // Auto-save function (defined early so it can be used in useEffect hooks)
  const performAutoSave = useCallback(async (updatedPicks: any[], isComplete: boolean) => {
    // Ensure we have a draftId (either from DB or local)
    let draftId = currentDraftId || draftIdRef.current;

    try {
      const savedDraftId = await autoSaveDraft({
        theme: safeDraftState.theme,
        option: safeDraftState.option,
        participants: effectiveParticipants,
        categories: safeDraftState.categories,
        picks: updatedPicks,
        isComplete
      }, draftId || undefined);

      // Always update currentDraftId if we got one back (even if it's the same)
      if (savedDraftId) {
        draftId = savedDraftId;
        setCurrentDraftId(savedDraftId);
        draftIdRef.current = savedDraftId;
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const isDuplicateKey = err?.code === '23505' || err?.message?.includes('unique_movie_per_draft');

      if (!isDuplicateKey) console.error('Auto-save failed:', error);

      // If we don't have a draftId yet, generate a local one
      if (!draftId) {
        draftId = generateLocalDraftId();
        setCurrentDraftId(draftId);
        draftIdRef.current = draftId;
        console.log('Generated local draftId:', draftId);
      }

      // Duplicate key (23505): server already has this state; skip toast and still save locally
      if (!isDuplicateKey) {
        // Check if this is an RLS error
        const isRLSError = err?.code === '42501' ||
          err?.message?.includes('row-level security policy') ||
          (typeof error === 'object' && JSON.stringify(error).includes('42501'));

        if (isRLSError) {
          // For RLS errors, try to create a new draft if we don't have a draftId
          if (!currentDraftId) {
            try {
              const newDraftId = await autoSaveDraft({
                theme: safeDraftState.theme,
                option: safeDraftState.option,
                participants: effectiveParticipants,
                categories: safeDraftState.categories,
                picks: updatedPicks,
                isComplete: false
              }, undefined);

              if (newDraftId) {
                setCurrentDraftId(newDraftId);
                draftIdRef.current = newDraftId;
                draftId = newDraftId;
              }
            } catch (createError) {
              console.error('Failed to create draft after RLS error:', createError);
            }
          }
        } else {
          // For other errors, show toast (but still save locally)
          toast({
            title: "Auto-save failed",
            description: "Your draft couldn't be saved to the server, but it's been saved locally.",
            variant: "destructive"
          });
        }
      }
    }
    
    // Also save to localStorage as backup
    if (draftId) {
      try {
        const localDraft = {
          id: draftId,
          theme: safeDraftState.theme,
          option: safeDraftState.option,
          participants: effectiveParticipants,
          categories: safeDraftState.categories,
          picks: updatedPicks,
          isComplete,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(`local_draft_${draftId}`, JSON.stringify(localDraft));
        console.log('Draft saved locally:', draftId);
      } catch (error) {
        console.error('Failed to save draft locally:', error);
      }
    }
  }, [currentDraftId, safeDraftState, effectiveParticipants, autoSaveDraft, toast]);

  // Load existing picks when component mounts
  useEffect(() => {
    if (existingPicks) {
      loadExistingPicks(existingPicks, effectiveParticipants);
    }
  }, [existingPicks, effectiveParticipants, loadExistingPicks]);

  // Detect AI turn and handle auto-pick
  useEffect(() => {
    if (isComplete || !currentPlayer) {
      setIsAITurn(false);
      return;
    }
    
    const playerIsAI = currentPlayer.isAI === true;
    setIsAITurn(playerIsAI);
    // Clear failure ref when a pick was added (so next AI turn isn't skipped)
    if (aiPickFailedForPickCountRef.current !== null && picks.length > aiPickFailedForPickCountRef.current) {
      aiPickFailedForPickCountRef.current = null;
    }
    // Don't retry forever if AI already returned null for this turn
    if (playerIsAI && aiPickFailedForPickCountRef.current === picks.length) {
      return;
    }

    if (playerIsAI && !aiPicking) {
      // AI's turn - make pick after short delay
      const makeAIPick = async () => {
        // Wait 1-2 seconds to simulate "thinking"
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (!currentPlayer || !currentPlayer.isAI) return; // Double-check it's still AI's turn
        
        // Determine current category: for AI, use a randomized order per player; otherwise use round order
        const picksPerCategory = normalizedParticipants.length;
        const defaultRound = Math.floor(picks.length / picksPerCategory);
        const defaultCategory = safeDraftState.categories[defaultRound] || safeDraftState.categories[0];
        let currentCategory: string;
        const aiPicksSoFar = picks.filter(p => p.playerId === currentPlayer.id).length;
        let order = aiCategoryOrderByPlayerIdRef.current.get(currentPlayer.id);
        if (!order && safeDraftState.categories.length > 0) {
          order = [...safeDraftState.categories].sort(() => Math.random() - 0.5);
          aiCategoryOrderByPlayerIdRef.current.set(currentPlayer.id, order);
        }
        currentCategory = (order && order[aiPicksSoFar]) ? order[aiPicksSoFar] : defaultCategory;

        const alreadyPickedMovieIds = picks.map(p => p.movie.id);
        
        const selectedMovie = await aiPickMovie({
          draftTheme: safeDraftState.theme,
          draftOption: safeDraftState.option,
          currentCategory: currentCategory,
          alreadyPickedMovieIds: alreadyPickedMovieIds,
          allCategories: safeDraftState.categories,
        });
        
        if (selectedMovie) {
          // Automatically add the AI's pick
          const aiPick = {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            movie: selectedMovie,
            category: currentCategory
          };
          
          const updatedPicks = addPick(aiPick);
          const newIsComplete = updatedPicks.length >= normalizedParticipants.length * safeDraftState.categories.length;
          
          // Auto-save after AI pick
          await performAutoSave(updatedPicks, newIsComplete);
          
          if (newIsComplete) {
            toast({
              title: "Draft Complete!",
              description: "Your draft has been automatically saved.",
            });
          }
        } else {
          aiPickFailedForPickCountRef.current = picks.length;
          toast({
            title: "AI Pick Failed",
            description: "The AI couldn't find a suitable movie to pick.",
            variant: "destructive",
          });
        }
      };
      
      makeAIPick();
    } else if (!playerIsAI) {
      setIsAITurn(false);
    }
  }, [currentPlayer, picks.length, isComplete, aiPicking, normalizedParticipants, safeDraftState, aiPickMovie, addPick, performAutoSave, toast]);
  
  // Save draft when it completes. Skip if isComplete with 0 picks (guards against
  // useDraftGame race where draftOrder is temporarily [] and isComplete was true).
  useEffect(() => {
    const saveCompletion = async () => {
      if (!isComplete) return;
      if (picks.length === 0) return;
      
      // If we don't have a draftId yet, wait a bit for initialization to complete
      let draftId = currentDraftId || draftIdRef.current;
      if (!draftId) {
        // Wait up to 2 seconds for initialization
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          draftId = currentDraftId || draftIdRef.current;
          if (draftId) break;
        }
      }
      
      if (draftId) {
        try {
          await autoSaveDraft({
            theme: safeDraftState.theme,
            option: safeDraftState.option,
            participants: normalizedParticipants,
            categories: safeDraftState.categories,
            picks: picks,
            isComplete: true
          }, draftId);
          console.log('Draft completion saved with ID:', draftId);
        } catch (error) {
          console.error('Failed to save draft completion:', error);
        }
      } else {
        console.warn('Draft completed but no draftId available after waiting');
      }
    };
    
    saveCompletion();
  }, [isComplete, currentDraftId, picks, safeDraftState, autoSaveDraft]);

  // Enrich picks when draft completes
  useEffect(() => {
    if (isComplete && picks.length > 0 && !enrichedPicks && !enriching) {
      enrichPicksForFinalScores(picks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // Get the base category for initial movie loading
  const getBaseCategory = () => {
    if (safeDraftState?.theme === 'spec-draft') {
      return 'spec-draft';
    } else if (safeDraftState?.theme === 'year') {
      return 'year';
    } else if (safeDraftState?.theme === 'people') {
      return 'person';
    }
    return 'popular';
  };

  const baseCategory = getBaseCategory();
  
  // For theme-based drafts, pass the theme option (year, person name, or spec draft ID) as the constraint
  // This will fetch ALL movies for that year/person/spec draft
  const themeConstraint = safeDraftState?.theme === 'year' || safeDraftState?.theme === 'people' || safeDraftState?.theme === 'spec-draft'
    ? safeDraftState.option 
    : '';

  const actorNameForSpec =
    safeDraftState?.theme === 'people' ? getCleanActorName(safeDraftState.option || '') : null;
  const { specCategories } = useActorSpecCategories(actorNameForSpec);

  const interactiveBoardModel = useMemo(
    () =>
      buildInteractiveBoardModelFromLocal(
        safeDraftState.categories,
        randomizedPlayers,
        picks.map((p) => ({
          playerId: p.playerId,
          playerName: p.playerName,
          movie: {
            id: p.movie.id,
            title: p.movie.title,
            year: p.movie.year,
            poster_path: p.movie.poster_path ?? p.movie.posterPath ?? null,
          },
          category: p.category,
        }))
      ),
    [safeDraftState.categories, randomizedPlayers, picks]
  );

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
      if (!currentPlayer || isAITurn) return;

      if (!options?.houseOverride) {
        const eligible = getEligibleCategories(
          movie,
          safeDraftState.categories,
          safeDraftState.theme,
          safeDraftState.option,
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
          safeDraftState.theme === 'year' &&
          safeDraftState.option &&
          movieYear !== parseInt(safeDraftState.option, 10)
        ) {
          toast({
            title: 'Invalid Category',
            description: `${movie.title} (${movieYear}) is not from ${safeDraftState.option}.`,
            variant: 'destructive',
          });
          return;
        }
      }

      const isDuplicate = picks.some((pick: { movie: { id: number } }) => pick.movie.id === movie.id);
      if (isDuplicate) {
        toast({
          title: 'Movie Already Drafted',
          description: `${movie.title} has already been selected by another player.`,
          variant: 'destructive',
        });
        return;
      }

      const newPick = {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        movie,
        category,
      };

      const updatedPicks = addPick(newPick);
      const newIsComplete =
        picks.length + 1 >= normalizedParticipants.length * safeDraftState.categories.length;

      await performAutoSave(updatedPicks, newIsComplete);

      if (newIsComplete) {
        toast({
          title: 'Draft Complete!',
          description: 'Your draft has been automatically saved.',
        });
      }
    },
    [
      currentPlayer,
      isAITurn,
      safeDraftState,
      specCategories,
      picks,
      addPick,
      normalizedParticipants.length,
      performAutoSave,
      toast,
    ]
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
    isMyTurn: Boolean(currentPlayer && !isAITurn && !isComplete),
    currentPlayerId: currentPlayer?.id ?? 1,
    picks: boardPicksForPicker,
    onSubmit: handlePickSubmit,
  });

  const { movies, loading: moviesLoading } = useMovies(baseCategory, themeConstraint, pickerState.searchQuery);

  const railParticipants: BoardRailParticipant[] = useMemo(
    () =>
      randomizedPlayers.map((player) => ({
        id: String(player.id),
        name: player.name,
        isCurrentTurn: currentPlayer?.id === player.id,
        showOnlineStatus: false,
      })),
    [randomizedPlayers, currentPlayer]
  );

  // Save draft to localStorage as fallback
  const saveLocalDraft = (draftId: string, draftData: any, picks: any[]) => {
    try {
      // Format picks with pick_order for easier processing
      const formattedPicks = picks.map((pick, index) => ({
        ...pick,
        pick_order: index + 1
      }));
      
      const localDraft = {
        id: draftId,
        ...draftData,
        picks: formattedPicks,
        isLocal: true,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(`local_draft_${draftId}`, JSON.stringify(localDraft));
      console.log('Draft saved locally:', draftId);
    } catch (error) {
      console.error('Failed to save draft locally:', error);
    }
  };


  // Enrich picks with scoring data when draft completes
  const enrichPicksForFinalScores = async (picksToEnrich: any[]) => {
    if (enriching || enrichedPicks) return; // Already enriching or enriched
    
    setEnriching(true);
    
    try {
      const formattedPicks = picksToEnrich.map((pick, index) => ({
        id: pick.movie?.id?.toString() || `local_${index}`,
        draft_id: draftIdRef.current || currentDraftId || '',
        player_id: pick.playerId,
        player_name: pick.playerName,
        movie_id: pick.movie?.id || 0,
        movie_title: pick.movie?.title || '',
        movie_year: pick.movie?.year || null,
        movie_genre: pick.movie?.genre || 'Unknown',
        category: pick.category,
        pick_order: index + 1,
        poster_path: pick.movie?.posterPath || pick.movie?.poster_path || null
      }));
      
      // Enrich each pick that needs scoring data
      const enriched = [...formattedPicks];
      
      for (let i = 0; i < formattedPicks.length; i++) {
        const pick = formattedPicks[i];
        
        // Skip if already has scoring data
        if ((pick as any).calculated_score || (pick as any).rt_critics_score) {
          continue;
        }
        
        try {
          const { data, error } = await supabase.functions.invoke('enrich-movie-data', {
            body: {
              movieId: pick.movie_id,
              movieTitle: pick.movie_title,
              movieYear: pick.movie_year
            }
          });
          
          if (!error && (data?.enrichmentData || data?.success)) {
            const enrichmentData = data.enrichmentData || data;
            const enrichedPick = enriched[i] as any;
            
            console.log(`Enriching ${pick.movie_title}:`, {
              enrichmentData,
              calculatedScore: enrichmentData.calculatedScore,
              rtCritics: enrichmentData.rtCriticsScore,
              imdb: enrichmentData.imdbRating
            });
            
            enrichedPick.rt_critics_score = enrichmentData.rtCriticsScore || enrichmentData.rt_critics_score || null;
            enrichedPick.metacritic_score = enrichmentData.metacriticScore || enrichmentData.metacritic_score || null;
            enrichedPick.imdb_rating = enrichmentData.imdbRating || enrichmentData.imdb_rating || null;
            enrichedPick.movie_budget = enrichmentData.budget || enrichmentData.movie_budget || null;
            enrichedPick.movie_revenue = enrichmentData.revenue || enrichmentData.movie_revenue || null;
            enrichedPick.oscar_status = enrichmentData.oscarStatus || enrichmentData.oscar_status || null;
            enrichedPick.poster_path = enrichmentData.posterPath || enrichmentData.poster_path || enrichedPick.poster_path || null;
            
            // Use calculatedScore from response, or calculate it ourselves if missing
            let calculatedScore = enrichmentData.calculatedScore || enrichmentData.calculated_score;
            
            if (!calculatedScore && (enrichedPick.rt_critics_score || enrichedPick.imdb_rating || enrichedPick.metacritic_score)) {
              // Calculate score manually if not provided using consensus scoring
              
              // Box Office - Hybrid ROI-based formula
              let boxOfficeScore = 0;
              let boxOfficeFlop = false;
              if (enrichedPick.movie_budget && enrichedPick.movie_revenue && enrichedPick.movie_budget > 0) {
                const profit = enrichedPick.movie_revenue - enrichedPick.movie_budget;
                if (profit <= 0) {
                  boxOfficeScore = 0; // Flops get 0; penalized below
                  boxOfficeFlop = true;
                } else {
                  const roiPercent = (profit / enrichedPick.movie_budget) * 100;
                  if (roiPercent <= 100) {
                    // Linear scaling: 0-100% ROI → 0-60 points (2x return = 60 points)
                    boxOfficeScore = 60 * (roiPercent / 100);
                  } else {
                    // Logarithmic scaling: >100% ROI → 60-100 points (diminishing returns)
                    boxOfficeScore = 60 + 40 * (1 - Math.exp(-(roiPercent - 100) / 200));
                  }
                }
              }
              
              // Convert scores to 0-100 scale
              const rtCriticsScore = enrichedPick.rt_critics_score || 0;
              const metacriticScore = enrichedPick.metacritic_score || 0;
              const imdbScore = enrichedPick.imdb_rating ? (enrichedPick.imdb_rating / 10) * 100 : 0;
              
              // Layer 1: Calculate Critics Score (Internal Consensus)
              let criticsRawAvg = 0;
              let criticsScore = 0;
              if (rtCriticsScore && metacriticScore) {
                criticsRawAvg = (rtCriticsScore + metacriticScore) / 2;
                const criticsInternalDiff = Math.abs(rtCriticsScore - metacriticScore);
                const criticsInternalModifier = Math.max(0, 1 - (criticsInternalDiff / 200));
                criticsScore = criticsRawAvg * criticsInternalModifier;
              } else if (rtCriticsScore) {
                criticsRawAvg = rtCriticsScore;
                criticsScore = rtCriticsScore;
              } else if (metacriticScore) {
                criticsRawAvg = metacriticScore;
                criticsScore = metacriticScore;
              }
              
              // Layer 2: Calculate Audience Score (IMDB only, no Letterboxd)
              let audienceRawAvg = 0;
              let audienceScore = 0;
              if (imdbScore) {
                audienceRawAvg = imdbScore;
                audienceScore = imdbScore;
              }
              
              // Layer 3: Calculate Final Critical Score (Cross-Category Consensus)
              let criticalScore = 0;
              if (criticsRawAvg > 0 && audienceRawAvg > 0) {
                // Use RAW averages for consensus calculation
                const criticsAudienceDiff = Math.abs(criticsRawAvg - audienceRawAvg);
                const consensusModifier = Math.max(0, 1 - (criticsAudienceDiff / 200));
                
                // Weighted average of penalized scores (50/50)
                const weightedAvg = (criticsScore * 0.5) + (audienceScore * 0.5);
                criticalScore = weightedAvg * consensusModifier;
              } else if (criticsScore > 0) {
                criticalScore = criticsScore;
              } else if (audienceScore > 0) {
                criticalScore = audienceScore;
              }
              
              // Fixed weights: 20% Box Office, 80% Critical Score
              let boxOfficeWeight = 0.20;
              let criticalWeight = 0.80;
              
              if (boxOfficeScore > 0 && criticalScore > 0) {
                // Both available: use fixed 20/80 split
                boxOfficeWeight = 0.20;
                criticalWeight = 0.80;
              } else if (boxOfficeScore > 0) {
                // Only Box Office available
                boxOfficeWeight = 1.0;
                criticalWeight = 0;
              } else if (criticalScore > 0) {
                // Only Critical Score available
                boxOfficeWeight = 0;
                criticalWeight = 1.0;
              }
              
              // Calculate final average with fixed weights
              let averageScore = 0;
              if (boxOfficeScore > 0 && criticalScore > 0) {
                averageScore = (boxOfficeScore * boxOfficeWeight) + (criticalScore * criticalWeight);
              } else if (boxOfficeScore > 0) {
                averageScore = boxOfficeScore;
              } else if (criticalScore > 0) {
                averageScore = criticalScore;
              }
              
              // Add Oscar bonus
              let oscarBonus = 0;
              if (enrichedPick.oscar_status === 'winner') {
                oscarBonus = 6;
              } else if (enrichedPick.oscar_status === 'nominee') {
                oscarBonus = 3;
              }
              
              calculatedScore =
                Math.round(
                  (averageScore + oscarBonus - (boxOfficeFlop ? BOX_OFFICE_FLOP_PENALTY : 0)) * 100
                ) / 100;
            }
            
            enrichedPick.calculated_score = calculatedScore || null;
            enrichedPick.scoring_data_complete = enrichmentData.scoringComplete !== undefined 
              ? enrichmentData.scoringComplete 
              : (enrichmentData.scoring_data_complete !== undefined ? enrichmentData.scoring_data_complete : false);
            
            console.log(`Enriched ${pick.movie_title} - calculated_score:`, enrichedPick.calculated_score);
          } else if (error) {
            console.error(`Error enriching ${pick.movie_title}:`, error);
          }
        } catch (err) {
          console.error(`Error enriching ${pick.movie_title}:`, err);
        }
        
        // Small delay to avoid rate limiting
        if (i < formattedPicks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setEnrichedPicks(enriched);
      console.log('Picks enriched for final scores:', enriched);
    } catch (error) {
      console.error('Error enriching picks:', error);
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <InteractiveDraftBoard
        players={interactiveBoardModel.boardPlayers}
        categories={interactiveBoardModel.boardCategories}
        picks={interactiveBoardModel.boardPicks}
        theme={safeDraftState.theme}
        draftOption={safeDraftState.option}
        currentPlayer={currentPlayer ?? undefined}
        railParticipants={railParticipants}
        isMyTurn={Boolean(currentPlayer && !isAITurn && !isComplete)}
        isAiThinking={isAITurn}
        aiThinkingName={currentPlayer?.name}
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

      {isComplete && (
        (() => {
          // Use ref first (most up-to-date), then state, then safeDraftState
          let finalDraftId = draftIdRef.current || currentDraftId || safeDraftState?.existingDraftId;
          
          // If still no draftId and we have 0 picks (draft completed immediately), show loading state
          // The initialization is likely still in progress
          if (!finalDraftId && picks.length === 0) {
            // This is a render, so we can't await, but we can show a loading state
            // The completion save effect will handle creating/updating the draft
            return (
              <div className="p-6 rounded-lg">
                <div style={{ color: 'var(--Text-Primary, #FCFFFF)' }}>
                  <p>Initializing draft...</p>
                </div>
              </div>
            );
          }
          
          // If still no draftId, try to find it in localStorage from recent saves
          if (!finalDraftId && picks.length > 0) {
            try {
              // Look for the most recent local draft that matches this draft
              const allKeys = Object.keys(localStorage);
              const localDraftKeys = allKeys.filter(key => key.startsWith('local_draft_'));
              
              // Find the most recent draft that matches our theme/option
              for (const key of localDraftKeys.reverse()) {
                const draftJson = localStorage.getItem(key);
                if (draftJson) {
                  const localDraft = JSON.parse(draftJson);
                  if (localDraft.theme === safeDraftState.theme && 
                      localDraft.option === safeDraftState.option &&
                      localDraft.participants?.length === normalizedParticipants.length) {
                    finalDraftId = localDraft.id;
                    setCurrentDraftId(finalDraftId || null);
                    draftIdRef.current = finalDraftId || null;
                    console.log('Found matching local draft:', finalDraftId);
                    break;
                  }
                }
              }
            } catch (error) {
              console.error('Error checking localStorage for draftId:', error);
            }
          }
          
          // Convert picks to DraftPick format
          const baseFormattedPicks = picks.map((pick, index) => ({
            id: pick.movie?.id?.toString() || `local_${index}`,
            draft_id: finalDraftId || '',
            player_id: pick.playerId,
            player_name: pick.playerName,
            movie_id: pick.movie?.id || 0,
            movie_title: pick.movie?.title || '',
            movie_year: pick.movie?.year || null,
            movie_genre: pick.movie?.genre || 'Unknown',
            category: pick.category,
            pick_order: index + 1,
            poster_path: pick.movie?.posterPath || pick.movie?.poster_path || null
          }));
          
          // Use enriched picks if available
          const formattedPicks = enrichedPicks || baseFormattedPicks;
          
          if (!finalDraftId) {
            console.error('Draft completed but no draftId available', {
              draftIdRef: draftIdRef.current,
              currentDraftId,
              existingDraftId: safeDraftState?.existingDraftId,
              theme: safeDraftState?.theme,
              picksCount: picks.length,
              draftState: safeDraftState
            });
            
            return (
              <div className="p-6 rounded-lg">
                <div style={{ color: 'var(--Text-Primary, #FCFFFF)' }}>
                  <p>Draft completed, but unable to save. Please try refreshing the page.</p>
                </div>
              </div>
            );
          }
          
          console.log('DraftComplete rendering with:', {
            draftId: finalDraftId,
            picksCount: formattedPicks.length,
            hasEnrichedPicks: !!enrichedPicks,
            isEnriching: enriching,
            firstPick: formattedPicks[0],
            firstPickScore: (formattedPicks[0] as any)?.calculated_score,
            firstPickHasData: !!(formattedPicks[0] as any)?.rt_critics_score || !!(formattedPicks[0] as any)?.imdb_rating
          });
          
          return (
            <DraftComplete 
              draftId={finalDraftId}
              draftData={{
                id: finalDraftId,
                title: safeDraftState.option,
                theme: safeDraftState.theme,
                option: safeDraftState.option,
                participants: safeDraftState.participants,
                categories: safeDraftState.categories,
                is_complete: true
              }}
              picks={formattedPicks}
              isEnriching={enriching}
            />
          );
        })()
      )}
    </div>
  );
};

export default DraftInterface;
