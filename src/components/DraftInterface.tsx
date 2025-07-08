
import React, { useState, useEffect } from 'react';
import { useDraftGame } from '@/hooks/useDraftGame';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import DraftBoard from './DraftBoard';
import MovieSearch from './MovieSearch';
import CategorySelection from './CategorySelection';
import PickConfirmation from './PickConfirmation';
import DraftComplete from './DraftComplete';

interface DraftInterfaceProps {
  draftState: {
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    existingDraftId?: string;
  };
  existingPicks?: any[];
}

const DraftInterface = ({ draftState, existingPicks }: DraftInterfaceProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftState?.existingDraftId || null);
  
  const { toast } = useToast();
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

  // Get search parameters based on theme
  const getSearchParams = () => {
    if (draftState?.theme === 'year') {
      return {
        category: 'year',
        query: draftState.option
      };
    } else if (draftState?.theme === 'people') {
      return {
        category: 'person',
        query: draftState.option
      };
    }
    
    // Default to comprehensive search across all movies
    return { category: 'all', query: '' };
  };

  const searchParams = getSearchParams();
  const { movies, loading: moviesLoading } = useMovies(
    searchParams.category, 
    searchParams.query
  );

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

  // Debug logging
  console.log('Current player from useDraftGame:', currentPlayer);
  console.log('Randomized players:', randomizedPlayers);

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

      {isComplete && <DraftComplete />}
    </div>
  );
};

export default DraftInterface;
