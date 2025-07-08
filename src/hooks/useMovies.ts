
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
      console.log('Fetching movies for category:', category, 'query:', searchQuery);
      
      // For title-based searches, use the 'search' category
      let requestCategory = category;
      let requestQuery = searchQuery;
      
      if (category === 'all' && searchQuery) {
        // When searching for movie titles, use the search category
        requestCategory = 'search';
        requestQuery = searchQuery;
      }
      
      // Only use fetchAll for browsing categories, not for specific searches
      const shouldFetchAll = !searchQuery && (category === 'all' || category === 'popular');
      
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: { 
          category: requestCategory, 
          searchQuery: requestQuery,
          fetchAll: shouldFetchAll,
          page: 1
        }
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
