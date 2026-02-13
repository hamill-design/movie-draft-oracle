import { useState, useCallback } from 'react';
import { makeAIPick, AIPickOptions } from '@/utils/aiPickLogic';
import { Movie } from '@/data/movies';

export const useAIPick = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickMovie = useCallback(async (options: AIPickOptions): Promise<Movie | null> => {
    setLoading(true);
    setError(null);

    try {
      const movie = await makeAIPick(options);
      if (!movie) {
        setError('No available movies to pick');
      }
      return movie;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to make AI pick';
      setError(errorMessage);
      console.error('Error in useAIPick:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    pickMovie,
    loading,
    error
  };
};
