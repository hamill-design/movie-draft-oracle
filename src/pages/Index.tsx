import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMovies } from '@/hooks/useMovies';
import DraftHeader from '@/components/DraftHeader';
import DraftBoard from '@/components/DraftBoard';
import MovieSearch from '@/components/MovieSearch';
import CategorySelection from '@/components/CategorySelection';
import PickConfirmation from '@/components/PickConfirmation';
import DraftComplete from '@/components/DraftComplete';
import { useAuth } from '@/contexts/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';
import { useToast } from '@/hooks/use-toast';

interface DraftState {
  theme: string;
  option: string;
  participants: string[];
  categories: string[];
  existingDraftId?: string;
}

interface Pick {
  playerId: number;
  playerName: string;
  movie: any;
  category: string;
}

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { autoSaveDraft, getDraftWithPicks } = useDrafts();
  const { toast } = useToast();
  const draftState = location.state as DraftState;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftState?.existingDraftId || null);
  const [loadingExistingDraft, setLoadingExistingDraft] = useState(false);
  
  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!draftState) {
      navigate('/');
    }
  }, [draftState, navigate]);

  // Load existing draft data if editing an existing draft
  useEffect(() => {
    const loadExistingDraft = async () => {
      if (!draftState?.existingDraftId || !user) return;

      setLoadingExistingDraft(true);
      try {
        console.log('Loading existing draft:', draftState.existingDraftId);
        const { draft, picks: existingPicks } = await getDraftWithPicks(draftState.existingDraftId);
        
        console.log('Draft loaded:', draft);
        console.log('Picks loaded:', existingPicks);
        
        if (existingPicks && existingPicks.length > 0) {
          // Convert database picks to our Pick format
          const convertedPicks: Pick[] = existingPicks.map((pick) => ({
            playerId: pick.player_id,
            playerName: pick.player_name,
            movie: {
              id: pick.movie_id,
              title: pick.movie_title,
              year: pick.movie_year,
              genre: pick.movie_genre
            },
            category: pick.category
          }));
          
          console.log('Converted picks:', convertedPicks);
          setPicks(convertedPicks);
          setCurrentPickIndex(convertedPicks.length);
        }
      } catch (error) {
        console.error('Error loading existing draft:', error);
        // Don't show error toast for network issues, just log and continue
        // The user can still use the draft interface normally
        console.log('Continuing with new draft due to loading error');
      } finally {
        setLoadingExistingDraft(false);
      }
    };

    if (draftState?.existingDraftId) {
      loadExistingDraft();
    }
  }, [draftState?.existingDraftId, user, getDraftWithPicks]);

  // Randomize player order and create snake draft order
  const randomizedPlayers = useMemo(() => {
    if (!draftState?.participants) return [];
    const shuffled = [...draftState.participants].sort(() => Math.random() - 0.5);
    return shuffled.map((name, index) => ({ id: index, name }));
  }, [draftState?.participants]);

  // Create snake draft order (1,2,3,4,4,3,2,1,1,2,3,4...)
  const draftOrder = useMemo(() => {
    if (!randomizedPlayers.length || !draftState?.categories) return [];
    
    const numPlayers = randomizedPlayers.length;
    const numCategories = draftState.categories.length;
    const order = [];
    
    for (let round = 0; round < numCategories; round++) {
      if (round % 2 === 0) {
        // Forward order
        for (let i = 0; i < numPlayers; i++) {
          order.push({ ...randomizedPlayers[i], round, pick: order.length + 1 });
        }
      } else {
        // Reverse order
        for (let i = numPlayers - 1; i >= 0; i--) {
          order.push({ ...randomizedPlayers[i], round, pick: order.length + 1 });
        }
      }
    }
    
    return order;
  }, [randomizedPlayers, draftState?.categories]);

  const currentPlayer = draftOrder[currentPickIndex];
  
  // Get search parameters based on theme and search query
  const getSearchParams = () => {
    // Don't search if no user input
    if (!searchQuery.trim()) {
      return { category: '', query: '' };
    }

    // For draft page, we want to search for movies filtered by the theme
    if (draftState?.theme === 'year') {
      // Search for movies from the specific year, with additional filtering by search query
      return {
        category: 'year',
        query: draftState.option // Use the selected year as the primary filter
      };
    } else if (draftState?.theme === 'people') {
      // Search for movies featuring the specific person, with additional filtering by search query
      return {
        category: 'person',
        query: draftState.option // Use the selected person as the primary filter
      };
    }
    
    return { category: '', query: '' };
  };

  const searchParams = getSearchParams();
  console.log('Draft search params:', searchParams, 'for query:', searchQuery);
  
  // Only search when we have valid search parameters
  const { movies, loading: moviesLoading } = useMovies(
    searchParams.category, 
    searchParams.query
  );

  // Filter movies based on the search query if we have results
  const filteredMovies = useMemo(() => {
    if (!searchQuery.trim() || !movies.length) return movies;
    
    return movies.filter(movie => 
      movie.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [movies, searchQuery]);

  // Auto-save function
  const performAutoSave = async (updatedPicks: Pick[], isComplete: boolean) => {
    if (!user || !draftState) return;

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

    const newPick: Pick = {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      movie: selectedMovie,
      category: selectedCategory
    };

    const updatedPicks = [...picks, newPick];
    const newPickIndex = currentPickIndex + 1;
    const isComplete = newPickIndex >= draftOrder.length;

    setPicks(updatedPicks);
    setCurrentPickIndex(newPickIndex);
    setSelectedMovie(null);
    setSelectedCategory('');
    setSearchQuery('');

    // Auto-save after each pick
    await performAutoSave(updatedPicks, isComplete);

    if (isComplete) {
      toast({
        title: "Draft Complete!",
        description: "Your draft has been automatically saved.",
      });
    }
  };

  const isComplete = currentPickIndex >= draftOrder.length;

  // Show loading state while checking auth or loading existing draft
  if (loading || loadingExistingDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">
          {loadingExistingDraft ? 'Loading draft...' : 'Loading...'}
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!user || !draftState) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        <DraftHeader
          draftOption={draftState.option}
          currentPlayer={currentPlayer}
          isComplete={isComplete}
        />

        <DraftBoard
          players={randomizedPlayers}
          categories={draftState.categories}
          picks={picks}
          theme={draftState.theme}
        />

        {!isComplete && currentPlayer && (
          <div className="space-y-6">
            <MovieSearch
              theme={draftState.theme}
              option={draftState.option}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              movies={filteredMovies}
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
          </div>
        )}

        {isComplete && <DraftComplete />}
      </div>
    </div>
  );
};

export default Index;
