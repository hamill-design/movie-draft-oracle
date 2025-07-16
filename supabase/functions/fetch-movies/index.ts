import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetch movies request received');
    
    let requestData;
    try {
      requestData = await req.json();
      console.log('Request data:', requestData);
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError);
      return new Response(JSON.stringify({
        results: [],
        total_pages: 0,
        total_results: 0,
        page: 1,
        error: 'Invalid request format'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    const { searchQuery, category, page = 1 } = requestData;
    const tmdbApiKey = Deno.env.get('TMDB');

    if (!tmdbApiKey) {
      console.error('TMDB API key not configured');
      return new Response(JSON.stringify({
        results: [],
        total_pages: 0,
        total_results: 0,
        page: 1,
        error: 'TMDB API key not configured'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log('Processing request:', { category, searchQuery, page });

    let url = '';
    
    // Build API endpoint based on category
    switch (category) {
      case 'popular':
        url = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&page=${page}`;
        break;
      case 'search':
        if (!searchQuery) {
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: 'Search query required'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
        url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}&page=${page}`;
        break;
      case 'year':
        const year = searchQuery || new Date().getFullYear();
        const yearNum = parseInt(year.toString());
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 5) {
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: `Invalid year: ${year}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${yearNum}&sort_by=popularity.desc&page=${page}`;
        break;
      case 'person':
        if (!searchQuery) {
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: 'Person name required'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
        
        try {
          // First search for the person
          const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
          console.log('Searching for person:', searchQuery);
          
          const personResponse = await fetch(personSearchUrl);
          if (!personResponse.ok) {
            throw new Error(`Person search failed: ${personResponse.status}`);
          }
          
          let personData;
          try {
            personData = await personResponse.json();
          } catch (jsonError) {
            console.error('Error parsing person search JSON:', jsonError);
            throw new Error('Invalid response from person search');
          }
          
          if (!personData.results || personData.results.length === 0) {
            return new Response(JSON.stringify({
              results: [],
              total_pages: 0,
              total_results: 0,
              page: 1,
              error: `No person found for: ${searchQuery}`
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          const selectedPerson = personData.results[0];
          console.log('Found person:', selectedPerson.name, 'ID:', selectedPerson.id);
          url = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_people=${selectedPerson.id}&sort_by=popularity.desc&page=${page}`;
          
        } catch (personError) {
          console.error('Error in person search:', personError);
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: `Person search failed: ${personError.message}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        break;
      default:
        url = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&page=${page}`;
    }

    console.log('TMDB URL:', url);

    // Make request to TMDB
    let response;
    try {
      response = await fetch(url);
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError) {
      console.error('TMDB fetch error:', fetchError);
      return new Response(JSON.stringify({
        results: [],
        total_pages: 0,
        total_results: 0,
        page: 1,
        error: `Failed to fetch from TMDB: ${fetchError.message}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Parse TMDB response
    let data;
    try {
      const responseText = await response.text();
      console.log('TMDB response length:', responseText.length);
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from TMDB');
      }
      
      data = JSON.parse(responseText);
      console.log('TMDB data parsed successfully, results count:', data.results?.length || 0);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return new Response(JSON.stringify({
        results: [],
        total_pages: 0,
        total_results: 0,
        page: 1,
        error: 'Invalid response format from TMDB'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Transform movie data
    const transformedMovies = (data.results || []).map((movie: any) => ({
      id: movie.id,
      title: movie.title || 'Unknown Title',
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
      genre: movie.genre_ids?.[0] ? getGenreName(movie.genre_ids[0]) : 'Unknown',
      director: 'Unknown',
      runtime: 120,
      poster: getMovieEmoji(movie.genre_ids?.[0]),
      description: movie.overview || 'No description available',
      isDrafted: false,
      tmdbId: movie.id,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      voteAverage: movie.vote_average || 0,
      releaseDate: movie.release_date,
      budget: 0,
      revenue: 0,
      hasOscar: false,
      isBlockbuster: (movie.vote_count || 0) > 5000 && (movie.vote_average || 0) > 7.0
    }));

    console.log('Returning', transformedMovies.length, 'transformed movies');

    return new Response(JSON.stringify({
      results: transformedMovies,
      total_pages: data.total_pages || 1,
      total_results: data.total_results || transformedMovies.length,
      page: data.page || page
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error in fetch-movies:', error);
    return new Response(JSON.stringify({
      results: [],
      total_pages: 0,
      total_results: 0,
      page: 1,
      error: `Unexpected error: ${error.message || 'Unknown error'}`
    }), {
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
