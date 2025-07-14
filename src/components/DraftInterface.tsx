
import React, { useState, useEffect } from 'react';
import { useDraftGame } from '@/hooks/useDraftGame';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import DraftBoard from './DraftBoard';
import MovieSearch from './MovieSearch';
import CategorySelection from './CategorySelection';
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

const DraftInterface = ({ draftState, existingPicks }: DraftInterfaceProps) => {
  const { toast } = useToast();
  
  // If this is a multiplayer draft, use the multiplayer interface
  if (draftState.isMultiplayer) {
    // Show success message for multiplayer draft creation
    useEffect(() => {
      if (!draftState.existingDraftId) {
        toast({
          title: "Multiplayer Draft Created!",
          description: `Email invitations have been sent to ${draftState.participants.length} participant(s)`,
        });
      }
    }, []);

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
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftState?.existingDraftId || null);
  
  const { autoSaveDraft } = useDraftOperations();
  
  const {
    picks,
    currentPlayer,
    isComplete,
    randomizedPlayers,
    addPick,
    loadExistingPicks
  } = useDraftGame(draftState.participants, draftState.categories);

  // Load existing picks when component mounts
  useEffect(() => {
    if (existingPicks) {
      loadExistingPicks(existingPicks);
    }
  }, [existingPicks]);

  // Get the base category for initial movie loading
  const getBaseCategory = () => {
    if (draftState?.theme === 'year') {
      return 'year';
    } else if (draftState?.theme === 'people') {
      return 'person';
    }
    return 'popular';
  };

  const baseCategory = getBaseCategory();
  
  // For theme-based drafts, pass the theme option (year or person name) as the constraint
  // This will fetch ALL movies for that year/person
  const themeConstraint = draftState?.theme === 'year' || draftState?.theme === 'people' 
    ? draftState.option 
    : '';
  
  console.log('DraftInterface - Category:', baseCategory, 'Constraint:', themeConstraint);
  
  // Use movies hook - pass the theme constraint to get all movies for that theme
  const { movies, loading: moviesLoading } = useMovies(baseCategory, themeConstraint);

  console.log('DraftInterface - Movies loaded:', movies.length, 'Loading:', moviesLoading);

  // Auto-save function
  const performAutoSave = async (updatedPicks: any[], isComplete: boolean) => {
    try {
      const draftId = await autoSaveDraft({
        theme: draftState.theme,
        option: draftState.option,
        participants: draftState.participants,
        categories: draftState.categories,
        picks: updatedPicks,
        isComplete
      }, currentDraftId || undefined);

      if (!currentDraftId) {
        setCurrentDraftId(draftId);
      }

      console.log('Draft auto-saved successfully');
    } catch (error) {
      console.error('Auto-save failed:', error);
      toast({
        title: "Auto-save failed",
        description: "Your draft couldn't be saved automatically. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleMovieSelect = (movie: any) => {
    setSelectedMovie(movie);
    setSelectedCategory('');
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const confirmPick = async () => {
    if (!selectedMovie || !selectedCategory || !currentPlayer) return;

    // Check if this movie has already been drafted
    const isDuplicate = picks.some(pick => pick.movie.id === selectedMovie.id);
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

  return (
    <div className="space-y-6">
      <DraftBoard
        players={randomizedPlayers}
        categories={draftState.categories}
        picks={picks}
        theme={draftState.theme}
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

          <CategorySelection
            selectedMovie={selectedMovie}
            categories={draftState.categories}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            picks={picks}
            currentPlayerId={currentPlayer.id}
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
        <DraftComplete />
      )}
    </div>
  );
};

export default DraftInterface;
