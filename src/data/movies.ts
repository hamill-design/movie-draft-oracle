
import { supabase } from '@/integrations/supabase/client';

export interface Movie {
  id: number;
  title: string;
  year: number;
  genre: string;
  director: string;
  runtime: number;
  poster: string;
  description: string;
  isDrafted: boolean;
  scores?: {
    plot: number;
    acting: number;
    cinematography: number;
    direction: number;
    overall: number;
  };
  // Additional TMDB fields
  tmdbId?: number;
  posterPath?: string;
  backdropPath?: string;
  voteAverage?: number;
  releaseDate?: string;
}

// Keep the original movies as fallback/demo data
export const moviesDatabase: Movie[] = [
  {
    id: 1,
    title: "Dune",
    year: 2021,
    genre: "Sci-Fi",
    director: "Denis Villeneuve",
    runtime: 155,
    poster: "🏜️",
    description: "A noble family becomes embroiled in a war for control over the galaxy's most valuable asset.",
    isDrafted: false
  },
  {
    id: 2,
    title: "The Batman",
    year: 2022,
    genre: "Action",
    director: "Matt Reeves",
    runtime: 176,
    poster: "🦇",
    description: "Batman ventures into Gotham City's underworld when a sadistic killer leaves behind a trail of cryptic clues.",
    isDrafted: false
  },
  {
    id: 3,
    title: "Everything Everywhere All at Once",
    year: 2022,
    genre: "Comedy",
    director: "Daniels",
    runtime: 139,
    poster: "🌌",
    description: "A Chinese-American woman gets swept up in an insane adventure in which she alone can save existence.",
    isDrafted: false
  },
  {
    id: 4,
    title: "Top Gun: Maverick",
    year: 2022,
    genre: "Action",
    director: "Joseph Kosinski",
    runtime: 130,
    poster: "✈️",
    description: "After thirty years, Maverick is still pushing the envelope as a top naval aviator.",
    isDrafted: false
  },
  {
    id: 5,
    title: "Parasite",
    year: 2019,
    genre: "Thriller",
    director: "Bong Joon-ho",
    runtime: 132,
    poster: "🏠",
    description: "A poor family schemes to become employed by a wealthy family by infiltrating their household.",
    isDrafted: false
  },
  {
    id: 6,
    title: "Oppenheimer",
    year: 2023,
    genre: "Biography",
    director: "Christopher Nolan",
    runtime: 180,
    poster: "💥",
    description: "The story of American scientist J. Robert Oppenheimer and his role in developing the atomic bomb.",
    isDrafted: false
  }
];

// Hook to fetch movies from TMDB
export const useMovieSearch = () => {
  const fetchMovies = async (category: string, searchQuery?: string, page: number = 1) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-movies', {
        body: { category, searchQuery, page }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching movies:', error);
      throw error;
    }
  };

  return { fetchMovies };
};
