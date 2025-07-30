
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Movie } from '@/data/movies';
import { getCleanActorName } from '@/lib/utils';
import { sanitizeHtml, INPUT_LIMITS } from '@/utils/inputValidation';

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
  console.log('MovieSearch - Props received:', {
    theme,
    option,
    movies: movies.length,
    loading,
    searchQuery,
    themeParameter
  });

  const getPlaceholderText = () => {
    if (theme === 'year') {
      return `Search within ${option} movies...`;
    } else if (theme === 'people') {
      return `Search within ${getCleanActorName(option)} movies...`;
    } else {
      return `Search for movies...`;
    }
  };

  // Apply frontend filtering as a safety net for year-based drafts
  let filteredMoviesByTheme = movies;
  if (theme === 'year') {
    const requestedYear = parseInt(option);
    filteredMoviesByTheme = movies.filter(movie => {
      const movieYear = movie.year;
      const matches = movieYear === requestedYear;
      if (!matches) {
        console.log(`Frontend safety filter: Removing "${movie.title}" (${movieYear}) - doesn't match requested year ${requestedYear}`);
      }
      return matches;
    });
    
    if (filteredMoviesByTheme.length !== movies.length) {
      console.log(`Frontend safety filter: ${movies.length} → ${filteredMoviesByTheme.length} movies after year filtering`);
    }
  }

  // Filter by search query within the theme-constrained results
  const filteredMovies = searchQuery.trim() 
    ? filteredMoviesByTheme.filter(movie => 
        movie.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : [];

  console.log('MovieSearch - Final filtered movies:', filteredMovies.length, 'from theme-filtered:', filteredMoviesByTheme.length, 'from total:', movies.length);

  // Only show results if user has started typing
  const shouldShowResults = searchQuery.trim().length > 0;

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Search className="text-yellow-400" size={24} />
          Search Movies
          {theme === 'year' ? ` from ${option}` : theme === 'people' ? ` featuring ${getCleanActorName(option)}` : ''}
          {!loading && shouldShowResults && filteredMovies.length > 0 && (
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
          onChange={(e) => {
            const sanitizedValue = sanitizeHtml(e.target.value);
            if (sanitizedValue.length <= INPUT_LIMITS.MAX_SEARCH_QUERY_LENGTH) {
              onSearchChange(sanitizedValue);
            }
          }}
          maxLength={INPUT_LIMITS.MAX_SEARCH_QUERY_LENGTH}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
        />
        
        {shouldShowResults && (
          <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-gray-400">Loading movies...</div>
            ) : filteredMoviesByTheme.length === 0 ? (
              <div className="text-gray-400">
                No movies available for {theme === 'year' ? `${option}` : theme === 'people' ? `${getCleanActorName(option)}` : 'this search'}
              </div>
            ) : filteredMovies.length === 0 ? (
              <div className="text-gray-400">
                No movies found matching "{searchQuery}" {theme === 'year' ? `from ${option}` : theme === 'people' ? `featuring ${getCleanActorName(option)}` : ''}
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
                    {theme === 'year' && movie.year !== parseInt(option) && (
                      <span className="text-red-400 ml-2">[YEAR MISMATCH: {movie.year}]</span>
                    )}
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
