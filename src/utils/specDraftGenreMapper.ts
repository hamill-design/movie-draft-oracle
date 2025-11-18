/**
 * Maps TMDB genre IDs to draft categories
 * This is used to automatically determine which categories a movie can apply to based on its genres
 */

// TMDB genre ID to name mapping
const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

/**
 * Maps movie data to draft category names using the same logic as the draft system
 * This matches the logic in isMovieEligibleForCategory and getEligibleCategories
 * @param genreStringOrIds Genre string (preferred) or array of TMDB genre IDs
 * @param movieYear Optional movie year for decade categories
 * @param oscarStatus Optional oscar status string ('winner', 'nominee', 'none', 'unknown')
 * @param revenue Optional revenue for Blockbuster category
 * @param hasOscar Optional boolean for Academy Award (alternative to oscarStatus)
 * @param isBlockbuster Optional boolean for Blockbuster (alternative to revenue check)
 * @returns Array of category names the movie qualifies for
 */
export function mapGenresToCategories(
  genreStringOrIds: string | number[],
  movieYear?: number | null,
  oscarStatus?: string | null,
  revenue?: number | null,
  hasOscar?: boolean,
  isBlockbuster?: boolean
): string[] {
  const categories: string[] = [];

  // Convert to genre string (same format as fetch-movies returns)
  let genreString = '';
  if (typeof genreStringOrIds === 'string') {
    // Already a string (preferred - this is what fetch-movies returns)
    genreString = genreStringOrIds.toLowerCase();
  } else if (Array.isArray(genreStringOrIds)) {
    // Array of genre IDs - convert to string
    genreString = genreStringOrIds
      .map(id => TMDB_GENRE_MAP[id])
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  // Genre-based categories (using same string matching logic as isMovieEligibleForCategory)
  if (genreString.includes('action') || genreString.includes('adventure')) {
    categories.push('Action/Adventure');
  }
  if (genreString.includes('animation') || genreString.includes('animated')) {
    categories.push('Animated');
  }
  if (genreString.includes('comedy')) {
    categories.push('Comedy');
  }
  if (genreString.includes('drama') || genreString.includes('romance')) {
    categories.push('Drama/Romance');
  }
  if (genreString.includes('sci-fi') || genreString.includes('science fiction') || 
      genreString.includes('fantasy') || genreString.includes('science')) {
    categories.push('Sci-Fi/Fantasy');
  }
  if (genreString.includes('horror') || genreString.includes('thriller')) {
    categories.push('Horror/Thriller');
  }

  // Decade categories (based on movie year)
  if (movieYear) {
    if (movieYear >= 1930 && movieYear <= 1939) {
      categories.push("30's");
    } else if (movieYear >= 1940 && movieYear <= 1949) {
      categories.push("40's");
    } else if (movieYear >= 1950 && movieYear <= 1959) {
      categories.push("50's");
    } else if (movieYear >= 1960 && movieYear <= 1969) {
      categories.push("60's");
    } else if (movieYear >= 1970 && movieYear <= 1979) {
      categories.push("70's");
    } else if (movieYear >= 1980 && movieYear <= 1989) {
      categories.push("80's");
    } else if (movieYear >= 1990 && movieYear <= 1999) {
      categories.push("90's");
    } else if (movieYear >= 2000 && movieYear <= 2009) {
      categories.push("2000's");
    } else if (movieYear >= 2010 && movieYear <= 2019) {
      categories.push("2010's");
    } else if (movieYear >= 2020 && movieYear <= 2029) {
      categories.push("2020's");
    }
  }

  // Academy Award Nominee or Winner (same logic as isMovieEligibleForCategory)
  // Check both hasOscar boolean and oscar_status string
  if (hasOscar === true || oscarStatus === 'winner' || oscarStatus === 'nominee') {
    categories.push('Academy Award Nominee or Winner');
  }

  // Blockbuster (minimum of $50 Mil) (same logic as isMovieEligibleForCategory)
  if (isBlockbuster === true || (revenue && revenue >= 50000000)) {
    categories.push('Blockbuster (minimum of $50 Mil)');
  }

  return [...new Set(categories)]; // Remove duplicates
}

/**
 * Gets the display name for a TMDB genre ID
 */
export function getGenreName(genreId: number): string {
  return TMDB_GENRE_MAP[genreId] || 'Unknown';
}

/**
 * Gets all genre IDs for a given genre name (case-insensitive)
 */
export function getGenreIdsByName(genreName: string): number[] {
  const lowerName = genreName.toLowerCase();
  return Object.entries(TMDB_GENRE_MAP)
    .filter(([_, name]) => name.toLowerCase() === lowerName)
    .map(([id]) => parseInt(id, 10));
}

