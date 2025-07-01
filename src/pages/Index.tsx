import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMovies } from '@/hooks/useMovies';
import DraftHeader from '@/components/DraftHeader';
import DraftBoard from '@/components/DraftBoard';
import MovieSearch from '@/components/MovieSearch';
import CategorySelection from '@/components/CategorySelection';
import PickConfirmation from '@/components/PickConfirmation';
import DraftComplete from '@/components/DraftComplete';

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
  const draftState = location.state as DraftState;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  
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
  
  // For the draft page, we always search for movies filtered by the theme
  const getSearchParams = () => {
    if (!searchQuery.trim()) {
      return { category: '', query: '' }; // Don't search if no user input
    }

    if (draftState?.theme === 'year') {
      return {
        category: 'year',
        query: draftState.option // Filter movies by the selected year
      };
    } else if (draftState?.theme === 'people') {
      return {
        category: 'person',
        query: draftState.option // Filter movies by the selected person
      };
    }
    
    return { category: '', query: '' };
  };

  const searchParams = getSearchParams();
  const { movies, loading } = useMovies(searchParams.category, searchParams.query);

  useEffect(() => {
    if (!draftState) {
      navigate('/');
    }
  }, [draftState, navigate]);

  if (!draftState) return null;

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
              movies={movies}
              loading={loading}
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
