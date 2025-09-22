
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting for OMDb API calls
let omdbCallsToday = 0;
const OMDB_DAILY_LIMIT = 900; // Stay under 1000 limit
let lastResetDate = new Date().toDateString();

// Initialize Supabase client for oscar_cache
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to check and get Oscar status from cache, classic database, or OMDb
async function getOscarStatus(tmdbId: number, title: string, year: number, personName?: string): Promise<string> {
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

    // Check classic Oscar database if we have person name
    if (personName) {
      const { data: classicData } = await supabase
        .from('classic_oscar_data')
        .select('oscar_status')
        .ilike('person_name', personName)
        .ilike('movie_title', `%${title}%`)
        .eq('movie_year', year)
        .single();

      if (classicData) {
        console.log(`🏆 Classic Oscar database hit for "${personName}" + "${title}" (${year}): ${classicData.oscar_status}`);
        
        // Cache this result for future use
        await supabase.from('oscar_cache').insert({
          tmdb_id: tmdbId,
          movie_title: title,
          movie_year: year,
          oscar_status: classicData.oscar_status,
          awards_data: `Classic database: ${classicData.oscar_status}`
        });
        
        return classicData.oscar_status;
      }
    }

    // Check rate limit
    if (omdbCallsToday >= OMDB_DAILY_LIMIT) {
      console.log(`OMDb rate limit reached for today (${omdbCallsToday}/${OMDB_DAILY_LIMIT})`);
      return 'none';
    }

    // Call OMDb API as fallback
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

// Enhanced year extraction with multiple date field support
function getYearFromDate(dateString: string): number {
  if (!dateString) return 0;
  
  // Handle various date formats: YYYY-MM-DD, YYYY, partial dates
  const dateStr = dateString.toString().trim();
  
  // Try full ISO date format first
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      if (year > 1900 && year <= new Date().getFullYear() + 5) {
        return year;
      }
    }
  } catch (e) {
    // Continue to regex parsing
  }
  
  // Try regex to extract year from various formats
  const yearMatch = dateStr.match(/(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year > 1900 && year <= new Date().getFullYear() + 5) {
      return year;
    }
  }
  
  return 0;
}

// Enhanced function to extract year from movie with multiple fallbacks
function extractMovieYear(movie: any): number {
  // Try multiple date fields in order of preference
  const dateFields = ['release_date', 'primary_release_date', 'first_air_date'];
  
  for (const field of dateFields) {
    if (movie[field]) {
      const year = getYearFromDate(movie[field]);
      if (year > 0) {
        return year;
      }
    }
  }
  
  // Try direct year field
  if (movie.year && movie.year > 1900) {
    return movie.year;
  }
  
  return 0;
}

// Enhanced function to validate if a movie matches the requested year
function movieMatchesYear(movie: any, requestedYear: number): boolean {
  if (!movie || !requestedYear) return false;
  
  const movieYear = extractMovieYear(movie);
  const matches = movieYear === requestedYear;
  
  if (!matches && Math.random() < 0.1) { // Log 10% of mismatches for debugging
    console.log(`Year mismatch: "${movie.title}" - extracted year: ${movieYear}, requested: ${requestedYear}, release_date: ${movie.release_date}`);
  }
  
  return matches;
}

// Enhanced person validation with career timeline awareness
async function selectBestPersonMatch(personResults: any[], searchQuery: string, tmdbApiKey: string): Promise<any | null> {
  if (!personResults || personResults.length === 0) {
    return null;
  }
  
  const query = searchQuery.toLowerCase().trim();
  console.log(`Selecting best match for "${searchQuery}" from ${personResults.length} candidates`);
  
  // Log all candidates for debugging
  personResults.forEach((person, index) => {
    console.log(`Candidate ${index + 1}: ${person.name} (ID: ${person.id}, popularity: ${person.popularity})`);
  });
  
  // Define known classic actors with career timelines to avoid confusion
  const classicActors = {
    'bette davis': { startYear: 1929, endYear: 1989, tmdbId: null },
    'clark gable': { startYear: 1924, endYear: 1960, tmdbId: null },
    'katharine hepburn': { startYear: 1932, endYear: 1994, tmdbId: null },
    'cary grant': { startYear: 1932, endYear: 1966, tmdbId: null },
    'james stewart': { startYear: 1935, endYear: 1991, tmdbId: null },
    'jimmy stewart': { startYear: 1935, endYear: 1991, tmdbId: null },
    'humphrey bogart': { startYear: 1930, endYear: 1957, tmdbId: null },
    'spencer tracy': { startYear: 1930, endYear: 1967, tmdbId: null }
  };
  
  // Check if this is a known classic actor
  const classicActor = classicActors[query];
  if (classicActor) {
    console.log(`🎬 Identified classic actor: ${query} (active ${classicActor.startYear}-${classicActor.endYear})`);
  }
  
  // Enhanced matching with career validation
  let bestMatch = null;
  let bestScore = 0;
  
  for (const person of personResults) {
    if (!person.name) continue;
    
    const personName = person.name.toLowerCase();
    let score = 0;
    
    // Exact name match gets highest score
    if (personName === query) {
      score = 100;
    } 
    // Handle common name variations
    else if (
      (query === 'jimmy stewart' && personName === 'james stewart') ||
      (query === 'james stewart' && personName === 'jimmy stewart')
    ) {
      score = 95;
    }
    // Partial match with good popularity
    else if (personName.includes(query) && person.popularity > 5) {
      score = 70 + (person.popularity / 100); // Base score + popularity bonus
    }
    // Less specific partial match
    else if (personName.includes(query.split(' ')[0])) {
      score = 30 + (person.popularity / 100);
    }
    
    // For classic actors, validate against known career timeline
    if (classicActor && score > 0) {
      try {
        // Get person details to check birth/death dates
        const detailsUrl = `https://api.themoviedb.org/3/person/${person.id}?api_key=${tmdbApiKey}`;
        const detailsResponse = await fetch(detailsUrl);
        
        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          
          // Extract birth year for validation
          let birthYear = null;
          if (details.birthday) {
            birthYear = new Date(details.birthday).getFullYear();
          }
          
          // Extract death year if available
          let deathYear = null;
          if (details.deathday) {
            deathYear = new Date(details.deathday).getFullYear();
          }
          
          console.log(`Person details: ${person.name} (born: ${birthYear}, died: ${deathYear})`);
          
          // Validate career timeline for classic actors
          if (birthYear) {
            const expectedCareerStart = birthYear + 20; // Rough career start age
            const careerGap = Math.abs(expectedCareerStart - classicActor.startYear);
            
            // If career timeline doesn't match, reduce score significantly
            if (careerGap > 15) {
              console.log(`⚠️ Career timeline mismatch for ${person.name}: expected start ~${classicActor.startYear}, but birth suggests ~${expectedCareerStart}`);
              score *= 0.3; // Reduce score by 70%
            } else {
              console.log(`✅ Career timeline matches for classic actor ${person.name}`);
              score *= 1.2; // Boost score for timeline match
}

// Process movie results with enhanced Oscar and blockbuster detection
async function processMovieResults(data: any, tmdbApiKey: string, personName?: string): Promise<any> {
  console.log('TMDB API response received with', (data.results || []).length, 'movies');
  
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
        
        // Only log occasionally to avoid spam
        if (Math.random() < 0.05) {
          console.log(`Movie: ${movie.title}, Budget: $${budget}, Revenue: $${revenue}, Blockbuster: ${isBlockbuster}`);
        }
      }

      // Get accurate Oscar status from enhanced function with person context
      const movieYear = extractMovieYear(detailedMovie);
      
      // Enhanced logging with more context
      if (Math.random() < 0.05) {
        console.log(`Movie: ${movie.title} - Release Date: ${detailedMovie.release_date}, Primary: ${detailedMovie.primary_release_date}, Extracted Year: ${movieYear}`);
      }
      
      const oscarStatus = await getOscarStatus(movie.id, movie.title, movieYear, personName);
      hasOscar = oscarStatus !== 'none';
      
    } catch (error) {
      console.log(`Could not fetch detailed info for movie ${movie.id}:`, error);
    }

    // Use enhanced year extraction for consistency
    const correctYear = extractMovieYear(detailedMovie);
    
    return {
      id: movie.id,
      title: movie.title,
      year: correctYear,
      // Enhanced debugging info (remove in production)
      year_debug: Math.random() < 0.1 ? {
        release_date: detailedMovie.release_date,
        primary_release_date: detailedMovie.primary_release_date,
        extracted_year: correctYear
      } : undefined,
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
      oscar_status: hasOscar ? 'nominee' : 'none' // Simplified for compatibility
    };
  }));

  console.log('Returning transformed movies:', transformedMovies.length);

  return {
    results: transformedMovies,
    total_pages: data.total_pages,
    total_results: data.total_results,
    page: data.page,
    person_info: data.person_info // Pass through person info if available
  };
}
          }
        }
      } catch (error) {
        console.log(`Could not fetch person details for timeline validation: ${error.message}`);
      }
    }
    
    // Track best match
    if (score > bestScore) {
      bestScore = score;
      bestMatch = person;
    }
    
    console.log(`${person.name}: score = ${score.toFixed(2)}`);
  }
  
  if (bestMatch) {
    console.log(`✅ Best match selected: ${bestMatch.name} (ID: ${bestMatch.id}, score: ${bestScore.toFixed(2)})`);
    return bestMatch;
  }
  
  console.log(`❌ No suitable person match found for: ${searchQuery}`);
  return null;
}

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
        
        // Use multiple TMDB parameters for more precise filtering
        const startDate = `${yearNum}-01-01`;
        const endDate = `${yearNum}-12-31`;
        baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${yearNum}&year=${yearNum}&release_date.gte=${startDate}&release_date.lte=${endDate}&sort_by=popularity.desc`;
        url = `${baseUrl}&page=${page}`;
        console.log('Enhanced year search URL:', url);
        console.log('Using multiple year filters: primary_release_year, year, and release_date range for:', yearNum);
        break;
      case 'person':
        // Enhanced person search with comprehensive filmography retrieval
        const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
        console.log('Searching for person:', searchQuery);
        
        try {
          const personResponse = await fetch(personSearchUrl);
          if (!personResponse.ok) {
            throw new Error(`Person search failed: ${personResponse.status}`);
          }
          const personData = await personResponse.json();
          
          if (personData.results && personData.results.length > 0) {
            // Use enhanced person selection
            const selectedPerson = await selectBestPersonMatch(personData.results, searchQuery, tmdbApiKey);
            
            if (!selectedPerson) {
              console.log('No suitable person match found for query:', searchQuery);
              return new Response(JSON.stringify({
                results: [],
                total_pages: 0,
                total_results: 0,
                page: 1,
                reason: 'No suitable person match found'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            
            console.log('Selected person:', selectedPerson.name, 'ID:', selectedPerson.id, 'Popularity:', selectedPerson.popularity);
            
            // Use person's movie credits instead of discover endpoint for complete filmography
            if (fetchAll) {
              console.log('Fetching complete filmography using person credits endpoint');
              const creditsUrl = `https://api.themoviedb.org/3/person/${selectedPerson.id}/movie_credits?api_key=${tmdbApiKey}`;
              
              try {
                const creditsResponse = await fetch(creditsUrl);
                if (!creditsResponse.ok) {
                  throw new Error(`Credits fetch failed: ${creditsResponse.status}`);
                }
                const creditsData = await creditsResponse.json();
                
                // Get all movies from cast and crew
                const allMovies = [
                  ...(creditsData.cast || []),
                  ...(creditsData.crew || [])
                ];
                
                // Remove duplicates based on movie ID
                const uniqueMovies = allMovies.filter((movie, index, self) => 
                  index === self.findIndex(m => m.id === movie.id)
                );
                
                console.log(`Person credits: ${creditsData.cast?.length || 0} cast + ${creditsData.crew?.length || 0} crew = ${allMovies.length} total, ${uniqueMovies.length} unique movies`);
                
                // Return complete filmography data
                data = {
                  results: uniqueMovies,
                  total_pages: Math.ceil(uniqueMovies.length / 20),
                  total_results: uniqueMovies.length,
                  page: 1,
                  person_info: {
                    id: selectedPerson.id,
                    name: selectedPerson.name,
                    popularity: selectedPerson.popularity
                  }
                };
                
                // Skip normal TMDB API call since we have the data
                return new Response(JSON.stringify(await processMovieResults(data, tmdbApiKey, selectedPerson.name)), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
                
              } catch (creditsError) {
                console.error('Error fetching person credits, falling back to discover:', creditsError);
                // Fallback to discover endpoint
              }
            }
            
            // Fallback to discover endpoint (for single page requests or if credits failed)
            baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_people=${selectedPerson.id}&sort_by=popularity.desc`;
            url = `${baseUrl}&page=${page}`;
            
          } else {
            console.log('No person found for query:', searchQuery);
            return new Response(JSON.stringify({
              results: [],
              total_pages: 0,
              total_results: 0,
              page: 1,
              reason: 'No person found'
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
                // For year category, apply strict filtering on each page
                let pagesToAdd = pageData.results;
                if (category === 'year') {
                  const requestedYear = parseInt(searchQuery);
                  pagesToAdd = pageData.results.filter((movie: any) => movieMatchesYear(movie, requestedYear));
                  console.log(`Page ${currentPage}: ${pageData.results.length} total movies, ${pagesToAdd.length} matching year ${requestedYear}`);
                  
                  // Enhanced logging for year debugging
                  if (pagesToAdd.length < pageData.results.length / 2) {
                    console.log(`Low match rate for year ${requestedYear}. Sample year extraction:`, 
                      pageData.results.slice(0, 3).map((m: any) => ({
                        title: m.title,
                        release_date: m.release_date,
                        extracted_year: extractMovieYear(m)
                      }))
                    );
                  }
                }
                
                // Filter out duplicates based on movie ID
                const newMovies = pagesToAdd.filter((movie: any) => {
                  if (seenMovieIds.has(movie.id)) {
                    return false;
                  }
                  seenMovieIds.add(movie.id);
                  return true;
                });
                allResults.push(...newMovies);
                console.log(`Page ${currentPage}: Added ${newMovies.length} new movies (${pagesToAdd.length - newMovies.length} duplicates filtered). Total unique: ${allResults.length}`);
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

    console.log('TMDB API response received with', (data.results || []).length, 'movies');
    
    // Apply robust year filtering for year category
    if (category === 'year') {
      const requestedYear = parseInt(searchQuery);
      const originalCount = (data.results || []).length;
      
      // Enhanced year analysis for debugging
      const allYears = (data.results || []).map((movie: any) => ({
        title: movie.title,
        releaseDate: movie.release_date,
        primaryReleaseDate: movie.primary_release_date,
        extractedYear: extractMovieYear(movie)
      }));
      console.log(`Pre-filtering year analysis for ${requestedYear}:`, allYears.slice(0, 5));
      
      // Count how many movies have valid years vs invalid
      const validYearCount = allYears.filter(m => m.extractedYear > 0).length;
      const invalidYearCount = allYears.length - validYearCount;
      console.log(`Year extraction stats: ${validYearCount} valid, ${invalidYearCount} invalid years out of ${allYears.length} total movies`);
      
      // Apply enhanced year filtering
      data.results = (data.results || []).filter((movie: any) => movieMatchesYear(movie, requestedYear));
      
      const filteredCount = data.results.length;
      console.log(`Year filtering complete: ${originalCount} → ${filteredCount} movies (removed ${originalCount - filteredCount} movies that didn't match year ${requestedYear})`);
      
      // Update pagination info after filtering
      data.total_results = filteredCount;
      data.total_pages = Math.ceil(filteredCount / 20);
    }

    // Use the new processMovieResults function with person context when available
    const personName = data.person_info?.name;
    const processedData = await processMovieResults(data, tmdbApiKey, personName);

    return new Response(JSON.stringify(processedData), {
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
