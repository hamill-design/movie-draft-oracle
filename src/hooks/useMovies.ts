
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/data/movies';

export const useMovies = (category?: string, searchQuery?: string) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMovies = async (retryCount = 0) => {
    if (!category) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('useMovies - Fetching movies for category:', category, 'searchQuery:', searchQuery, 'attempt:', retryCount + 1);
      
      // For theme-based categories (year, person), we need to pass the theme parameter 
      // as the searchQuery to the backend to constrain the initial dataset
      const requestBody = {
        category,
        searchQuery: searchQuery || '',
        fetchAll: true // Always fetch all within the theme constraint
      };
      
      console.log('useMovies - Request body:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: requestBody,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (error) {
        console.error('useMovies - Supabase function error:', error);
        throw error;
      }

      const fetchedMovies = data?.results || [];
      console.log('useMovies - Received movies:', fetchedMovies.length);
      
      setMovies(fetchedMovies);
      
    } catch (err) {
      console.error('useMovies - Error fetching movies:', err);
      
      // Retry up to 2 times for network errors
      if (retryCount < 2 && (err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('Failed to send')))) {
        console.log('useMovies - Retrying in 1 second...');
        setTimeout(() => fetchMovies(retryCount + 1), 1000);
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to fetch movies');
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
