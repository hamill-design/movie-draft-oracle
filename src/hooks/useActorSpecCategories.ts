import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActorSpecCategory {
  category_name: string;
  movie_tmdb_ids: number[];
  description?: string;
}

/**
 * Hook to fetch actor-specific spec categories from the database
 * @param actorName - The name of the actor (e.g., "Tom Cruise")
 * @returns Map of category names to arrays of movie TMDB IDs
 */
export const useActorSpecCategories = (actorName: string | null) => {
  const [specCategories, setSpecCategories] = useState<Map<string, number[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!actorName) {
      setSpecCategories(new Map());
      return;
    }

    const fetchSpecCategories = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try exact match first
        let { data, error: fetchError } = await supabase
          .from('actor_spec_categories')
          .select('category_name, movie_tmdb_ids')
          .eq('actor_name', actorName);

        if (fetchError || !data || data.length === 0) {
          // Try case-insensitive match
          ({ data, fetchError } = await supabase
            .from('actor_spec_categories')
            .select('category_name, movie_tmdb_ids')
            .ilike('actor_name', actorName));
        }

        if (fetchError) {
          throw fetchError;
        }

        if (data && data.length > 0) {
          const categoriesMap = new Map<string, number[]>();
          data.forEach((row: ActorSpecCategory) => {
            categoriesMap.set(row.category_name, row.movie_tmdb_ids || []);
          });
          setSpecCategories(categoriesMap);
        } else {
          setSpecCategories(new Map());
        }
      } catch (err) {
        console.error('Error fetching actor spec categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch spec categories');
        setSpecCategories(new Map());
      } finally {
        setLoading(false);
      }
    };

    fetchSpecCategories();
  }, [actorName]);

  return { specCategories, loading, error };
};


