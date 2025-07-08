
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Movie } from '@/data/movies';

interface MovieSearchProps {
  theme: string;
  option: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  movies: Movie[];
  loading: boolean;
  selectedMovie: Movie | null;
  onMovieSelect: (movie: Movie) => void;
}

const MovieSearch = ({
  theme,
  option,
  searchQuery,
  onSearchChange,
  movies,
  loading,
  selectedMovie,
  onMovieSelect
}: MovieSearchProps) => {
  const getPlaceholderText = () => {
    if (theme === 'year') {
      return `Search for movies from ${option}...`;
    } else {
      return `Search for movies with ${option}...`;
    }
  };

  // Filter movies more strictly based on search query
  const filteredMovies = React.useMemo(() => {
    if (!searchQuery.trim() || !movies.length) return [];
    
    const query = searchQuery.toLowerCase().trim();
    return movies.filter(movie => 
      movie.title.toLowerCase().includes(query)
    );
  }, [movies, searchQuery]);

  const shouldShowResults = searchQuery.trim().length > 0;

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Search className="text-yellow-400" size={24} />
          Search Movies
          {theme === 'year' ? ` from ${option}` : ` featuring ${option}`}
          {!loading && filteredMovies.length > 0 && (
            <span className="text-sm text-gray-400 ml-2">
              ({filteredMovies.length} movies found)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          placeholder={getPlaceholderText()}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
        />
        
        {shouldShowResults && (
          <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-gray-400">Searching movies...</div>
            ) : filteredMovies.length === 0 ? (
              <div className="text-gray-400">
                No movies found matching "{searchQuery}" {theme === 'year' ? `from ${option}` : `featuring ${option}`}
              </div>
            ) : (
              filteredMovies.slice(0, 50).map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => onMovieSelect(movie)}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    selectedMovie?.id === movie.id
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  <div className="font-medium">{movie.title}</div>
                  <div className="text-sm opacity-75">
                    {movie.year} • {movie.genre}
                  </div>
                </div>
              ))
            )}
            {filteredMovies.length > 50 && (
              <div className="text-gray-400 text-sm text-center py-2">
                Showing first 50 results of {filteredMovies.length} movies matching "{searchQuery}".
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MovieSearch;
