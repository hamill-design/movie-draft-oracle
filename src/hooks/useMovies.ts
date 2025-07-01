
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/data/movies';

export const useMovies = (category?: string, searchQuery?: string) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchMovies = async (reset: boolean = false) => {
    if (!category) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const currentPage = reset ? 1 : page;
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: { 
          category, 
          searchQuery, 
          page: currentPage 
        }
      });

      if (error) throw error;

      if (reset) {
        setMovies(data.results || []);
        setPage(1);
      } else {
        setMovies(prev => [...prev, ...(data.results || [])]);
      }
      
      setTotalPages(data.total_pages || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch movies');
      console.error('Error fetching movies:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (page < totalPages && !loading) {
      setPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (category) {
      fetchMovies(true);
    }
  }, [category, searchQuery]);

  useEffect(() => {
    if (page > 1) {
      fetchMovies(false);
    }
  }, [page]);

  return {
    movies,
    loading,
    error,
    loadMore,
    hasMore: page < totalPages,
    refetch: () => fetchMovies(true)
  };
};
