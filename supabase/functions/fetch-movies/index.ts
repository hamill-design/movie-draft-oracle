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
        baseUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}&sort_by=popularity.desc`;
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
        // Fetch popular movies from different decades to ensure variety
        baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
        url = `${baseUrl}&page=${page}`;
        break;
      default:
        baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
        url = `${baseUrl}&page=${page}`;
    }

    console.log('Making request to:', url);

    let data;
    
    if (fetchAll) {
      // Fetch multiple pages but limit to prevent resource exhaustion
      const allResults = [];
      let currentPage = 1;
      const maxPages = 15; // Further reduced for performance
      
      // For "all" category, fetch popular movies from different decades
      if (category === 'all') {
        const decades = [
          { start: 2020, end: 2024, name: '2020s' },
          { start: 2010, end: 2019, name: '2010s' },
          { start: 2000, end: 2009, name: '2000s' },
          { start: 1990, end: 1999, name: '1990s' },
          { start: 1980, end: 1989, name: '1980s' },
          { start: 1970, end: 1979, name: '1970s' }
        ];
        
        for (const decade of decades) {
          let sourcePage = 1;
          const sourceMaxPages = 3; // 3 pages per decade for variety
          
          while (sourcePage <= sourceMaxPages && allResults.length < 1000) {
            const pageUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_date.gte=${decade.start}-01-01&primary_release_date.lte=${decade.end}-12-31&sort_by=popularity.desc&page=${sourcePage}`;
            console.log(`Fetching ${decade.name} page ${sourcePage}/${sourceMaxPages}`);
            
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
              console.error(`Error fetching ${decade.name} page ${sourcePage}:`, error);
            }
            
            sourcePage++;
          }
        }
      } else {
        // For specific categories, fetch limited pages
        console.log('Fetching multiple pages for category:', category);
        
        // First, get the first page to determine total pages
        const initialResponse = await fetch(`${baseUrl}&page=1`);
        const initialData = await initialResponse.json();
        const totalPages = Math.min(initialData.total_pages || 1, maxPages);
        
        console.log(`Total pages to fetch: ${totalPages}`);
        
        while (currentPage <= totalPages) {
          const pageUrl = `${baseUrl}&page=${currentPage}`;
          console.log(`Fetching page ${currentPage}/${totalPages}`);
          
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
          } catch (error) {
            console.error(`Error fetching page ${currentPage}:`, error);
          }
          
          currentPage++;
        }
      }
      
      // Sort results by popularity score (combination of vote_average and popularity)
      allResults.sort((a: any, b: any) => {
        const aScore = calculatePopularityScore(a);
        const bScore = calculatePopularityScore(b);
        return bScore - aScore;
      });
      
      // Limit to top 1000 most popular movies
      const topResults = allResults.slice(0, 1000);
      
      console.log(`Fetching complete. Total movies found: ${allResults.length}, returning top ${topResults.length}`);
      
      data = {
        results: topResults,
        total_pages: Math.ceil(topResults.length / 20),
        total_results: topResults.length,
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
        isBlockbuster,
        popularity: movie.popularity || 0
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

// Function to calculate popularity score combining multiple factors
function calculatePopularityScore(movie: any): number {
  const popularity = movie.popularity || 0;
  const voteAverage = movie.vote_average || 0;
  const voteCount = movie.vote_count || 0;
  
  // Weighted score: popularity (60%) + vote quality (25%) + vote count factor (15%)
  const voteCountFactor = Math.min(voteCount / 1000, 10); // Cap at 10x multiplier
  const voteQuality = voteAverage > 6 ? voteAverage : voteAverage * 0.5; // Penalize low ratings
  
  return (popularity * 0.6) + (voteQuality * 25 * 0.25) + (voteCountFactor * 10 * 0.15);
}

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
