
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchQuery, category, page = 1 } = await req.json();
    const tmdbApiKey = Deno.env.get('TMDB');

    if (!tmdbApiKey) {
      throw new Error('TMDB API key not configured');
    }

    let url = '';
    
    // Build different API endpoints based on category
    switch (category) {
      case 'popular':
        url = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&page=${page}`;
        break;
      case 'search':
        url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}&page=${page}`;
        break;
      case 'year':
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${searchQuery}&page=${page}`;
        break;
      case 'person':
        // Search for person directly and return person results
        url = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}&page=${page}`;
        
        const personResponse = await fetch(url);
        const personData = await personResponse.json();
        
        // Transform person data to match our Movie interface (reusing for person data)
        const transformedPeople = personData.results?.map((person: any) => ({
          id: person.id,
          title: person.name, // Use person name as title
          year: 0, // Not applicable for people
          genre: person.known_for_department || 'Unknown',
          director: 'Person', // Mark as person type
          runtime: 0,
          poster: getPersonEmoji(person.known_for_department),
          description: `Known for: ${person.known_for?.map((item: any) => item.title || item.name).slice(0, 3).join(', ') || 'Various works'}`,
          isDrafted: false,
          tmdbId: person.id,
          posterPath: person.profile_path,
          backdropPath: null,
          voteAverage: person.popularity,
          releaseDate: null
        })) || [];

        return new Response(JSON.stringify({
          results: transformedPeople,
          total_pages: personData.total_pages,
          total_results: personData.total_results,
          page: personData.page
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      default:
        url = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&page=${page}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    // Transform TMDB data to match our Movie interface
    const transformedMovies = data.results?.map((movie: any) => ({
      id: movie.id,
      title: movie.title,
      year: new Date(movie.release_date).getFullYear() || 0,
      genre: movie.genre_ids?.[0] ? getGenreName(movie.genre_ids[0]) : 'Unknown',
      director: 'Unknown', // We'd need additional API call to get director
      runtime: movie.runtime || 120,
      poster: getMovieEmoji(movie.genre_ids?.[0]),
      description: movie.overview || 'No description available',
      isDrafted: false,
      tmdbId: movie.id,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      voteAverage: movie.vote_average,
      releaseDate: movie.release_date
    })) || [];

    return new Response(JSON.stringify({
      results: transformedMovies,
      total_pages: data.total_pages,
      total_results: data.total_results,
      page: data.page
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching movies from TMDB:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to map genre IDs to names
function getGenreName(genreId: number): string {
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
function getMovieEmoji(genreId: number): string {
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
function getPersonEmoji(department: string): string {
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
