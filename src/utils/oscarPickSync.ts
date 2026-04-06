import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeOscarStatusFromSources } from '@/utils/movieCategoryUtils';

const CHUNK_SIZE = 200;

/**
 * Load oscar_cache rows for the given TMDB ids (batched for PostgREST limits).
 */
export async function fetchOscarCacheMap(
  client: SupabaseClient,
  tmdbIds: Array<number | string | null | undefined>
): Promise<Map<number, string>> {
  const unique = [
    ...new Set(
      tmdbIds
        .map((id) => (typeof id === 'number' ? id : Number(id)))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
  const map = new Map<number, string>();
  if (unique.length === 0) return map;

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const { data, error } = await client
      .from('oscar_cache')
      .select('tmdb_id, oscar_status')
      .in('tmdb_id', chunk);
    if (error) {
      console.error('fetchOscarCacheMap chunk error:', error);
      continue;
    }
    for (const row of data || []) {
      if (row.tmdb_id != null && row.oscar_status) {
        map.set(Number(row.tmdb_id), row.oscar_status);
      }
    }
  }
  return map;
}

export type PickWithOscar = {
  movie_id: number | string;
  oscar_status?: string | null;
};

/**
 * Merge each pick's oscar_status with oscar_cache (winner/nominee wins over stale pick rows).
 */
export function mergePicksOscarWithCache<T extends PickWithOscar>(picks: T[], cacheMap: Map<number, string>): T[] {
  return picks.map((pick) => {
    const mid = typeof pick.movie_id === 'number' ? pick.movie_id : Number(pick.movie_id);
    if (!Number.isFinite(mid) || mid <= 0) {
      return { ...pick };
    }
    const fromCache = cacheMap.get(mid);
    const merged = mergeOscarStatusFromSources(pick.oscar_status, fromCache);
    if (fromCache === undefined && (pick.oscar_status === undefined || pick.oscar_status === null)) {
      return { ...pick };
    }
    return { ...pick, oscar_status: merged.oscar_status };
  });
}
