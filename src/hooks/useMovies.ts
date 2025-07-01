
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/data/movies';

export const useMovies = (category?: string, searchQuery?: string) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllMovies = async () => {
    if (!category) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching all movies for category:', category, 'query:', searchQuery);
      
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: { 
          category, 
          searchQuery,
          fetchAll: true // New flag to fetch all pages
        }
      });

      if (error) throw error;

      console.log('Received movies:', data.results?.length || 0);
      setMovies(data.results || []);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch movies');
      console.error('Error fetching movies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (category) {
      fetchAllMovies();
    }
  }, [category, searchQuery]);

  return {
    movies,
    loading,
    error,
    refetch: fetchAllMovies
  };
};
