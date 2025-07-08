
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
  themeParameter: string;
}

const MovieSearch = ({
  theme,
  option,
  searchQuery,
  onSearchChange,
  movies,
  loading,
  selectedMovie,
  onMovieSelect,
  themeParameter
}: MovieSearchProps) => {
  const getPlaceholderText = () => {
    if (theme === 'year') {
      return `Search within ${option} movies...`;
    } else if (theme === 'people') {
      return `Search within ${option} movies...`;
    } else {
      return `Search for movies...`;
    }
  };

  // Filter movies based on search query if provided
  // The movies array already contains only movies constrained by the theme (year/person)
  // Here we just filter by title within those constrained results
  const filteredMovies = searchQuery.trim() 
    ? movies.filter(movie => 
        movie.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : movies;

  const shouldShowResults = movies.length > 0;

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Search className="text-yellow-400" size={24} />
          Search Movies
          {theme === 'year' ? ` from ${option}` : theme === 'people' ? ` featuring ${option}` : ''}
          {!loading && filteredMovies.length > 0 && (
            <span className="text-sm text-gray-400 ml-2">
              ({filteredMovies.length} movies {searchQuery.trim() ? 'found' : 'available'})
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
              <div className="text-gray-400">Loading movies...</div>
            ) : filteredMovies.length === 0 ? (
              <div className="text-gray-400">
                {searchQuery.trim() 
                  ? `No movies found matching "${searchQuery}" ${theme === 'year' ? `from ${option}` : theme === 'people' ? `featuring ${option}` : ''}` 
                  : `No movies found ${theme === 'year' ? `from ${option}` : theme === 'people' ? `featuring ${option}` : ''}`
                }
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
                Showing first 50 results of {filteredMovies.length} movies. Use search to narrow down.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MovieSearch;
