import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Movie {
  id: number;
  title: string;
  year: number;
  posterPath?: string;
  tmdbId?: number;
}

interface MovieSearchSelectorProps {
  selectedMovieIds: number[];
  onMoviesChange: (movieIds: number[]) => void;
  initialMovies?: Array<{ id: number; title: string; year: number; posterPath?: string }>;
}

export const MovieSearchSelector: React.FC<MovieSearchSelectorProps> = ({
  selectedMovieIds,
  onMoviesChange,
  initialMovies = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMoviesCache, setSelectedMoviesCache] = useState<Map<number, Movie>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Initialize cache with initial movies (for editing existing categories)
  useEffect(() => {
    if (initialMovies.length > 0) {
      const cache = new Map<number, Movie>();
      initialMovies.forEach(movie => {
        cache.set(movie.id, {
          id: movie.id,
          title: movie.title,
          year: movie.year,
          posterPath: movie.posterPath,
          tmdbId: movie.id,
        });
      });
      setSelectedMoviesCache(cache);
    }
  }, [initialMovies]);

  // Search for movies
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setMovies([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: searchError } = await supabase.functions.invoke('fetch-movies', {
          body: {
            category: 'search',
            searchQuery: searchQuery.trim(),
            fetchAll: false,
            page: 1,
          },
        });

        if (searchError) throw searchError;

        const fetchedMovies = (data?.results || []).map((movie: any) => ({
          id: movie.id || movie.tmdbId,
          title: movie.title,
          year: movie.year,
          posterPath: movie.posterPath || movie.poster_path,
          tmdbId: movie.id || movie.tmdbId,
        }));

        setMovies(fetchedMovies);
        setShowResults(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search movies');
        setMovies([]);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMovieSelect = (movie: Movie) => {
    const movieId = movie.tmdbId || movie.id;
    if (!selectedMovieIds.includes(movieId)) {
      // Add to cache
      setSelectedMoviesCache(prev => new Map(prev).set(movieId, movie));
      onMoviesChange([...selectedMovieIds, movieId]);
    }
    setSearchQuery('');
    setShowResults(false);
  };

  // Fetch movie details for IDs that aren't in cache (for editing existing categories)
  useEffect(() => {
    const fetchMovieDetails = async (movieId: number) => {
      // Skip if already in cache
      if (selectedMoviesCache.has(movieId)) return;

      try {
        const { data, error } = await supabase.functions.invoke('get-movie-by-id', {
          body: { movieId }
        });

        if (error) throw error;

        if (data) {
          setSelectedMoviesCache(prev => new Map(prev).set(movieId, {
            id: data.id,
            title: data.title,
            year: data.year,
            posterPath: data.posterPath,
            tmdbId: data.tmdbId,
          }));
        }
      } catch (err) {
        console.error(`Failed to fetch movie ${movieId}:`, err);
        // Fallback to placeholder if fetch fails
        setSelectedMoviesCache(prev => {
          if (prev.has(movieId)) return prev;
          return new Map(prev).set(movieId, {
            id: movieId,
            title: `Movie ID: ${movieId}`,
            year: 0,
            tmdbId: movieId,
          });
        });
      }
    };

    // Fetch details for all selected movie IDs that aren't in cache
    selectedMovieIds.forEach(movieId => {
      if (!selectedMoviesCache.has(movieId)) {
        fetchMovieDetails(movieId);
      }
    });
  }, [selectedMovieIds, selectedMoviesCache]);

  const handleRemoveMovie = (movieId: number) => {
    onMoviesChange(selectedMovieIds.filter(id => id !== movieId));
  };

  const getPosterUrl = (posterPath: string | undefined) => {
    if (!posterPath) return null;
    if (posterPath.startsWith('http')) return posterPath;
    return `https://image.tmdb.org/t/p/w92${posterPath}`;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label 
          className="text-sm text-greyscale-blue-800"
          style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px' }}
        >
          Search to add Movies
        </label>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-greyscale-blue-400 pointer-events-none z-10" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (movies.length > 0) setShowResults(true);
              }}
              placeholder="e.g. Top Gun Maverick"
              className="pl-14 h-12 pr-4 py-3 border-greyscale-blue-400 rounded-[2px] text-sm"
              style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowResults(false);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <X className="w-4 h-4 text-greyscale-blue-400" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && (loading || movies.length > 0 || error) && (
            <div
              ref={resultsRef}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-auto"
            >
              {loading && (
                <div className="p-4 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </div>
              )}
              {error && (
                <div className="p-4 text-sm text-red-600">{error}</div>
              )}
              {!loading && !error && movies.length === 0 && searchQuery.length >= 2 && (
                <div className="p-4 text-sm text-gray-500">No movies found</div>
              )}
              {!loading && !error && movies.map((movie) => {
                const movieId = movie.tmdbId || movie.id;
                const isSelected = selectedMovieIds.includes(movieId);
                const posterUrl = getPosterUrl(movie.posterPath);

                return (
                  <button
                    key={movieId}
                    type="button"
                    onClick={() => !isSelected && handleMovieSelect(movie)}
                    disabled={isSelected}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3 ${
                      isSelected ? 'bg-green-50 opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {posterUrl && (
                      <img
                        src={posterUrl}
                        alt={movie.title}
                        className="w-12 h-16 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{movie.title}</div>
                      <div className="text-xs text-gray-500">{movie.year}</div>
                      <div className="text-xs text-gray-400">ID: {movieId}</div>
                    </div>
                    {isSelected && (
                      <div className="text-green-600 text-xs font-medium">Added</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Movies List */}
      {selectedMovieIds.length > 0 && (
        <div className="space-y-2">
          <label 
            className="text-sm text-greyscale-blue-800"
            style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px' }}
          >
            Selected Movies ({selectedMovieIds.length})
          </label>
          <div className="space-y-[5px] max-h-[256px] overflow-y-auto">
            {selectedMovieIds.map((movieId) => {
              // Try to find the movie details from cache or search results
              const cachedMovie = selectedMoviesCache.get(movieId);
              const searchMovie = movies.find(m => (m.tmdbId || m.id) === movieId);
              const movie = cachedMovie || searchMovie;
              const posterUrl = movie ? getPosterUrl(movie.posterPath) : null;

              return (
                <div
                  key={movieId}
                  className="bg-ui-primary border border-greyscale-blue-200 rounded-[4px] flex gap-4 items-center p-3"
                >
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={movie?.title || 'Movie'}
                      className="w-12 h-16 object-cover rounded-[4px]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-16 bg-greyscale-blue-200 rounded-[4px] flex items-center justify-center">
                      <span className="text-xs text-greyscale-blue-400">No Image</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-[2px]">
                    {movie ? (
                      <>
                        <div 
                          className="text-base text-text-primary"
                          style={{ fontFamily: 'Brockmann', fontWeight: 600, lineHeight: '24px', letterSpacing: '0.32px' }}
                        >
                          {movie.title}
                        </div>
                        <div 
                          className="text-sm text-greyscale-blue-500"
                          style={{ fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '20px' }}
                        >
                          {movie.year}
                        </div>
                      </>
                    ) : (
                      <div 
                        className="text-sm text-text-primary"
                        style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
                      >
                        Movie ID: {movieId}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMovie(movieId)}
                    className="p-3 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors"
                  >
                    <X className="w-6 h-6 text-text-primary" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

