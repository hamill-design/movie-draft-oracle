
// Helper functions for movie data transformation and enhancement

export interface MovieData {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  genre_ids: number[];
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  runtime?: number;
}

export interface PersonData {
  id: number;
  name: string;
  known_for_department: string;
  known_for: any[];
  profile_path: string;
  popularity: number;
}

export interface EnhancedMovieData {
  hasOscar: boolean;
  isBlockbuster: boolean;
}

// Helper function to get enhanced movie data (optimized for fewer calls)
export const getEnhancedMovieData = async (movie: MovieData, tmdbApiKey: string): Promise<EnhancedMovieData> => {
  try {
    // Use the movie details endpoint which includes budget/revenue
    const detailsUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${tmdbApiKey}&append_to_response=keywords`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();
    
    // Check for Oscar keywords
    const oscarKeywords = detailsData.keywords?.keywords?.filter((keyword: any) => 
      keyword.name.toLowerCase().includes('oscar') ||
      keyword.name.toLowerCase().includes('academy award') ||
      keyword.name.toLowerCase().includes('academy-award')
    ) || [];
    
    const hasOscar = oscarKeywords.length > 0;
    
    // Check for blockbuster status using budget/revenue
    const budget = detailsData.budget || 0;
    const revenue = detailsData.revenue || 0;
    const isBlockbuster = revenue > 50000000 || budget > 30000000;
    
    return { hasOscar, isBlockbuster };
  } catch (error) {
    console.error(`Error fetching enhanced data for movie ${movie.id}:`, error);
    return { hasOscar: false, isBlockbuster: false };
  }
};

// Transform TMDB movie data to our format
export const transformMovieData = async (
  movie: MovieData, 
  index: number, 
  shouldEnhance: boolean, 
  tmdbApiKey: string
) => {
  let hasOscar = false;
  let isBlockbuster = false;
  
  // Only fetch enhanced data for smaller batches or first few movies
  if (shouldEnhance || index < 20) {
    const enhanced = await getEnhancedMovieData(movie, tmdbApiKey);
    hasOscar = enhanced.hasOscar;
    isBlockbuster = enhanced.isBlockbuster;
  }

  return {
    id: movie.id,
    title: movie.title,
    year: new Date(movie.release_date).getFullYear() || 0,
    genre: movie.genre_ids?.[0] ? getGenreName(movie.genre_ids[0]) : 'Unknown',
    director: 'Unknown',
    runtime: movie.runtime || 120,
    poster: getMovieEmoji(movie.genre_ids?.[0]),
    description: movie.overview || 'No description available',
    isDrafted: false,
    tmdbId: movie.id,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    voteAverage: movie.vote_average,
    releaseDate: movie.release_date,
    hasOscar,
    isBlockbuster
  };
};

// Transform person data to our format
export const transformPersonData = (person: PersonData) => ({
  id: person.id,
  title: person.name,
  year: 0,
  genre: person.known_for_department || 'Unknown',
  director: 'N/A',
  runtime: 0,
  poster: getPersonEmoji(person.known_for_department),
  description: `Known for: ${person.known_for?.map((item: any) => item.title || item.name).join(', ') || 'Various works'}`,
  isDrafted: false,
  tmdbId: person.id,
  posterPath: person.profile_path,
  backdropPath: null,
  voteAverage: person.popularity,
  releaseDate: null,
  knownForDepartment: person.known_for_department
});

// Helper function to map genre IDs to names
export function getGenreName(genreId: number): string {
  const genres: { [key: number]: string } = {
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
    878: 'Sci-Fi',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western'
  };
  return genres[genreId] || 'Unknown';
}

// Helper function to get movie emoji based on genre
export function getMovieEmoji(genreId: number): string {
  const emojiMap: { [key: number]: string } = {
    28: '💥', // Action
    12: '🗺️', // Adventure
    16: '🎨', // Animation
    35: '😂', // Comedy
    80: '🔫', // Crime
    99: '📽️', // Documentary
    18: '🎭', // Drama
    10751: '👨‍👩‍👧‍👦', // Family
    14: '🧙‍♂️', // Fantasy
    36: '🏛️', // History
    27: '👻', // Horror
    10402: '🎵', // Music
    9648: '🔍', // Mystery
    10749: '💕', // Romance
    878: '🚀', // Sci-Fi
    53: '😰', // Thriller
    10752: '⚔️', // War
    37: '🤠'  // Western
  };
  return emojiMap[genreId] || '🎬';
}

// Helper function to get person emoji based on department
export function getPersonEmoji(department: string): string {
  const emojiMap: { [key: string]: string } = {
    'Acting': '🎭',
    'Directing': '🎬',
    'Writing': '✍️',
    'Production': '🎞️',
    'Camera': '📷',
    'Editing': '✂️',
    'Sound': '🔊',
    'Art': '🎨',
    'Costume & Make-Up': '👗',
    'Visual Effects': '✨'
  };
  return emojiMap[department] || '👤';
}
