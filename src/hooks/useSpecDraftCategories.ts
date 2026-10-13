import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Per-category movie lists for a spec draft, in the same shape as `useActorSpecCategories`
 * (category name -> TMDB ids) so `getEligibleCategories` can treat both the same way.
 *
 * Source of truth is `spec_draft_movie_categories` — the tags set in the admin spec draft manager
 * (Aardman, Clay, Puppet, ...).
 *
 * @param specDraftId - the spec draft's id (the draft's `option` when theme is 'spec-draft'), or null
 */
export const useSpecDraftCategories = (specDraftId: string | null) => {
  const [specCategories, setSpecCategories] = useState<Map<string, number[]>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!specDraftId) {
      setSpecCategories(new Map());
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('spec_draft_movies')
          .select('movie_tmdb_id, spec_draft_movie_categories(category_name)')
          .eq('spec_draft_id', specDraftId);

        if (error) throw error;

        const map = new Map<string, number[]>();
        (data || []).forEach(
          (row: { movie_tmdb_id: number; spec_draft_movie_categories: { category_name: string }[] | null }) => {
            (row.spec_draft_movie_categories || []).forEach(({ category_name }) => {
              const ids = map.get(category_name);
              if (ids) ids.push(row.movie_tmdb_id);
              else map.set(category_name, [row.movie_tmdb_id]);
            });
          }
        );
        if (!cancelled) setSpecCategories(map);
      } catch (err) {
        console.error('Error fetching spec draft categories:', err);
        if (!cancelled) setSpecCategories(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [specDraftId]);

  return { specCategories, loading };
};
