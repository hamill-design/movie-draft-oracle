
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/data/movies';

export const useMovies = (category?: string, searchQuery?: string) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connection health check
  const checkConnection = async () => {
    try {
      const { error } = await supabase.functions.invoke('fetch-movies', {
        body: { category: 'popular', searchQuery: '', fetchAll: false },
        headers: { 'Content-Type': 'application/json' }
      });
      return !error;
    } catch {
      return false;
    }
  };

  const fetchMovies = async (retryCount = 0) => {
    if (!category) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('useMovies - Fetching movies for category:', category, 'searchQuery:', searchQuery, 'attempt:', retryCount + 1);
      
      // Connection health check on first attempt
      if (retryCount === 0) {
        const isConnected = await checkConnection();
        if (!isConnected) {
          console.log('useMovies - Connection check failed, proceeding with retry logic');
        }
      }
      
      // For theme-based categories (year, person), we need to pass the theme parameter 
      // as the searchQuery to the backend to constrain the initial dataset
      const requestBody = {
        category,
        searchQuery: searchQuery || '',
        fetchAll: category !== 'person' // Only fetch all for non-person searches to avoid timeouts
      };
      
      console.log('useMovies - Request body:', requestBody);
      
      // Enhanced timeout and retry configuration
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
      
      // Enhanced retry logic with exponential backoff
      const isNetworkError = err instanceof Error && (
        err.message.includes('Failed to fetch') || 
        err.message.includes('Failed to send') ||
        err.message.includes('NetworkError') ||
        err.message.includes('timeout')
      );
      
      if (retryCount < 3 && isNetworkError) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`useMovies - Retrying in ${delay}ms (attempt ${retryCount + 1}/3)...`);
        setTimeout(() => fetchMovies(retryCount + 1), delay);
        return;
      }
      
      // Set user-friendly error message
      if (isNetworkError) {
        setError('Unable to connect to movie service. Please check your connection and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch movies');
      }
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
