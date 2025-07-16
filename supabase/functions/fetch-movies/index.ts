import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Rate limiting for OMDb API calls
let omdbCallsToday = 0;
const OMDB_DAILY_LIMIT = 900; // Stay under 1000 limit
let lastResetDate = new Date().toDateString();

// Initialize Supabase client for oscar_cache
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to check and get Oscar status from cache or OMDb
async function getOscarStatus(tmdbId: number, title: string, year: number): Promise<string> {
  try {
    // Reset daily counter if needed
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      omdbCallsToday = 0;
      lastResetDate = today;
    }

    // First check cache
    const { data: cached } = await supabase
      .from('oscar_cache')
      .select('oscar_status')
      .eq('tmdb_id', tmdbId)
      .single();

    if (cached) {
      console.log(`Oscar cache hit for "${title}": ${cached.oscar_status}`);
      return cached.oscar_status;
    }

    // Check rate limit
    if (omdbCallsToday >= OMDB_DAILY_LIMIT) {
      console.log(`OMDb rate limit reached for today (${omdbCallsToday}/${OMDB_DAILY_LIMIT})`);
      return 'none';
    }

    // Call OMDb API
    const omdbApiKey = Deno.env.get('OMDB');
    if (!omdbApiKey) {
      console.log('OMDb API key not configured');
      return 'none';
    }

    const omdbUrl = `http://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(title)}&y=${year}`;
    console.log(`Calling OMDb for "${title}" (${year}):`, omdbUrl);
    
    const response = await fetch(omdbUrl);
    const data = await response.json();
    omdbCallsToday++;

    let oscarStatus = 'none';
    let awardsData = '';

    if (data.Response === 'True' && data.Awards) {
      awardsData = data.Awards;
      console.log(`OMDb awards for "${title}": ${awardsData}`);
      
      const awards = awardsData.toLowerCase();
      if (awards.includes('won') && (awards.includes('oscar') || awards.includes('academy award'))) {
        oscarStatus = 'winner';
      } else if (awards.includes('nominated') && (awards.includes('oscar') || awards.includes('academy award'))) {
        oscarStatus = 'nominee';
      }
    }

    // Cache the result
    await supabase.from('oscar_cache').insert({
      tmdb_id: tmdbId,
      movie_title: title,
      movie_year: year,
      oscar_status: oscarStatus,
      awards_data: awardsData
    });

    console.log(`OMDb result for "${title}": ${oscarStatus}`);
    return oscarStatus;

  } catch (error) {
    console.error(`Error getting Oscar status for "${title}":`, error);
    return 'none';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse JSON request directly with timeout
    const requestData = await Promise.race([
      req.json(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request parsing timeout')), 5000))
    ]);
    
    console.log('Parsed request data:', requestData);
    
    const { searchQuery, category, page = 1, fetchAll = false } = requestData;
    const tmdbApiKey = Deno.env.get('TMDB');

    if (!tmdbApiKey) {
      throw new Error('TMDB API key not configured');
    }

    console.log('Fetch movies request:', { category, searchQuery, page, fetchAll });

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
        // Use searchQuery as the year parameter and ensure it's a valid year
        const year = searchQuery || new Date().getFullYear();
        console.log('Searching for movies from year:', year);
        
        // Validate year is a reasonable number
        const yearNum = parseInt(year.toString());
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 5) {
          console.error('Invalid year provided:', year);
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: `Invalid year: ${year}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${yearNum}&sort_by=popularity.desc`;
        url = `${baseUrl}&page=${page}`;
        console.log('Year search URL:', url);
        break;
      case 'person':
        // First, search for the person to get their ID
        const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
        console.log('Searching for person:', searchQuery);
        
        try {
          const personResponse = await fetch(personSearchUrl);
          if (!personResponse.ok) {
            throw new Error(`Person search failed: ${personResponse.status}`);
          }
          const personData = await personResponse.json();
          
          if (personData.results && personData.results.length > 0) {
            const selectedPerson = personData.results[0];
            console.log('Found person:', selectedPerson.name, 'ID:', selectedPerson.id);
            baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_people=${selectedPerson.id}&sort_by=popularity.desc`;
            url = `${baseUrl}&page=${page}`;
          } else {
            console.log('No person found for query:', searchQuery);
            return new Response(JSON.stringify({
              results: [],
              total_pages: 0,
              total_results: 0,
              page: 1
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (personError) {
          console.error('Error searching for person:', personError);
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
      case 'all':
        // Search across all movies using multiple endpoints
        baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&sort_by=popularity.desc`;
        url = `${baseUrl}&page=${page}`;
        break;
      default:
        baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
        url = `${baseUrl}&page=${page}`;
    }

    console.log('Making request to:', url);

    let data;
    
    if (fetchAll) {
      // Fetch ALL pages for comprehensive results
      const allResults = [];
      const seenMovieIds = new Set(); // Track movie IDs to prevent duplicates
      let currentPage = 1;
      let totalPages = 1;
      
      // For "all" category, fetch from multiple sources
      if (category === 'all') {
        const sources = [
          `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`,
          `https://api.themoviedb.org/3/movie/top_rated?api_key=${tmdbApiKey}`,
          `https://api.themoviedb.org/3/movie/now_playing?api_key=${tmdbApiKey}`,
          `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&sort_by=popularity.desc`,
          `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&sort_by=vote_average.desc&vote_count.gte=1000`,
        ];
        
        for (const sourceUrl of sources) {
          let sourcePage = 1;
          let sourceMaxPages = 1;
          
          // Get first page to determine total pages for this source
          const initialResponse = await fetch(`${sourceUrl}&page=1`);
          const initialData = await initialResponse.json();
          sourceMaxPages = Math.min(initialData.total_pages || 1, 50); // Cap at 50 pages per source
          
          while (sourcePage <= sourceMaxPages && allResults.length < 2000) { // Cap at 2000 total results
            const pageUrl = `${sourceUrl}&page=${sourcePage}`;
            console.log(`Fetching from source page ${sourcePage}/${sourceMaxPages}:`, pageUrl);
            
            try {
              const response = await fetch(pageUrl);
              const pageData = await response.json();
              
              if (pageData.results && pageData.results.length > 0) {
                // Filter out duplicates based on movie ID
                const newMovies = pageData.results.filter((movie: any) => {
                  if (seenMovieIds.has(movie.id)) {
                    return false;
                  }
                  seenMovieIds.add(movie.id);
                  return true;
                });
                allResults.push(...newMovies);
              }
              
              if (pageData.results?.length === 0) {
                break;
              }
            } catch (error) {
              console.error(`Error fetching from source page ${sourcePage}:`, error);
            }
            
            sourcePage++;
          }
        }
      } else {
        // For specific categories (like year), fetch ALL available pages
        console.log('Fetching all pages for category:', category);
        
        // First, get the first page to determine total pages
        try {
          const initialResponse = await fetch(`${baseUrl}&page=1`);
          if (!initialResponse.ok) {
            throw new Error(`Initial fetch failed: ${initialResponse.status} ${initialResponse.statusText}`);
          }
          const initialData = await initialResponse.json();
          totalPages = initialData.total_pages || 1;
          
          console.log(`Total pages available: ${totalPages}`);
          
          // Fetch limited pages to prevent timeout
          const maxPagesToFetch = Math.min(totalPages, 10); // Reduced to 10 for faster response
          
          while (currentPage <= maxPagesToFetch) {
            const pageUrl = `${baseUrl}&page=${currentPage}`;
            console.log(`Fetching page ${currentPage}/${maxPagesToFetch}:`, pageUrl);
            
            try {
              const response = await Promise.race([
                fetch(pageUrl),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 10000))
              ]);
              if (!response.ok) {
                console.error(`Page ${currentPage} fetch failed: ${response.status} ${response.statusText}`);
                break;
              }
              let pageData;
              try {
                pageData = await response.json();
              } catch (jsonError) {
                console.error(`Error parsing JSON for page ${currentPage}:`, jsonError);
                break;
              }
              
              if (pageData.results && pageData.results.length > 0) {
                // Filter out duplicates based on movie ID
                const newMovies = pageData.results.filter((movie: any) => {
                  if (seenMovieIds.has(movie.id)) {
                    return false;
                  }
                  seenMovieIds.add(movie.id);
                  return true;
                });
                allResults.push(...newMovies);
                console.log(`Page ${currentPage}: Added ${newMovies.length} new movies (${pageData.results.length - newMovies.length} duplicates filtered). Total unique: ${allResults.length}`);
              } else {
                console.log(`Page ${currentPage}: No results, stopping fetch`);
                break;
              }
              
              // Stop if we've reached the actual last page
              if (currentPage >= (pageData.total_pages || 1)) {
                console.log(`Reached last page: ${currentPage}`);
                break;
              }
            } catch (error) {
              console.error(`Error fetching page ${currentPage}:`, error);
              // Continue to next page on error
            }
            
            currentPage++;
          }
        } catch (initialError) {
          console.error('Error in initial fetch:', initialError);
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: `Failed to fetch movies: ${initialError.message}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
      }
      
      console.log(`Fetching complete. Total unique movies found: ${allResults.length}`);
      
      data = {
        results: allResults,
        total_pages: Math.ceil(allResults.length / 20),
        total_results: allResults.length,
        page: 1
      };
    } else {
      try {
        const response = await Promise.race([
          fetch(url),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 10000))
        ]);
        if (!response.ok) {
          throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
        }
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('Error parsing TMDB JSON response:', jsonError);
          throw new Error('Invalid JSON response from TMDB');
        }
      } catch (fetchError) {
        console.error('Error fetching from TMDB:', fetchError);
        return new Response(JSON.stringify({
          results: [],
          total_pages: 0,
          total_results: 0,
          page: 1,
          error: `TMDB fetch failed: ${fetchError.message}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    console.log('TMDB API response:', data);

    // Optimized movie data transformation - skip expensive operations for better performance
    const transformedMovies = (data.results || []).map((movie: any) => {
      // Use basic blockbuster detection based on popularity and vote count
      const isBlockbuster = movie.vote_count > 5000 && movie.vote_average > 7.0;
      
      // Skip detailed API calls and Oscar status lookup for faster response
      // These can be fetched on-demand later if needed

      return {
        id: movie.id,
        title: movie.title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
        genre: movie.genre_ids?.[0] ? getGenreName(movie.genre_ids[0]) : 'Unknown',
        director: 'Unknown',
        runtime: 120, // Default runtime
        poster: getMovieEmoji(movie.genre_ids?.[0]),
        description: movie.overview || 'No description available',
        isDrafted: false,
        tmdbId: movie.id,
        posterPath: movie.poster_path,
        backdropPath: movie.backdrop_path,
        voteAverage: movie.vote_average,
        releaseDate: movie.release_date,
        budget: 0, // Skip expensive budget lookup
        revenue: 0, // Skip expensive revenue lookup
        hasOscar: false, // Skip expensive Oscar lookup
        isBlockbuster
      };
    });

    console.log('Returning transformed movies:', transformedMovies.length);

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
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      results: [],
      total_pages: 0,
      total_results: 0,
      page: 1
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
