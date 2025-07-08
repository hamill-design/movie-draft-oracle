
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
      console.log('Fetching movies for category:', category, 'query:', searchQuery);
      
      // Determine the request type based on whether we have a search query
      const requestBody = searchQuery && searchQuery.trim() 
        ? { 
            category: 'search', 
            searchQuery: searchQuery.trim(),
            fetchAll: false 
          }
        : { 
            category, 
            searchQuery,
            fetchAll: true 
          };
      
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: requestBody
      });

      if (error) throw error;

      console.log('Received movies:', data?.results?.length || 0);
      setMovies(data?.results || []);
      
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
