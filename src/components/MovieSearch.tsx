
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
    if (theme === 'spec-draft') {
      return `Search movies...`;
    } else if (theme === 'year') {
      return `Search within ${option} movies...`;
    } else if (theme === 'people') {
      return `Search within ${getCleanActorName(option)} movies...`;
    } else {
      return `Search for movies...`;
    }
  };

  // Apply frontend filtering as a safety net for year-based drafts
  // Note: spec-draft movies are already filtered by the useMovies hook, so no additional filtering needed
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
  // For spec-draft, movies are already filtered by spec_draft_id in useMovies, so no additional filtering needed

  // Filter by search query within the theme-constrained results
  const filteredMovies = searchQuery.trim() 
    ? filteredMoviesByTheme.filter(movie => 
        movie.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : [];

  console.log('MovieSearch - Final filtered movies:', filteredMovies.length, 'from theme-filtered:', filteredMoviesByTheme.length, 'from total:', movies.length);

  // Only show results when user has started typing (same behavior for all themes)
  const shouldShowResults = searchQuery.trim().length > 0;

  return (
    <div className="w-full h-full p-6 bg-greyscale-blue-100 shadow-sm rounded border flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 flex justify-center items-center">
          <Search size={24} className="text-brand-primary" />
        </div>
        <span className="text-text-primary text-xl font-brockmann font-medium leading-7">
          Search Movies
          {theme === 'spec-draft' ? '' : theme === 'year' ? ` from ${option}` : theme === 'people' ? ` featuring ${getCleanActorName(option)}` : ''}
        </span>
      </div>
      
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 bg-ui-primary rounded-sm border border-text-primary">
            <div className="flex-1 overflow-hidden flex flex-col justify-start items-start">
              <input
                placeholder={getPlaceholderText()}
                value={searchQuery}
                onChange={(e) => {
                  const sanitizedValue = sanitizeHtml(e.target.value);
                  if (sanitizedValue.length <= INPUT_LIMITS.MAX_SEARCH_QUERY_LENGTH) {
                    onSearchChange(sanitizedValue);
                  }
                }}
                maxLength={INPUT_LIMITS.MAX_SEARCH_QUERY_LENGTH}
                className="w-full bg-transparent text-text-primary text-sm font-brockmann font-medium leading-5 outline-none placeholder:text-text-primary placeholder:opacity-60"
              />
            </div>
          </div>
        </div>
        
        {shouldShowResults && (
          <div className="max-h-60 overflow-y-auto flex flex-col justify-start items-center gap-2">
            {loading ? (
              <div className="text-text-primary font-brockmann font-medium text-sm leading-5">Loading movies...</div>
            ) : filteredMoviesByTheme.length === 0 ? (
              <div className="text-text-primary font-brockmann font-medium text-sm leading-5">
                No movies available {theme === 'spec-draft' ? 'for this draft' : theme === 'year' ? `for ${option}` : theme === 'people' ? `for ${getCleanActorName(option)}` : 'for this search'}
              </div>
            ) : filteredMovies.length === 0 ? (
              <div className="text-text-primary font-brockmann font-medium text-sm leading-5">
                No movies found matching "{searchQuery}" {theme === 'spec-draft' ? '' : theme === 'year' ? `from ${option}` : theme === 'people' ? `featuring ${getCleanActorName(option)}` : ''}
              </div>
            ) : (
              filteredMovies.slice(0, 50).map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => onMovieSelect(movie)}
                  className={`w-full py-2.5 px-4 rounded cursor-pointer transition-colors flex flex-col justify-start items-start gap-0.5 border ${
                    selectedMovie?.id === movie.id
                      ? 'bg-brand-primary border-brand-primary'
                      : 'bg-ui-primary border-greyscale-blue-200 hover:bg-[#EDEBFF] hover:border-[#BCB2FF]'
                  }`}
                >
                  <div className="w-full flex flex-col justify-start items-start">
                    <span className={`text-base font-brockmann font-semibold leading-6 tracking-[0.32px] ${
                      selectedMovie?.id === movie.id ? 'text-ui-primary' : 'text-text-primary'
                    }`}>
                      {movie.title}
                    </span>
                  </div>
                  <div className="w-full opacity-75 flex flex-col justify-start items-start">
                    <span className={`text-sm font-brockmann font-normal leading-5 ${
                      selectedMovie?.id === movie.id ? 'text-ui-primary' : 'text-text-primary'
                    }`}>
                      {movie.year}
                      {theme === 'year' && movie.year !== parseInt(option) && (
                        <span className="text-error-red-500 ml-2">[YEAR MISMATCH: {movie.year}]</span>
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
            {filteredMovies.length > 50 && (
              <div className="text-text-primary text-sm text-center py-2 font-brockmann font-medium leading-5">
                Showing first 50 results of {filteredMovies.length} movies. Use search to narrow down.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieSearch;
