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
          
          // Fetch all pages (with reasonable limit to prevent timeout)
          const maxPagesToFetch = Math.min(totalPages, 100); // Reduced from 500 to 100 for faster response
          
          while (currentPage <= maxPagesToFetch) {
            const pageUrl = `${baseUrl}&page=${currentPage}`;
            console.log(`Fetching page ${currentPage}/${maxPagesToFetch}:`, pageUrl);
            
            try {
              const response = await fetch(pageUrl);
              if (!response.ok) {
                console.error(`Page ${currentPage} fetch failed: ${response.status} ${response.statusText}`);
                break;
              }
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
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
        }
        data = await response.json();
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
          
          console.log(`DEBUG Oscar Detection for "${movie.title}": Found ${keywords.length} keywords`);
          
          // Check for Oscar-related keywords
          const oscarKeywords = ['oscar', 'academy award', 'academy awards', 'oscar nomination', 'oscar winner', 'oscar nominated'];
          hasOscar = keywords.some((keyword: any) => {
            const isOscarKeyword = oscarKeywords.some(oscarKeyword => 
              keyword.name.toLowerCase().includes(oscarKeyword)
            );
            if (isOscarKeyword) {
              console.log(`DEBUG: Found Oscar keyword for "${movie.title}": ${keyword.name}`);
            }
            return isOscarKeyword;
          });
          
          if (hasOscar) {
            console.log(`DEBUG: "${movie.title}" detected as Oscar movie via keywords`);
          }
        }

        // Improved Oscar detection fallback
        if (!hasOscar) {
          // More inclusive heuristic for Oscar nominees/winners
          // La La Land criteria: rating >= 7.5, votes >= 1000, music/drama/romance genres, post-2000
          const isWellRated = detailedMovie.vote_average >= 7.5 && detailedMovie.vote_count >= 1000;
          const hasPrestigiousGenre = detailedMovie.genres?.some((g: any) => 
            ['Drama', 'Music', 'Romance', 'History', 'Biography', 'War'].includes(g.name)
          );
          const isRecentEnough = detailedMovie.release_date && new Date(detailedMovie.release_date).getFullYear() >= 2000;
          
          console.log(`DEBUG Improved Oscar Detection for "${movie.title}": rating=${detailedMovie.vote_average}, votes=${detailedMovie.vote_count}, hasPrestigiousGenre=${hasPrestigiousGenre}, year=${detailedMovie.release_date ? new Date(detailedMovie.release_date).getFullYear() : 'unknown'}`);
          
          // Check for known Oscar patterns in title or description
          const titleAndOverview = `${movie.title} ${movie.overview || ''}`.toLowerCase();
          const oscarIndicators = [
            'academy award', 'oscar', 'nominated', 'winner', 'best picture', 
            'critically acclaimed', 'award-winning', 'masterpiece'
          ];
          const hasOscarIndicators = oscarIndicators.some(indicator => 
            titleAndOverview.includes(indicator)
          );
          
          // More lenient criteria
          hasOscar = (isWellRated && hasPrestigiousGenre && isRecentEnough) || hasOscarIndicators;
          
          if (hasOscar) {
            console.log(`DEBUG: "${movie.title}" detected as Oscar movie via improved fallback (wellRated=${isWellRated}, prestigiousGenre=${hasPrestigiousGenre}, recent=${isRecentEnough}, indicators=${hasOscarIndicators})`);
          }
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
    return new Response(JSON.stringify({ 
      error: error.message,
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
