
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, Film, User, Crown } from 'lucide-react';
import { useMovies } from '@/hooks/useMovies';

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
  
  // Use the correct search category based on theme
  const searchCategory = draftState?.theme === 'year' ? 'year' : 'person';
  const searchTerm = searchQuery || draftState?.option;
  
  const { movies, loading } = useMovies(searchCategory, searchTerm);

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
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Home
          </Button>
          <h1 className="text-3xl font-bold text-white">Movie Draft</h1>
        </div>

        {/* Draft Info */}
        <Card className="bg-gray-800 border-gray-600 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-6 text-center">
              <div>
                <p className="text-gray-300">Theme: <span className="text-yellow-400 font-bold">{draftState.option}</span></p>
              </div>
              {!isComplete && currentPlayer && (
                <div className="flex items-center gap-2">
                  <Crown className="text-yellow-400" size={20} />
                  <p className="text-white font-bold">
                    Current Pick: {currentPlayer.name} (#{currentPlayer.pick})
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Draft Table */}
        <Card className="bg-gray-800 border-gray-600 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Draft Board</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-300">Player</TableHead>
                    {draftState.categories.map((category) => (
                      <TableHead key={category} className="text-gray-300 text-center min-w-[150px]">
                        {category}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {randomizedPlayers.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell className="text-white font-medium">
                        <div className="flex items-center gap-2">
                          <User size={16} />
                          {player.name}
                        </div>
                      </TableCell>
                      {draftState.categories.map((category) => {
                        const pick = picks.find(p => p.playerId === player.id && p.category === category);
                        return (
                          <TableCell key={category} className="text-center">
                            {pick ? (
                              <div className="text-xs">
                                <div className="text-white font-medium truncate">{pick.movie.title}</div>
                                <div className="text-gray-400">
                                  {draftState.theme === 'year' ? pick.movie.year : pick.movie.genre}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-600">-</div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Drafting Interface */}
        {!isComplete && currentPlayer && (
          <div className="space-y-6">
            {/* Search */}
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Search className="text-yellow-400" size={24} />
                  Search {draftState.theme === 'year' ? 'Movies' : 'Movies/Shows'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder={`Search for ${draftState.theme === 'year' ? 'movies from ' + draftState.option : 'movies with ' + draftState.option}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                
                {searchTerm && (
                  <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                    {loading ? (
                      <div className="text-gray-400">Searching...</div>
                    ) : movies.length === 0 ? (
                      <div className="text-gray-400">No results found</div>
                    ) : (
                      movies.slice(0, 10).map((movie) => (
                        <div
                          key={movie.id}
                          onClick={() => handleMovieSelect(movie)}
                          className={`p-3 rounded cursor-pointer transition-colors ${
                            selectedMovie?.id === movie.id
                              ? 'bg-yellow-400 text-black'
                              : 'bg-gray-700 hover:bg-gray-600 text-white'
                          }`}
                        >
                          <div className="font-medium">{movie.title}</div>
                          <div className="text-sm opacity-75">
                            {draftState.theme === 'year' ? `${movie.year} • ${movie.genre}` : movie.genre}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Selection */}
            {selectedMovie && (
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white">
                    Select Category for "{selectedMovie.title}"
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {draftState.categories.map((category) => {
                      const isAlreadyPicked = picks.some(p => p.playerId === currentPlayer.id && p.category === category);
                      return (
                        <Button
                          key={category}
                          onClick={() => handleCategorySelect(category)}
                          disabled={isAlreadyPicked}
                          variant={selectedCategory === category ? "default" : "outline"}
                          className={`h-auto p-3 text-sm ${
                            selectedCategory === category
                              ? "bg-yellow-400 text-black hover:bg-yellow-500"
                              : isAlreadyPicked
                              ? "opacity-50 cursor-not-allowed"
                              : "border-gray-600 text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          {category}
                          {isAlreadyPicked && <span className="ml-2">✓</span>}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Confirm Pick */}
            {selectedMovie && selectedCategory && (
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="text-white">
                      <p className="text-lg">
                        <strong>{currentPlayer.name}</strong> is drafting:
                      </p>
                      <p className="text-yellow-400 font-bold text-xl">
                        {selectedMovie.title}
                      </p>
                      <p className="text-gray-300">
                        for category: <span className="text-yellow-400">{selectedCategory}</span>
                      </p>
                    </div>
                    <Button
                      onClick={confirmPick}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3"
                      size="lg"
                    >
                      Confirm Pick
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Draft Complete */}
        {isComplete && (
          <Card className="bg-gray-800 border-gray-600">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Film className="mx-auto text-yellow-400" size={64} />
                <h2 className="text-2xl font-bold text-white">Draft Complete!</h2>
                <p className="text-gray-300">All players have made their selections.</p>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                >
                  Start New Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
