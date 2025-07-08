
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
      
      // For theme-based categories (year, person), always fetch all movies from that constraint
      // Then filter by search query if provided
      const requestBody = {
        category,
        searchQuery: searchQuery || '',
        fetchAll: true // Always fetch all for theme-based filtering
      };
      
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: requestBody
      });

      if (error) throw error;

      let filteredMovies = data?.results || [];
      
      // If there's a search query, filter the results by title
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filteredMovies = filteredMovies.filter((movie: Movie) =>
          movie.title.toLowerCase().includes(query)
        );
      }

      console.log('Received movies:', filteredMovies.length);
      setMovies(filteredMovies);
      
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
