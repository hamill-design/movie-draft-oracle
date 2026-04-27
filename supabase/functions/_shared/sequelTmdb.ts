/**
 * Shared TMDB collection + release-date logic for "Sequel" category (strict: earlier
 * theatrical release exists in same collection). Used by fetch-movies and enrich-spec-draft-sequels.
 */

/** Parse TMDB release_date (YYYY-MM-DD) for comparison; invalid → null */
export function parseReleaseDateMs(releaseDate: string | null | undefined): number | null {
  if (!releaseDate || typeof releaseDate !== 'string') return null;
  const t = Date.parse(releaseDate);
  return Number.isNaN(t) ? null : t;
}

export type CollectionPart = { id: number; release_date?: string };

/**
 * True if another film in the same TMDB collection has a strictly earlier theatrical release date.
 */
export function computeIsSequelFromParts(
  movieId: number,
  thisReleaseDate: string | null | undefined,
  parts: CollectionPart[]
): boolean {
  const selfMs = parseReleaseDateMs(thisReleaseDate ?? undefined);
  if (selfMs === null) return false;
  for (const p of parts) {
    if (p.id === movieId) continue;
    const otherMs = parseReleaseDateMs(p.release_date);
    if (otherMs === null) continue;
    if (otherMs < selfMs) return true;
  }
  return false;
}

/**
 * Per-request (or per-invocation) cache for GET /collection/{id} to avoid duplicate TMDB calls.
 */
export function createCollectionPartGetter(tmdbApiKey: string) {
  const collectionPartsCache = new Map<number, CollectionPart[]>();
  const collectionInflight = new Map<number, Promise<CollectionPart[]>>();

  async function getCachedCollectionParts(collectionId: number): Promise<CollectionPart[]> {
    const hit = collectionPartsCache.get(collectionId);
    if (hit) return hit;
    let inflight = collectionInflight.get(collectionId);
    if (!inflight) {
      inflight = (async () => {
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/collection/${collectionId}?api_key=${tmdbApiKey}`
          );
          if (!res.ok) {
            console.log(`Collection fetch failed ${collectionId}: ${res.status}`);
            return [];
          }
          const json = await res.json();
          const parts: CollectionPart[] = Array.isArray(json.parts) ? json.parts : [];
          collectionPartsCache.set(collectionId, parts);
          return parts;
        } catch (e) {
          console.log(`Collection fetch error ${collectionId}:`, e);
          return [];
        } finally {
          collectionInflight.delete(collectionId);
        }
      })();
      collectionInflight.set(collectionId, inflight);
    }
    return inflight;
  }

  return { getCachedCollectionParts };
}

/**
 * Full TMDB resolution for one movie: fetch detail, optional collection, compute strict sequel.
 */
export async function resolveIsSequelFromTmdbId(
  movieTmdbId: number,
  tmdbApiKey: string
): Promise<{ isSequel: boolean; ok: boolean; error?: string }> {
  if (!tmdbApiKey) {
    return { isSequel: false, ok: false, error: 'Missing TMDB API key' };
  }
  try {
    const detailResponse = await fetch(
      `https://api.themoviedb.org/3/movie/${movieTmdbId}?api_key=${tmdbApiKey}`
    );
    if (!detailResponse.ok) {
      return {
        isSequel: false,
        ok: false,
        error: `TMDB movie ${detailResponse.status}`,
      };
    }
    const detailed = await detailResponse.json();
    const { getCachedCollectionParts } = createCollectionPartGetter(tmdbApiKey);
    let isSequel = false;
    const collectionId = detailed.belongs_to_collection?.id;
    if (collectionId != null && typeof collectionId === 'number') {
      const parts = await getCachedCollectionParts(collectionId);
      const releaseForCompare = detailed.release_date || null;
      isSequel = computeIsSequelFromParts(movieTmdbId, releaseForCompare, parts);
    }
    return { isSequel, ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { isSequel: false, ok: false, error: msg };
  }
}
