
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMovies } from '@/hooks/useMovies';
import DraftHeader from '@/components/DraftHeader';
import DraftBoard from '@/components/DraftBoard';
import MovieSearch from '@/components/MovieSearch';
import CategorySelection from '@/components/CategorySelection';
import PickConfirmation from '@/components/PickConfirmation';
import DraftComplete from '@/components/DraftComplete';
import SaveDraftButton from '@/components/SaveDraftButton';
import { useAuth } from '@/contexts/AuthContext';

interface DraftState {
  theme: string;
  option: string;
  participants: string[];
  categories: string[];
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
  const draftState = location.state as DraftState;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  
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

  const handleMovieSelect = (movie: any) => {
    setSelectedMovie(movie);
    setSelectedCategory('');
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const confirmPick = () => {
    if (!selectedMovie || !selectedCategory || !currentPlayer) return;

    const newPick: Pick = {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      movie: selectedMovie,
      category: selectedCategory
    };

    setPicks(prev => [...prev, newPick]);
    setCurrentPickIndex(prev => prev + 1);
    setSelectedMovie(null);
    setSelectedCategory('');
    setSearchQuery('');
  };

  const isComplete = currentPickIndex >= draftOrder.length;

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
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

        {/* Save Draft Button */}
        <div className="flex justify-end mb-6">
          <SaveDraftButton
            draftData={{
              theme: draftState.theme,
              option: draftState.option,
              participants: draftState.participants,
              categories: draftState.categories,
              picks: picks,
              isComplete: isComplete
            }}
          />
        </div>

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
