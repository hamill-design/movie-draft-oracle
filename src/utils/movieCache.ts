import { Movie } from '@/data/movies';

const CACHE_PREFIX = 'movie_cache_';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CachedMovieData {
  movies: Movie[];
  timestamp: number;
  ttl: number;
}

/**
 * Generate a unique cache key for a theme-based draft
 */
export function getCacheKey(category: string, themeOption: string): string {
  // Normalize the theme option to ensure consistent keys
  const normalized = themeOption
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  
  return `${CACHE_PREFIX}${category}_${normalized}`;
}

/**
 * Check if cached data is still valid
 */
export function isCacheValid(cachedData: CachedMovieData | null, ttl?: number): boolean {
  if (!cachedData) return false;
  
  const cacheTTL = ttl || cachedData.ttl || DEFAULT_TTL;
  const age = Date.now() - cachedData.timestamp;
  return age < cacheTTL;
}

/**
 * Retrieve cached movies from localStorage
 */
export function getCachedMovies(key: string): Movie[] | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const cachedData: CachedMovieData = JSON.parse(cached);
    
    if (!isCacheValid(cachedData)) {
      // Cache expired, remove it
      localStorage.removeItem(key);
      return null;
    }
    
    return cachedData.movies;
  } catch (error) {
    console.error('Error reading from cache:', error);
    // If cache is corrupted, remove it
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Store movies in localStorage cache
 */
export function setCachedMovies(key: string, movies: Movie[], ttl: number = DEFAULT_TTL): void {
  try {
    const cachedData: CachedMovieData = {
      movies,
      timestamp: Date.now(),
      ttl
    };
    
    localStorage.setItem(key, JSON.stringify(cachedData));
    console.log(`✅ Cached ${movies.length} movies with key: ${key}`);
  } catch (error) {
    // Handle quota exceeded or other storage errors
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('⚠️ localStorage quota exceeded, clearing old caches');
      clearOldCaches();
      
      // Try again after clearing
      try {
        localStorage.setItem(key, JSON.stringify(cachedData));
        console.log(`✅ Cached ${movies.length} movies after clearing old caches`);
      } catch (retryError) {
        console.error('❌ Failed to cache movies even after clearing:', retryError);
      }
    } else {
      console.error('Error writing to cache:', error);
    }
  }
}

/**
 * Clear a specific cache entry
 */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(key);
    console.log(`🗑️ Cleared cache: ${key}`);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Clear all movie caches
 */
export function clearAllCaches(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log('🗑️ Cleared all movie caches');
  } catch (error) {
    console.error('Error clearing all caches:', error);
  }
}

/**
 * Clear old caches to free up space (keeps most recent 10)
 */
function clearOldCaches(): void {
  try {
    const keys = Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .map(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const data: CachedMovieData = JSON.parse(cached);
            return { key, timestamp: data.timestamp };
          }
        } catch {
          return null;
        }
        return null;
      })
      .filter((item): item is { key: string; timestamp: number } => item !== null)
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    
    // Keep the 10 most recent, remove the rest
    if (keys.length > 10) {
      keys.slice(10).forEach(({ key }) => {
        localStorage.removeItem(key);
      });
      console.log(`🗑️ Cleared ${keys.length - 10} old caches`);
    }
  } catch (error) {
    console.error('Error clearing old caches:', error);
  }
}

/**
 * Get cache age in hours
 */
export function getCacheAge(key: string): number | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const cachedData: CachedMovieData = JSON.parse(cached);
    const age = Date.now() - cachedData.timestamp;
    return age / (60 * 60 * 1000); // Convert to hours
  } catch {
    return null;
  }
}
