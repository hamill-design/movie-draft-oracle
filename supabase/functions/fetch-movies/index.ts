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
        baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${searchQuery}&sort_by=popularity.desc`;
        url = `${baseUrl}&page=${page}`;
        break;
      case 'person':
        // First, search for the person to get their ID
        const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
        const personResponse = await fetch(personSearchUrl);
        const personData = await personResponse.json();
        
        if (personData.results && personData.results.length > 0) {
          const selectedPerson = personData.results[0];
          baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_people=${selectedPerson.id}&sort_by=popularity.desc`;
          url = `${baseUrl}&page=${page}`;
        } else {
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
                const newMovies = pageData.results.filter((movie: any) => 
                  !allResults.some((existing: any) => existing.id === movie.id)
                );
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
        const initialResponse = await fetch(`${baseUrl}&page=1`);
        const initialData = await initialResponse.json();
        totalPages = initialData.total_pages || 1;
        
        console.log(`Total pages available: ${totalPages}`);
        
        // Fetch all pages (with reasonable limit to prevent timeout)
        const maxPagesToFetch = Math.min(totalPages, 500); // Cap at 500 pages to prevent timeout
        
        while (currentPage <= maxPagesToFetch) {
          const pageUrl = `${baseUrl}&page=${currentPage}`;
          console.log(`Fetching page ${currentPage}/${maxPagesToFetch}:`, pageUrl);
          
          try {
            const response = await fetch(pageUrl);
            const pageData = await response.json();
            
            if (pageData.results && pageData.results.length > 0) {
              allResults.push(...pageData.results);
              console.log(`Page ${currentPage}: Added ${pageData.results.length} movies. Total: ${allResults.length}`);
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
      }
      
      console.log(`Fetching complete. Total movies found: ${allResults.length}`);
      
      data = {
        results: allResults,
        total_pages: Math.ceil(allResults.length / 20),
        total_results: allResults.length,
        page: 1
      };
    } else {
      const response = await fetch(url);
      data = await response.json();
    }

    console.log('TMDB API response:', data);

    // Enhanced movie data transformation with proper Oscar and blockbuster detection
    const transformedMovies = await Promise.all((data.results || []).map(async (movie: any) => {
      let detailedMovie = movie;
      let hasOscar = false;
      let isBlockbuster = false;
      
      try {
        // Get detailed movie information including budget and revenue
        const detailResponse = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${tmdbApiKey}`);
        if (detailResponse.ok) {
          detailedMovie = await detailResponse.json();
          
          // Proper blockbuster detection using actual budget/revenue data
          const budget = detailedMovie.budget || 0;
          const revenue = detailedMovie.revenue || 0;
          isBlockbuster = budget >= 50000000 || revenue >= 100000000;
          
          console.log(`Movie: ${movie.title}, Budget: $${budget}, Revenue: $${revenue}, Blockbuster: ${isBlockbuster}`);
        }

        // Get actual Academy Award nominations/wins using keywords
        const keywordsResponse = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/keywords?api_key=${tmdbApiKey}`);
        if (keywordsResponse.ok) {
          const keywordsData = await keywordsResponse.json();
          const keywords = keywordsData.keywords || [];
          
          // Check for Oscar-related keywords
          const oscarKeywords = ['oscar', 'academy award', 'academy awards', 'oscar nomination', 'oscar winner', 'oscar nominated'];
          hasOscar = keywords.some((keyword: any) => 
            oscarKeywords.some(oscarKeyword => 
              keyword.name.toLowerCase().includes(oscarKeyword)
            )
          );
        }

        // Alternative Oscar detection using external_ids and checking if it's a prestigious film
        if (!hasOscar) {
          // For now, we'll use a combination of high ratings and critical acclaim as a fallback
          // In a production app, you'd want to integrate with a proper awards database
          const isHighlyRated = detailedMovie.vote_average >= 8.0 && detailedMovie.vote_count >= 5000;
          const isDrama = detailedMovie.genres?.some((g: any) => g.name === 'Drama');
          const isPrestigiousYear = detailedMovie.release_date && new Date(detailedMovie.release_date).getFullYear() >= 1990;
          
          // This is still a heuristic, but a more conservative one
          hasOscar = isHighlyRated && isDrama && isPrestigiousYear;
        }
        
      } catch (error) {
        console.log(`Could not fetch detailed info for movie ${movie.id}:`, error);
      }

      return {
        id: movie.id,
        title: movie.title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
        genre: movie.genre_ids?.[0] ? getGenreName(movie.genre_ids[0]) : 'Unknown',
        director: 'Unknown',
        runtime: detailedMovie.runtime || 120,
        poster: getMovieEmoji(movie.genre_ids?.[0]),
        description: movie.overview || 'No description available',
        isDrafted: false,
        tmdbId: movie.id,
        posterPath: movie.poster_path,
        backdropPath: movie.backdrop_path,
        voteAverage: movie.vote_average,
        releaseDate: movie.release_date,
        budget: detailedMovie.budget || 0,
        revenue: detailedMovie.revenue || 0,
        hasOscar,
        isBlockbuster
      };
    }));

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
