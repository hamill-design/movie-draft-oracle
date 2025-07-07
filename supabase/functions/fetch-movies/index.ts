
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
    const { searchQuery, category, page = 1, fetchAll = false } = await req.json();
    const tmdbApiKey = Deno.env.get('TMDB');

    if (!tmdbApiKey) {
      throw new Error('TMDB API key not configured');
    }

    // Helper function to get enhanced movie data (optimized for fewer calls)
    const getEnhancedMovieData = async (movie: any) => {
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

    // Helper function to fetch pages with smart batching
    const fetchWithBatching = async (baseUrl: string, maxMovies = 100) => {
      let allResults: any[] = [];
      let currentPage = 1;
      let totalPages = 1;

      // First, get a reasonable number of pages (limit to prevent timeout)
      const maxPages = Math.min(5, totalPages); // Limit to 5 pages max initially

      do {
        const url = `${baseUrl}&page=${currentPage}`;
        console.log(`Fetching page ${currentPage} of ${Math.min(maxPages, totalPages)}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results) {
          allResults = [...allResults, ...data.results];
        }
        
        totalPages = data.total_pages || 1;
        currentPage++;
        
        // Break if we've reached our limit or max movies
        if (currentPage > maxPages || allResults.length >= maxMovies) break;
        
      } while (currentPage <= totalPages);

      return {
        results: allResults.slice(0, maxMovies), // Ensure we don't exceed max
        total_pages: totalPages,
        total_results: allResults.length,
        page: 1
      };
    };

    let url = '';
    let baseUrl = '';
    
    // Build different API endpoints based on category
    switch (category) {
      case 'popular':
        baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
        url = `${baseUrl}&page=${page}`;
        break;
      case 'search':
        baseUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
        url = `${baseUrl}&page=${page}`;
        break;
      case 'year':
        baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${searchQuery}`;
        url = `${baseUrl}&page=${page}`;
        break;
      case 'person':
        // First, search for the person to get their ID
        const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
        const personResponse = await fetch(personSearchUrl);
        const personData = await personResponse.json();
        
        if (personData.results && personData.results.length > 0) {
          // Find exact match or use the first result
          const exactMatch = personData.results.find((person: any) => 
            person.name.toLowerCase() === searchQuery.toLowerCase()
          );
          const selectedPerson = exactMatch || personData.results[0];
          
          // Search for movies featuring this person
          baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_people=${selectedPerson.id}&sort_by=popularity.desc`;
          url = `${baseUrl}&page=${page}`;
        } else {
          // No person found, return empty results
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;
      case 'person_search':
        // This is for searching people (Home page)
        baseUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
        
        if (fetchAll) {
          const allData = await fetchWithBatching(baseUrl);
          const transformedPeople = allData.results?.map((person: any) => ({
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
          })) || [];

          return new Response(JSON.stringify({
            results: transformedPeople,
            total_pages: allData.total_pages,
            total_results: allData.total_results,
            page: allData.page
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        url = `${baseUrl}&page=${page}`;
        break;
      default:
        baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
        url = `${baseUrl}&page=${page}`;
    }

    let data;
    
    if (fetchAll && baseUrl) {
      console.log('Fetching with smart batching for:', category);
      data = await fetchWithBatching(baseUrl);
    } else {
      const response = await fetch(url);
      data = await response.json();
    }

    // Transform TMDB data with selective enhancement
    const movieCount = data.results?.length || 0;
    console.log(`Processing ${movieCount} movies`);
    
    // Only enhance movies if we have a reasonable number to avoid timeouts
    const shouldEnhance = movieCount <= 50; // Only enhance if 50 movies or fewer
    
    const transformedMovies = await Promise.all(
      (data.results || []).map(async (movie: any, index: number) => {
        let hasOscar = false;
        let isBlockbuster = false;
        
        // Only fetch enhanced data for smaller batches or first few movies
        if (shouldEnhance || index < 20) {
          const enhanced = await getEnhancedMovieData(movie);
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
      })
    );

    console.log(`Returning ${transformedMovies.length} movies${shouldEnhance ? ' with full enhancement' : ' with limited enhancement'}`);

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
