
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

// Helper function to get person lifespan data by TMDB ID with enhanced fallback to name matching
async function getPersonLifespan(tmdbId: number): Promise<{birth_date: string | null, death_date: string | null} | null> {
  try {
    // First try by TMDB ID (most reliable)
    const { data } = await supabase
      .from('person_lifespans')
      .select('birth_date, death_date, name')
      .eq('tmdb_id', tmdbId)
      .single();
    
    if (data) {
      console.log(`✅ Found lifespan by TMDB ID ${tmdbId}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
      return data;
    }
  } catch (error) {
    console.log(`🔍 TMDB ID ${tmdbId} not found in lifespans, person assumed living`);
  }
  
  return null;
}

// Helper function to get person lifespan data by name with enhanced matching
async function getPersonLifespanByName(personName: string): Promise<{birth_date: string | null, death_date: string | null} | null> {
  console.log(`🔍 Looking up lifespan by name for: "${personName}"`);
  
  // First try exact match
  let { data, error } = await supabase
    .from('person_lifespans')  
    .select('birth_date, death_date, name, tmdb_id')
    .eq('name', personName)
    .single();
    
  if (!error && data) {
    console.log(`✅ Found exact match for ${personName}: ${data.birth_date} - ${data.death_date}`);
    return data;
  }
  
  // Try case-insensitive match
  ({ data, error } = await supabase
    .from('person_lifespans')  
    .select('birth_date, death_date, name, tmdb_id')
    .ilike('name', personName)
    .single());
    
  if (!error && data) {
    console.log(`✅ Found case-insensitive match for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
    return data;
  }
  
  // Try alias lookup
  const { data: aliasData, error: aliasError } = await supabase
    .from('actor_name_aliases')
    .select('primary_name, tmdb_id')
    .eq('alias_name', personName)
    .single();
    
  if (!aliasError && aliasData) {
    console.log(`🔄 Found alias: "${personName}" -> "${aliasData.primary_name}"`);
    
    // Get lifespan data using TMDB ID from alias
    ({ data, error } = await supabase
      .from('person_lifespans')  
      .select('birth_date, death_date, name, tmdb_id')
      .eq('tmdb_id', aliasData.tmdb_id)
      .single());
      
    if (!error && data) {
      console.log(`✅ Found lifespan via alias for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
      return data;
    }
  }
  
  // Try partial name matching (last resort)
  const nameParts = personName.split(' ');
  if (nameParts.length >= 2) {
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts[0];
    
    ({ data, error } = await supabase
      .from('person_lifespans')  
      .select('birth_date, death_date, name, tmdb_id')
      .ilike('name', `${firstName}%${lastName}%`)
      .single());
      
    if (!error && data) {
      console.log(`✅ Found partial match for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
      return data;
    }
  }
  
  console.log(`💭 ${personName} is not in our deceased actors database (assumed living)`);
  return null;
}

// Enhanced function to detect documentaries and archive footage
function isDocumentaryOrArchiveContent(movie: any, movieGenres: any[]): boolean {
  // Check genre IDs - expanded documentary detection
  if (movieGenres && Array.isArray(movieGenres)) {
    const documentaryGenreIds = [99, 36, 10770]; // Documentary, History, TV Movie
    const hasDocumentaryGenre = movieGenres.some(genre => 
      genre && documentaryGenreIds.includes(genre.id)
    );
    if (hasDocumentaryGenre) {
      console.log(`Documentary detected via genre: ${movieGenres.map(g => g.name || g.id).join(', ')}`);
      return true;
    }
  }

  // Check title keywords for documentary indicators
  const title = (movie.title || '').toLowerCase();
  const documentaryKeywords = [
    'documentary', 'making of', 'behind the scenes', 'retrospective', 
    'tribute', 'legacy', 'remembering', 'biography', 'life story',
    'archives', 'footage', 'collection', 'compilation', 'best of',
    'greatest hits', 'tribute to', 'in memoriam', 'celebrating'
  ];
  
  const hasDocumentaryKeywords = documentaryKeywords.some(keyword => title.includes(keyword));
  if (hasDocumentaryKeywords) {
    console.log(`Archive content detected via title keywords: "${title}"`);
    return true;
  }

  // Check overview for archive footage indicators
  const overview = (movie.overview || '').toLowerCase();
  const archiveKeywords = [
    'archive footage', 'archival footage', 'rare footage', 'unseen footage',
    'behind the scenes', 'documentary about', 'tribute to', 'explores the life'
  ];
  
  const hasArchiveKeywords = archiveKeywords.some(keyword => overview.includes(keyword));
  if (hasArchiveKeywords) {
    console.log(`Archive content detected via overview: "${overview.substring(0, 100)}..."`);
    return true;
  }

  return false;
}

// Enhanced function to check character roles for archive footage
function isArchiveFootageRole(movie: any, actorName: string): boolean {
  // Check if character name indicates archive footage
  const character = (movie.character || '').toLowerCase();
  const archiveRoles = ['self', 'archive footage', 'himself', 'herself', 'narrator', 'host'];
  
  if (archiveRoles.some(role => character.includes(role))) {
    console.log(`Archive role detected: "${movie.character}" in "${movie.title}"`);
    return true;
  }

  return false;
}

// Enhanced function to validate movies for deceased actors
function isValidMovieForDeceasedActor(movie: any, deathDate: string, movieGenres: any[], actorName: string = ''): boolean {
  const death = new Date(deathDate);
  const deathYear = death.getFullYear();
  const movieYear = extractMovieYear(movie);
  
  if (movieYear === 0) {
    console.log(`Skipping movie with no valid year: "${movie.title}"`);
    return false;
  }

  // Stricter grace period: only 1 year for legitimate posthumous releases
  const gracePeriodEnd = deathYear + 1;
  
  // Always filter out movies made more than 1 year after death
  if (movieYear > gracePeriodEnd) {
    console.log(`🚫 Movie "${movie.title}" (${movieYear}) exceeds 1-year grace period (death: ${deathYear})`);
    return false;
  }
  
  // Filter out documentaries and archive content regardless of year if made after death
  if (movieYear > deathYear) {
    if (isDocumentaryOrArchiveContent(movie, movieGenres)) {
      console.log(`🚫 Documentary/Archive content filtered: "${movie.title}" (${movieYear})`);
      return false;
    }

    // Check for archive footage roles
    if (isArchiveFootageRole(movie, actorName)) {
      console.log(`🚫 Archive footage role filtered: "${movie.title}" (${movieYear})`);
      return false;
    }
  }

  // Additional validation for movies made in the year of death
  if (movieYear === deathYear) {
    // Check release date vs death date if both are available
    if (movie.release_date && deathDate) {
      const releaseDate = new Date(movie.release_date);
      const deathDateObj = new Date(deathDate);
      
      if (releaseDate > deathDateObj) {
        const daysDiff = Math.floor((releaseDate.getTime() - deathDateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 180) { // More than 6 months after death is suspicious
          console.log(`🚫 Movie "${movie.title}" released ${daysDiff} days after death, likely archive content`);
          return false;
        }
      }
    }
  }

  console.log(`✅ Valid movie for ${actorName}: "${movie.title}" (${movieYear})`);
  return true;
}

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

// Enhanced person validation and selection
function selectBestPersonMatch(personResults: any[], searchQuery: string): any | null {
  if (!personResults || personResults.length === 0) {
    return null;
  }
  
  const query = searchQuery.toLowerCase().trim();
  
  // First, try exact name match
  for (const person of personResults) {
    if (person.name && person.name.toLowerCase() === query) {
      console.log(`Exact name match found: ${person.name} (ID: ${person.id})`);
      return person;
    }
  }
  
  // Then try partial name match with high popularity
  const partialMatches = personResults.filter(person => 
    person.name && person.name.toLowerCase().includes(query) && person.popularity > 5
  );
  
  if (partialMatches.length > 0) {
    // Sort by popularity and return the highest
    partialMatches.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    console.log(`Partial match with high popularity: ${partialMatches[0].name} (ID: ${partialMatches[0].id}, popularity: ${partialMatches[0].popularity})`);
    return partialMatches[0];
  }
  
  // Fallback to first result if it has reasonable popularity
  const firstResult = personResults[0];
  if (firstResult.popularity > 1) {
    console.log(`Using first result: ${firstResult.name} (ID: ${firstResult.id}, popularity: ${firstResult.popularity})`);
    return firstResult;
  }
  
  console.log(`No suitable person match found for: ${searchQuery}`);
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
            const selectedPerson = selectBestPersonMatch(personData.results, searchQuery);
            
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
                
                // Get person lifespan to determine filtering strategy
                let personLifespan = await getPersonLifespan(selectedPerson.id);
                
                // If TMDB ID lookup failed, try name-based lookup as fallback
                if (!personLifespan) {
                  console.log(`🔄 TMDB ID lookup failed for ${selectedPerson.name}, trying name-based lookup...`);
                  personLifespan = await getPersonLifespanByName(selectedPerson.name);
                }
                
                let allMovies = [];
                if (personLifespan && personLifespan.death_date) {
                  console.log(`${selectedPerson.name} is deceased (died: ${personLifespan.death_date}), filtering credits`);
                  // For deceased actors, only include cast credits (actual performances)
                  allMovies = creditsData.cast || [];
                } else {
                  console.log(`${selectedPerson.name} is living or not in our database, including all credits`);
                  // For living actors, include both cast and crew
                  allMovies = [
                    ...(creditsData.cast || []),
                    ...(creditsData.crew || [])
                  ];
                }
                
                // Remove duplicates based on movie ID and apply lifespan filtering
                let uniqueMovies = allMovies.filter((movie, index, self) => 
                  index === self.findIndex(m => m.id === movie.id)
                );
                
                // Enhanced lifespan filtering for deceased actors
                if (personLifespan && personLifespan.death_date) {
                  const originalCount = uniqueMovies.length;
                  console.log(`🔍 Applying enhanced filtering for deceased actor: ${selectedPerson.name} (died: ${personLifespan.death_date})`);
                  
                  uniqueMovies = uniqueMovies.filter((movie: any) => {
                    // Convert genre_ids to genre objects for consistency
                    const genres = (movie.genre_ids || []).map((id: number) => ({ id }));
                    return isValidMovieForDeceasedActor(movie, personLifespan.death_date!, genres, selectedPerson.name);
                  });
                  
                  const filteredCount = originalCount - uniqueMovies.length;
                  console.log(`📊 Enhanced lifespan filtering: ${originalCount} → ${uniqueMovies.length} movies`);
                  console.log(`🗑️  Filtered out ${filteredCount} posthumous/documentary/archive entries`);
                  
                  // Log some examples of what was filtered
                  if (filteredCount > 0) {
                    console.log(`🎬 Remaining valid movies sample: ${uniqueMovies.slice(0, 5).map(m => `"${m.title}" (${extractMovieYear(m)})`).join(', ')}`);
                  }
                }
                
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
                return new Response(JSON.stringify(await processMovieResults(data, tmdbApiKey)), {
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

        // Get accurate Oscar status from OMDb API with caching
        // Use the enhanced movie year extraction
        const movieYear = extractMovieYear(detailedMovie);
        
        // Enhanced logging with more context
        if (Math.random() < 0.05) {
          console.log(`Movie: ${movie.title} - Release Date: ${detailedMovie.release_date}, Primary: ${detailedMovie.primary_release_date}, Extracted Year: ${movieYear}`);
        }
        
        const oscarStatus = await getOscarStatus(movie.id, movie.title, movieYear);
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
