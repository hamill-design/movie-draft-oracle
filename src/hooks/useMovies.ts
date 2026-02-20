
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/data/movies';
import { getCleanActorName } from '@/lib/utils';
import { getGenreName } from '@/utils/specDraftGenreMapper';

export const useMovies = (category?: string, themeOption?: string, userSearchQuery?: string) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const enrichingRef = useRef(false);

  const fetchMovies = async () => {
    if (!category) return;
    
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('useMovies - Fetching movies for category:', category, 'themeOption:', themeOption, 'userSearchQuery:', userSearchQuery);
      
      // Validation: Warn if year category is used without search query (should use debouncing)
      if (category === 'year' && themeOption && !userSearchQuery) {
        console.warn('useMovies: Year category requires userSearchQuery for proper debouncing');
      }
      
      // Handle spec-draft theme - fetch movies directly from spec_draft_movies table
      if (category === 'spec-draft' && themeOption) {
        const { data: moviesData, error: moviesError } = await (supabase as any)
          .from('spec_draft_movies')
          .select('movie_tmdb_id, movie_title, movie_year, movie_poster_path, movie_genres')
          .eq('spec_draft_id', themeOption)
          .order('movie_title', { ascending: true });

        if (moviesError) {
          console.error('useMovies - Error fetching spec draft movies:', moviesError);
          throw moviesError;
        }

        // Transform spec draft movies to Movie format
        const fetchedMovies: Movie[] = (moviesData || []).map((movie: any) => {
          // Convert genre IDs array to genre string (same format as fetch-movies returns)
          let genreString = '';
          if (movie.movie_genres && Array.isArray(movie.movie_genres) && movie.movie_genres.length > 0) {
            const genreNames = movie.movie_genres
              .map((id: number) => getGenreName(id))
              .filter(Boolean);
            genreString = genreNames.join(' ');
            console.log(`useMovies - Movie "${movie.movie_title}": genres=${JSON.stringify(movie.movie_genres)}, converted to="${genreString}"`);
          } else {
            console.warn(`useMovies - Movie "${movie.movie_title}" has no genres:`, movie.movie_genres);
          }

          return {
            id: movie.movie_tmdb_id,
            title: movie.movie_title,
            year: movie.movie_year,
            poster_path: movie.movie_poster_path,
            genre: genreString,
            overview: '',
            rating: 0,
            vote_count: 0
          };
        });

        console.log('useMovies - Received spec draft movies:', fetchedMovies.length);
        setMovies(fetchedMovies);
        return;
      }
      
      // For theme-based categories (year, person), themeOption is the year/person name
      // userSearchQuery is what the user types in the search box
      let cleanedThemeOption = themeOption || '';
      if (category === 'person' && themeOption) {
        cleanedThemeOption = getCleanActorName(themeOption);
        console.log('useMovies - Cleaned actor name from:', themeOption, 'to:', cleanedThemeOption);
      }
      
      // For year category, pass year as searchQuery and user search as movieSearchQuery
      // For person category, pass person name as searchQuery and user search as movieSearchQuery
      // Only fetch search results, not all movies
      const requestBody = category === 'year' 
        ? {
            category,
            searchQuery: cleanedThemeOption, // Year value (e.g., '1995')
            movieSearchQuery: userSearchQuery || '', // User's search term (e.g., 'GoldenEye')
            fetchAll: false, // Never fetch all for year searches
            page: 1,
            pageLimit: 20 // Limit results to 20 for faster response
          }
        : category === 'person'
        ? {
            category,
            searchQuery: cleanedThemeOption, // Person name (e.g., 'Brad Pitt')
            movieSearchQuery: userSearchQuery || '', // User's search term (e.g., "Ocean's")
            fetchAll: false, // Don't fetch all - only search results
            page: 1,
            pageLimit: 20 // Limit results to 20 for faster response
          }
        : {
            category,
            searchQuery: cleanedThemeOption, // Other categories
            fetchAll: true
          };
      
      console.log('useMovies - Request body:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: requestBody
      });

      // Check if request was aborted
      if (signal.aborted) {
        return;
      }

      if (error) {
        console.error('useMovies - Supabase function error:', error);
        throw error;
      }

      // Check again if request was aborted before updating state
      if (signal.aborted) {
        return;
      }

      const fetchedMovies = data?.results || [];
      console.log('useMovies - Received movies:', fetchedMovies.length);
      
      setMovies(fetchedMovies);
      
    } catch (err) {
      // Don't set error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Check if signal was aborted
      if (signal.aborted) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch movies');
      console.error('useMovies - Error fetching movies:', err);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!category) {
      setMovies([]);
      return;
    }
    
    // For year theme, only fetch when user has typed at least 2 characters
    if (category === 'year') {
      if (!userSearchQuery || userSearchQuery.trim().length < 2) {
        setMovies([]);
        setLoading(false);
        return;
      }
      const timeoutId = setTimeout(() => fetchMovies(), 500);
      return () => {
        clearTimeout(timeoutId);
        if (abortControllerRef.current) abortControllerRef.current.abort();
      };
    }
    
    // For person theme: fetch initial list when themeOption (actor name) is set so picker isn't empty.
    // With 2+ char search, debounce and refetch.
    if (category === 'person') {
      if (!themeOption) {
        setMovies([]);
        setLoading(false);
        return;
      }
      const hasSearch = userSearchQuery && userSearchQuery.trim().length >= 2;
      if (hasSearch) {
        const timeoutId = setTimeout(() => fetchMovies(), 500);
        return () => {
          clearTimeout(timeoutId);
          if (abortControllerRef.current) abortControllerRef.current.abort();
        };
      }
      // Initial load: show first page of movies for this person (empty search)
      fetchMovies();
      return;
    }
    
    // For spec-draft, fetch immediately if themeOption (spec draft ID) is provided
    if (category === 'spec-draft' && themeOption) {
      fetchMovies();
      return;
    }
    
    // For other categories, fetch immediately
    if (category && category !== 'year' && category !== 'person' && category !== 'spec-draft') {
      fetchMovies();
    }
  }, [category, themeOption, userSearchQuery]);

  // Pre-enrich movies with Oscar status when loaded (especially for spec-draft where all movies load at once)
  useEffect(() => {
    // Only enrich if movies are loaded and not currently loading
    if (movies.length === 0 || loading) return;
    
    // Prevent duplicate enrichment runs
    if (enrichingRef.current) return;
    
    // Filter movies that don't already have Oscar status
    const moviesToEnrich = movies.filter(m => m.id && (m.oscar_status === undefined || m.oscar_status === null));
    if (moviesToEnrich.length === 0) return;
    
    // Batch check Oscar status for all movies (process in chunks for large batches)
    const enrichOscarStatus = async () => {
      enrichingRef.current = true;
      try {
        const movieIds = moviesToEnrich.map(m => m.id).filter(Boolean) as number[];
        if (movieIds.length === 0) {
          enrichingRef.current = false;
          return;
        }
        
        console.log(`🎬 Pre-enriching Oscar status for ${movieIds.length} movies...`);
        
        // Process in chunks of 200 to avoid query size limits
        const CHUNK_SIZE = 200;
        const chunks: number[][] = [];
        for (let i = 0; i < movieIds.length; i += CHUNK_SIZE) {
          chunks.push(movieIds.slice(i, i + CHUNK_SIZE));
        }
        
        const allOscarData: Array<{ tmdb_id: number; oscar_status: string }> = [];
        
        // Process chunks in parallel (but limit concurrency to avoid overwhelming the database)
        const MAX_CONCURRENT = 3;
        for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
          const chunkBatch = chunks.slice(i, i + MAX_CONCURRENT);
          const results = await Promise.all(
            chunkBatch.map(chunk =>
              supabase
                .from('oscar_cache')
                .select('tmdb_id, oscar_status')
                .in('tmdb_id', chunk)
                .then(({ data, error }) => {
                  if (error) {
                    console.error(`useMovies - Error checking chunk:`, error);
                    return [];
                  }
                  return (data || []) as Array<{ tmdb_id: number; oscar_status: string }>;
                })
            )
          );
          
          results.forEach(chunkData => allOscarData.push(...chunkData));
        }
        
        // Create a map of tmdb_id to oscar_status
        const oscarMap = new Map(
          allOscarData.map((item) => [item.tmdb_id, item.oscar_status])
        );
        
        // Update movies with Oscar status
        setMovies(prevMovies => 
          prevMovies.map(movie => {
            if (!movie.id) return movie;
            const oscarStatus = oscarMap.get(movie.id);
            if (oscarStatus) {
              return {
                ...movie,
                oscar_status: oscarStatus,
                hasOscar: oscarStatus === 'winner' || oscarStatus === 'nominee'
              };
            }
            return movie;
          })
        );
        
        const enrichedCount = oscarMap.size;
        console.log(`✅ Pre-enriched ${enrichedCount} of ${movieIds.length} movies with Oscar status`);
      } catch (err) {
        console.error('useMovies - Error enriching Oscar status:', err);
      } finally {
        enrichingRef.current = false;
      }
    };
    
    enrichOscarStatus();
  }, [movies, loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    movies,
    loading,
    error,
    refetch: fetchMovies
  };
};
