
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
    
    // For year/person themes, only fetch when user searches (at least 2 characters)
    if ((category === 'year' || category === 'person') && (!userSearchQuery || userSearchQuery.trim().length < 2)) {
      setMovies([]);
      setLoading(false);
      return;
    }
    
    // For spec-draft, fetch immediately if themeOption (spec draft ID) is provided
    if (category === 'spec-draft' && themeOption) {
      fetchMovies();
      return;
    }
    
    // For year/person with search query, debounce the search
    if ((category === 'year' || category === 'person') && userSearchQuery && userSearchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        fetchMovies();
      }, 500); // 500ms debounce to reduce rapid requests
      
      return () => {
        clearTimeout(timeoutId);
        // Cancel any pending request when search query changes
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }
    
    // For other categories, fetch immediately
    if (category && category !== 'year' && category !== 'person' && category !== 'spec-draft') {
      fetchMovies();
    }
  }, [category, themeOption, userSearchQuery]);

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
