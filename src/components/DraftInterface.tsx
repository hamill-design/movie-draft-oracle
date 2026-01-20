
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraftGame } from '@/hooks/useDraftGame';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

import DraftBoard from './DraftBoard';
import MovieSearch from './MovieSearch';
import EnhancedCategorySelection from '@/components/EnhancedCategorySelection';
import PickConfirmation from './PickConfirmation';
import DraftComplete from './DraftComplete';
import { MultiplayerDraftInterface } from './MultiplayerDraftInterface';

interface DraftInterfaceProps {
  draftState: {
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    existingDraftId?: string;
    isMultiplayer?: boolean;
    inviteCode?: string;
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
  
  // Show success message for multiplayer draft creation
  useEffect(() => {
    if (draftState.isMultiplayer && !draftState.existingDraftId && !hasShownToast.current) {
      hasShownToast.current = true;
      toast({
        title: "Multiplayer Draft Created!",
        description: `Email invitations have been sent to ${draftState.participants.length} participant(s)`,
      });
    }
  }, [draftState.isMultiplayer, draftState.existingDraftId, draftState.participants.length, toast]);
  
  // If this is a multiplayer draft, use the multiplayer interface
  if (draftState.isMultiplayer) {
    return (
      <MultiplayerDraftInterface 
        draftId={draftState.existingDraftId}
        initialData={draftState.existingDraftId ? undefined : {
          theme: draftState.theme,
          option: draftState.option,
          participants: draftState.participants,
          categories: draftState.categories,
          isHost: true
        }}
      />
    );
  }

  // Single player draft logic (existing code)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [checkingOscarStatus, setCheckingOscarStatus] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftState?.existingDraftId || null);
  // Use ref to track draftId immediately (before state update)
  const draftIdRef = useRef<string | null>(draftState?.existingDraftId || null);
  // Track if initialization has been attempted to prevent duplicate runs
  const hasInitialized = useRef(false);
  
  // Update currentDraftId when existingDraftId changes (e.g., when restored from database)
  useEffect(() => {
    if (draftState?.existingDraftId && !currentDraftId) {
      setCurrentDraftId(draftState.existingDraftId);
      draftIdRef.current = draftState.existingDraftId;
    }
  }, [draftState?.existingDraftId, currentDraftId]);
  
  // Sync ref with state
  useEffect(() => {
    draftIdRef.current = currentDraftId;
  }, [currentDraftId]);

  // Persist draftId to localStorage whenever it changes
  useEffect(() => {
    if (currentDraftId) {
      const storageKey = `draft_${draftState.theme}_${draftState.option}_${JSON.stringify(draftState.participants)}_${JSON.stringify(draftState.categories)}`;
      localStorage.setItem(storageKey, currentDraftId);
    }
  }, [currentDraftId, draftState.theme, draftState.option, draftState.participants, draftState.categories]);
  
  const { autoSaveDraft, findExistingDraft, getDraftWithPicks } = useDraftOperations();
  
  const {
    picks,
    currentPlayer,
    isComplete,
    randomizedPlayers,
    addPick,
    loadExistingPicks
  } = useDraftGame(draftState.participants, draftState.categories);
  
  // State to track enriched picks (with scoring data)
  const [enrichedPicks, setEnrichedPicks] = useState<any[] | null>(null);
  const [enriching, setEnriching] = useState(false);
  
  // Check localStorage for existing draftId on mount
  const hasCheckedLocalStorage = useRef(false);
  useEffect(() => {
    if (!currentDraftId && !hasInitialized.current && !hasCheckedLocalStorage.current) {
      hasCheckedLocalStorage.current = true;
      const storageKey = `draft_${draftState.theme}_${draftState.option}_${JSON.stringify(draftState.participants)}_${JSON.stringify(draftState.categories)}`;
      const storedDraftId = localStorage.getItem(storageKey);
      if (storedDraftId) {
        // Navigate to URL with stored draftId instead of loading here
        navigate(`/draft/${storedDraftId}`, { replace: true });
        return;
      }
    }
  }, [currentDraftId, draftState, navigate]);

  // Create draft immediately on mount if it doesn't exist
  // This applies to ALL local drafts: spec-draft, year, people, etc.
  // Works for both authenticated users and guest sessions
  useEffect(() => {
    const initializeDraft = async () => {
      // Skip if we already have a draftId, if we're loading existing picks, or if we've already initialized
      if (currentDraftId || existingPicks?.length || hasInitialized.current) return;
      
      hasInitialized.current = true;
      
      try {
        // First, check if a draft already exists with these parameters
        const existingDraftId = await findExistingDraft({
          theme: draftState.theme,
          option: draftState.option,
          participants: draftState.participants,
          categories: draftState.categories,
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
              loadExistingPicks(picks, draftState.participants);
            }
          } catch (error) {
            console.error('Error loading existing picks:', error);
          }
          return;
        }

        // No existing draft found, create a new one
        const draftId = await autoSaveDraft({
          theme: draftState.theme, // Can be 'spec-draft', 'year', 'people', etc.
          option: draftState.option,
          participants: draftState.participants,
          categories: draftState.categories,
          picks: [], // Empty picks initially
          isComplete: false // Always start as incomplete - completion will be saved separately
        }, undefined); // No existing draftId
        
        if (draftId) {
          setCurrentDraftId(draftId);
          draftIdRef.current = draftId;
          console.log('Draft initialized with ID:', draftId, 'Theme:', draftState.theme);
          
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
  }, [currentDraftId, existingPicks, draftState, autoSaveDraft, findExistingDraft, getDraftWithPicks, loadExistingPicks, navigate]);

  // Load existing picks when component mounts
  useEffect(() => {
    if (existingPicks) {
      loadExistingPicks(existingPicks, draftState.participants);
    }
  }, [existingPicks, draftState.participants, loadExistingPicks]);
  
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
            theme: draftState.theme,
            option: draftState.option,
            participants: draftState.participants,
            categories: draftState.categories,
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
  }, [isComplete, currentDraftId, picks, draftState, autoSaveDraft]);

  // Enrich picks when draft completes
  useEffect(() => {
    if (isComplete && picks.length > 0 && !enrichedPicks && !enriching) {
      enrichPicksForFinalScores(picks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // Get the base category for initial movie loading
  const getBaseCategory = () => {
    if (draftState?.theme === 'spec-draft') {
      return 'spec-draft';
    } else if (draftState?.theme === 'year') {
      return 'year';
    } else if (draftState?.theme === 'people') {
      return 'person';
    }
    return 'popular';
  };

  const baseCategory = getBaseCategory();
  
  // For theme-based drafts, pass the theme option (year, person name, or spec draft ID) as the constraint
  // This will fetch ALL movies for that year/person/spec draft
  const themeConstraint = draftState?.theme === 'year' || draftState?.theme === 'people' || draftState?.theme === 'spec-draft'
    ? draftState.option 
    : '';
  
  // Use movies hook - pass the theme constraint and user's search query
  // For year/person, only fetch when user types (searchQuery state)
  const { movies, loading: moviesLoading } = useMovies(baseCategory, themeConstraint, searchQuery);

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

  // Auto-save function
  const performAutoSave = async (updatedPicks: any[], isComplete: boolean) => {
    // Ensure we have a draftId (either from DB or local)
    let draftId = currentDraftId;
    
    try {
      const savedDraftId = await autoSaveDraft({
        theme: draftState.theme,
        option: draftState.option,
        participants: draftState.participants,
        categories: draftState.categories,
        picks: updatedPicks,
        isComplete
      }, currentDraftId || undefined);

      // Always update currentDraftId if we got one back (even if it's the same)
      if (savedDraftId) {
        draftId = savedDraftId;
        setCurrentDraftId(savedDraftId);
        draftIdRef.current = savedDraftId;
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      
      // If we don't have a draftId yet, generate a local one
      if (!draftId) {
        draftId = generateLocalDraftId();
        setCurrentDraftId(draftId);
        draftIdRef.current = draftId;
        console.log('Generated local draftId:', draftId);
      }
      
      // Check if this is an RLS error
      const isRLSError = (error as any)?.code === '42501' || 
                        (error as any)?.message?.includes('row-level security policy') ||
                        (typeof error === 'object' && JSON.stringify(error).includes('42501'));
      
      if (isRLSError) {
        // For RLS errors, try to create a new draft if we don't have a draftId
        if (!currentDraftId) {
          try {
            const newDraftId = await autoSaveDraft({
              theme: draftState.theme,
              option: draftState.option,
              participants: draftState.participants,
              categories: draftState.categories,
              picks: updatedPicks,
              isComplete
            }, undefined);
            
            if (newDraftId) {
              draftId = newDraftId;
              setCurrentDraftId(newDraftId);
              draftIdRef.current = newDraftId;
            }
          } catch (retryError) {
            console.error('Retry after RLS error also failed:', retryError);
          }
        }
      } else {
        // For non-RLS errors, show toast (but still save locally)
        toast({
          title: "Auto-save failed",
          description: "Your draft couldn't be saved to the server, but it's been saved locally.",
          variant: "destructive"
        });
      }
    }
    
    // Always save to localStorage as a fallback, especially if database save failed
    if (draftId) {
      saveLocalDraft(draftId, {
        theme: draftState.theme,
        option: draftState.option,
        participants: draftState.participants,
        categories: draftState.categories,
        isComplete
      }, updatedPicks);
    }
  };

  const handleMovieSelect = async (movie: any) => {
    setSelectedMovie(movie);
    setSelectedCategory('');
    
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
    if (!selectedMovie || !selectedCategory || !currentPlayer) return;

    // Check if this movie has already been drafted
    const isDuplicate = picks.some((pick: any) => pick.movie.id === selectedMovie.id);
    if (isDuplicate) {
      toast({
        title: "Movie Already Drafted",
        description: `${selectedMovie.title} has already been selected by another player.`,
        variant: "destructive",
      });
      return;
    }

    const newPick = {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      movie: selectedMovie,
      category: selectedCategory
    };

    const updatedPicks = addPick(newPick);
    const newIsComplete = picks.length + 1 >= draftState.participants.length * draftState.categories.length;

    setSelectedMovie(null);
    setSelectedCategory('');
    setSearchQuery('');

    // Auto-save after each pick
    await performAutoSave(updatedPicks, newIsComplete);

    if (newIsComplete) {
      toast({
        title: "Draft Complete!",
        description: "Your draft has been automatically saved.",
      });
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
              if (enrichedPick.movie_budget && enrichedPick.movie_revenue && enrichedPick.movie_budget > 0) {
                const profit = enrichedPick.movie_revenue - enrichedPick.movie_budget;
                if (profit <= 0) {
                  boxOfficeScore = 0; // Flops get 0
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
              
              calculatedScore = Math.round((averageScore + oscarBonus) * 100) / 100;
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
    <div className="space-y-6">
      <DraftBoard
        players={randomizedPlayers}
        categories={draftState.categories}
        picks={picks}
        theme={draftState.theme}
        draftOption={draftState.option}
        currentPlayer={currentPlayer}
      />

      {!isComplete && currentPlayer && (
        <>
          <MovieSearch
            theme={draftState.theme}
            option={draftState.option}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            movies={movies}
            loading={moviesLoading}
            selectedMovie={selectedMovie}
            onMovieSelect={handleMovieSelect}
            themeParameter={themeConstraint}
          />

          <EnhancedCategorySelection
            selectedMovie={selectedMovie}
            categories={draftState.categories}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            picks={picks}
            currentPlayerId={currentPlayer.id}
            theme={draftState.theme}
            option={draftState.option}
            checkingOscarStatus={checkingOscarStatus}
          />

          <PickConfirmation
            currentPlayerName={currentPlayer.name}
            selectedMovie={selectedMovie}
            selectedCategory={selectedCategory}
            onConfirm={confirmPick}
          />
        </>
      )}

      {isComplete && (
        (() => {
          // Use ref first (most up-to-date), then state, then draftState
          let finalDraftId = draftIdRef.current || currentDraftId || draftState?.existingDraftId;
          
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
                  if (localDraft.theme === draftState.theme && 
                      localDraft.option === draftState.option &&
                      localDraft.participants?.length === draftState.participants.length) {
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
              existingDraftId: draftState?.existingDraftId,
              theme: draftState?.theme,
              picksCount: picks.length,
              draftState
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
                title: draftState.option,
                theme: draftState.theme,
                option: draftState.option,
                participants: draftState.participants,
                categories: draftState.categories,
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
