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
 * Maps TMDB genre IDs to draft category names
 * @param genreIds Array of TMDB genre IDs
 * @param movieYear Optional movie year for decade categories
 * @param oscarStatus Optional oscar status for Academy Award category
 * @param revenue Optional revenue for Blockbuster category
 * @returns Array of category names the movie qualifies for
 */
export function mapGenresToCategories(
  genreIds: number[],
  movieYear?: number | null,
  oscarStatus?: string | null,
  revenue?: number | null
): string[] {
  const categories: string[] = [];
  const genreNames = genreIds.map(id => TMDB_GENRE_MAP[id]?.toLowerCase() || '').filter(Boolean);

  // Genre-based categories
  const hasAction = genreIds.includes(28);
  const hasAdventure = genreIds.includes(12);
  const hasAnimation = genreIds.includes(16);
  const hasComedy = genreIds.includes(35);
  const hasDrama = genreIds.includes(18);
  const hasRomance = genreIds.includes(10749);
  const hasSciFi = genreIds.includes(878);
  const hasFantasy = genreIds.includes(14);
  const hasHorror = genreIds.includes(27);
  const hasThriller = genreIds.includes(53);

  // Action/Adventure
  if (hasAction || hasAdventure) {
    categories.push('Action/Adventure');
  }

  // Animated
  if (hasAnimation) {
    categories.push('Animated');
  }

  // Comedy
  if (hasComedy) {
    categories.push('Comedy');
  }

  // Drama/Romance
  if (hasDrama || hasRomance) {
    categories.push('Drama/Romance');
  }

  // Sci-Fi/Fantasy
  if (hasSciFi || hasFantasy) {
    categories.push('Sci-Fi/Fantasy');
  }

  // Horror/Thriller
  if (hasHorror || hasThriller) {
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

  // Academy Award Nominee or Winner
  if (oscarStatus === 'winner' || oscarStatus === 'nominee') {
    categories.push('Academy Award Nominee or Winner');
  }

  // Blockbuster (minimum of $50 Mil)
  if (revenue && revenue >= 50000000) {
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

