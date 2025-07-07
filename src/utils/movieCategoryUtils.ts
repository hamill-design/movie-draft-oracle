
interface Movie {
  id: number;
  title: string;
  year: number;
  genre: string;
  voteAverage?: number;
  releaseDate?: string;
  hasOscar?: boolean;
  isBlockbuster?: boolean;
  budget?: number;
  revenue?: number;
}

export const getEligibleCategories = (movie: Movie, allCategories: string[]): string[] => {
  if (!movie) return [];

  const eligibleCategories: string[] = [];

  // Year-based categories
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
  const genre = movie.genre?.toLowerCase() || '';
  
  if (genre.includes('action') || genre.includes('adventure')) {
    eligibleCategories.push('Action/Adventure');
  }
  if (genre.includes('animation') || genre.includes('animated')) {
    eligibleCategories.push('Animated');
  }
  if (genre.includes('comedy')) {
    eligibleCategories.push('Comedy');
  }
  if (genre.includes('drama') || genre.includes('romance')) {
    eligibleCategories.push('Drama/Romance');
  }
  if (genre.includes('sci-fi') || genre.includes('science fiction') || genre.includes('fantasy')) {
    eligibleCategories.push('Sci-Fi/Fantasy');
  }
  if (genre.includes('horror') || genre.includes('thriller')) {
    eligibleCategories.push('Horror/Thriller');
  }

  // Academy Award category - using actual Oscar data
  if (movie.hasOscar && allCategories.includes('Academy Award Nominee or Winner')) {
    eligibleCategories.push('Academy Award Nominee or Winner');
  }
  
  // Blockbuster category - using actual budget/revenue data
  if (movie.isBlockbuster && allCategories.includes('Blockbuster (minimum of $50 Mil)')) {
    eligibleCategories.push('Blockbuster (minimum of $50 Mil)');
  }

  // Filter to only return categories that exist in the draft's category list
  return eligibleCategories.filter(category => allCategories.includes(category));
};
