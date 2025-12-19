
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/data/movies';
import { getCleanActorName } from '@/lib/utils';
import { getGenreName } from '@/utils/specDraftGenreMapper';

export const useMovies = (category?: string, searchQuery?: string) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMovies = async () => {
    if (!category) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('useMovies - Fetching movies for category:', category, 'searchQuery:', searchQuery);
      
      // Handle spec-draft theme - fetch movies directly from spec_draft_movies table
      if (category === 'spec-draft' && searchQuery) {
        const { data: moviesData, error: moviesError } = await (supabase as any)
          .from('spec_draft_movies')
          .select('movie_tmdb_id, movie_title, movie_year, movie_poster_path, movie_genres')
          .eq('spec_draft_id', searchQuery)
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
      
      // For theme-based categories (year, person), we need to pass the theme parameter 
      // as the searchQuery to the backend to constrain the initial dataset
      // Clean the actor name if it's a person search to remove corrupted data
      let cleanedSearchQuery = searchQuery || '';
      if (category === 'person' && searchQuery) {
        cleanedSearchQuery = getCleanActorName(searchQuery);
        console.log('useMovies - Cleaned actor name from:', searchQuery, 'to:', cleanedSearchQuery);
      }
      
      const requestBody = {
        category,
        searchQuery: cleanedSearchQuery,
        fetchAll: true // Always fetch all within the theme constraint
      };
      
      console.log('useMovies - Request body:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: requestBody
      });

      if (error) {
        console.error('useMovies - Supabase function error:', error);
        throw error;
      }

      const fetchedMovies = data?.results || [];
      console.log('useMovies - Received movies:', fetchedMovies.length);
      
      setMovies(fetchedMovies);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch movies');
      console.error('useMovies - Error fetching movies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (category) {
      console.log('useMovies - Effect triggered, category:', category, 'searchQuery:', searchQuery);
      fetchMovies();
    }
  }, [category, searchQuery]);

  return {
    movies,
    loading,
    error,
    refetch: fetchMovies
  };
};
