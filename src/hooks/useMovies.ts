
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/data/movies';

export const useMovies = (category?: string, searchQuery?: string) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMovies = async () => {
    if (!category) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching movies for category:', category, 'searchQuery:', searchQuery);
      
      // For theme-based categories (year, person), we need to pass the theme parameter 
      // as the searchQuery to the backend to constrain the initial dataset
      const requestBody = {
        category,
        searchQuery: searchQuery || '',
        fetchAll: true // Always fetch all within the theme constraint
      };
      
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: requestBody
      });

      if (error) throw error;

      const fetchedMovies = data?.results || [];
      console.log('Received movies:', fetchedMovies.length);
      
      setMovies(fetchedMovies);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch movies');
      console.error('Error fetching movies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (category) {
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
