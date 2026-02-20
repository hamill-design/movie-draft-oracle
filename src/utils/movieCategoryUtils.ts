
interface Movie {
  id: number;
  title: string;
  year: number;
  genre: string;
  voteAverage?: number;
  releaseDate?: string;
  hasOscar?: boolean;
  oscar_status?: string; // Oscar status: 'winner', 'nominee', 'none', or 'unknown'
  isBlockbuster?: boolean;
  budget?: number;
  revenue?: number;
  tmdbId?: number; // TMDB ID for spec category matching
}

export const getEligibleCategories = (
  movie: Movie, 
  allCategories: string[],
  theme?: string,
  option?: string,
  specCategoriesMap?: Map<string, number[]>
): string[] => {
  if (!movie) return [];

  const eligibleCategories: string[] = [];
  
  // Debug logging for genre matching
  const debugLog = (category: string, matched: boolean, reason: string) => {
    if (matched) {
      console.log(`getEligibleCategories: "${movie.title}" (genre: "${movie.genre}") → ${category} - ${reason}`);
    }
  };

  // Check spec categories first if this is a person-based theme
  if (theme === 'people' && option && specCategoriesMap && specCategoriesMap.size > 0) {
    const movieId = movie.tmdbId || movie.id;
    
    specCategoriesMap.forEach((movieIds, categoryName) => {
      // Only check if this category is in the draft's category list
      if (allCategories.includes(categoryName) && movieId && movieIds.includes(movieId)) {
        eligibleCategories.push(categoryName);
      }
    });
  }

  // Year-based categories
  if (movie.year >= 1930 && movie.year <= 1939) {
    eligibleCategories.push("30's");
  }
  if (movie.year >= 1940 && movie.year <= 1949) {
    eligibleCategories.push("40's");
  }
  if (movie.year >= 1950 && movie.year <= 1959) {
    eligibleCategories.push("50's");
  }
  if (movie.year >= 1960 && movie.year <= 1969) {
    eligibleCategories.push("60's");
  }
  if (movie.year >= 1970 && movie.year <= 1979) {
    eligibleCategories.push("70's");
  }
  if (movie.year >= 1980 && movie.year <= 1989) {
    eligibleCategories.push("80's");
  }
  if (movie.year >= 1990 && movie.year <= 1999) {
    eligibleCategories.push("90's");
  }
  if (movie.year >= 2000 && movie.year <= 2009) {
    eligibleCategories.push("2000's");
  }
  if (movie.year >= 2010 && movie.year <= 2019) {
    eligibleCategories.push("2010's");
  }
  if (movie.year >= 2020 && movie.year <= 2029) {
    eligibleCategories.push("2020's");
  }

  // Genre-based categories
  // Use strict word matching to ensure we match whole genre words, not substrings
  const genre = movie.genre?.toLowerCase().trim() || '';
  
  // Helper function to check if a genre keyword exists as a whole word
  // Handles both single words and hyphenated words (e.g., "sci-fi")
  const hasGenre = (keyword: string): boolean => {
    if (!genre) return false;
    // Split genre string by spaces to get individual genre words
    const genreWords = genre.split(/\s+/);
    // Check if any genre word exactly matches the keyword
    // This ensures "animation" matches but "action" doesn't match "animation"
    return genreWords.some(word => word === keyword);
  };
  
  // Action/Adventure: matches "action" or "adventure" as whole words
  if (hasGenre('action') || hasGenre('adventure')) {
    eligibleCategories.push('Action/Adventure');
    debugLog('Action/Adventure', true, `matched: ${hasGenre('action') ? 'action' : 'adventure'}`);
  }
  
  // Animated: matches "animation" or "animated" as whole words (exact match only)
  // This ensures only actual animated movies match, not movies with "animation" as a substring
  if (hasGenre('animation') || hasGenre('animated')) {
    eligibleCategories.push('Animated');
    const matchedTerm = hasGenre('animation') ? 'animation' : 'animated';
    debugLog('Animated', true, `matched: ${matchedTerm}`);
  }
  
  // Comedy: matches "comedy" as a whole word
  if (hasGenre('comedy')) {
    eligibleCategories.push('Comedy');
    debugLog('Comedy', true, 'matched: comedy');
  }
  
  // Drama/Romance: matches "drama" or "romance" as whole words
  if (hasGenre('drama') || hasGenre('romance')) {
    eligibleCategories.push('Drama/Romance');
    debugLog('Drama/Romance', true, `matched: ${hasGenre('drama') ? 'drama' : 'romance'}`);
  }
  
  // Sci-Fi/Fantasy: matches "sci-fi" (hyphenated) or "fantasy" as whole words
  // Note: "sci-fi" is stored as a hyphenated word, so we check for exact match
  if (hasGenre('sci-fi') || hasGenre('fantasy')) {
    eligibleCategories.push('Sci-Fi/Fantasy');
    debugLog('Sci-Fi/Fantasy', true, `matched: ${hasGenre('sci-fi') ? 'sci-fi' : 'fantasy'}`);
  }
  
  // Horror/Thriller: matches "horror" or "thriller" as whole words
  if (hasGenre('horror') || hasGenre('thriller')) {
    eligibleCategories.push('Horror/Thriller');
    debugLog('Horror/Thriller', true, `matched: ${hasGenre('horror') ? 'horror' : 'thriller'}`);
  }

  // Academy Award category - using actual Oscar data
  // Check both hasOscar flag and oscar_status directly for better reliability
  if (allCategories.includes('Academy Award Nominee or Winner')) {
    const hasOscarFlag = movie.hasOscar === true;
    const hasOscarStatus = movie.oscar_status === 'winner' || movie.oscar_status === 'nominee';
    
    if (hasOscarFlag || hasOscarStatus) {
      eligibleCategories.push('Academy Award Nominee or Winner');
    }
  }
  
  // Blockbuster category - using actual budget/revenue data
  if (movie.isBlockbuster && allCategories.includes('Blockbuster (minimum of $50 Mil)')) {
    eligibleCategories.push('Blockbuster (minimum of $50 Mil)');
  }

  // Filter to only return categories that exist in the draft's category list
  const filtered = eligibleCategories.filter(category => allCategories.includes(category));
  
  // Final debug log
  if (filtered.length > 0) {
    console.log(`getEligibleCategories: "${movie.title}" (genre: "${movie.genre}") → Final eligible: [${filtered.join(', ')}]`);
  }
  
  return filtered;
};
