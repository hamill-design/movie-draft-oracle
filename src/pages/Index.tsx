
import React, { useState } from 'react';
import { moviesDatabase, Movie } from '@/data/movies';
import MovieCard from '@/components/MovieCard';
import MovieScoring from '@/components/MovieScoring';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Film, Star, Trophy } from 'lucide-react';

const Index = () => {
  const [movies, setMovies] = useState<Movie[]>(moviesDatabase);

  const draftMovie = (movieId: number) => {
    setMovies(prev => prev.map(movie => 
      movie.id === movieId 
        ? { ...movie, isDrafted: true, scores: { plot: 0, acting: 0, cinematography: 0, direction: 0, overall: 0 } }
        : movie
    ));
  };

  const removeMovie = (movieId: number) => {
    setMovies(prev => prev.map(movie => 
      movie.id === movieId 
        ? { ...movie, isDrafted: false, scores: undefined }
        : movie
    ));
  };

  const updateScore = (movieId: number, category: string, score: number) => {
    setMovies(prev => prev.map(movie => 
      movie.id === movieId && movie.scores
        ? { ...movie, scores: { ...movie.scores, [category]: score } }
        : movie
    ));
  };

  const draftedMovies = movies.filter(movie => movie.isDrafted);
  const availableMovies = movies.filter(movie => !movie.isDrafted);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Film className="text-yellow-400" size={40} />
            <h1 className="text-4xl font-bold text-white">Movie Draft League</h1>
            <Trophy className="text-yellow-400" size={40} />
          </div>
          <p className="text-gray-300 text-lg">
            Draft your favorite movies and score them across multiple categories
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge variant="secondary" className="bg-yellow-400 text-black">
              {draftedMovies.length} Movies Drafted
            </Badge>
            <Badge variant="outline" className="border-gray-600 text-gray-300">
              {availableMovies.length} Available
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800 border-gray-700">
            <TabsTrigger 
              value="browse" 
              className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <Film className="mr-2" size={18} />
              Browse Movies
            </TabsTrigger>
            <TabsTrigger 
              value="draft" 
              className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <Trophy className="mr-2" size={18} />
              My Draft ({draftedMovies.length})
            </TabsTrigger>
            <TabsTrigger 
              value="score" 
              className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
            >
              <Star className="mr-2" size={18} />
              Score Movies
            </TabsTrigger>
          </TabsList>

          {/* Browse Movies Tab */}
          <TabsContent value="browse" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableMovies.map(movie => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onDraft={draftMovie}
                />
              ))}
            </div>
          </TabsContent>

          {/* Draft Tab */}
          <TabsContent value="draft" className="mt-6">
            {draftedMovies.length === 0 ? (
              <div className="text-center py-12">
                <Film className="mx-auto text-gray-600 mb-4" size={64} />
                <h3 className="text-xl text-gray-400 mb-2">No movies drafted yet</h3>
                <p className="text-gray-500">Go to Browse Movies to start building your collection!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {draftedMovies.map(movie => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onDraft={draftMovie}
                    onRemove={removeMovie}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Score Movies Tab */}
          <TabsContent value="score" className="mt-6">
            {draftedMovies.length === 0 ? (
              <div className="text-center py-12">
                <Star className="mx-auto text-gray-600 mb-4" size={64} />
                <h3 className="text-xl text-gray-400 mb-2">No movies to score</h3>
                <p className="text-gray-500">Draft some movies first to start scoring them!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {draftedMovies.map(movie => (
                  <MovieScoring
                    key={movie.id}
                    movie={movie}
                    onScoreUpdate={updateScore}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
