import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client for lifespan checks
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const globalSupabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get person lifespan data with enhanced name matching and TMDB auto-population
async function getPersonLifespan(personName: string): Promise<{birth_date: string | null, death_date: string | null} | null> {
  console.log(`🔍 Looking up lifespan for: "${personName}"`);
  
  // First try exact match
  let { data, error } = await globalSupabase
    .from('person_lifespans')  
    .select('birth_date, death_date, name, tmdb_id')
    .eq('name', personName)
    .single();
    
  if (!error && data) {
    console.log(`✅ Found exact match for ${personName}: ${data.birth_date} - ${data.death_date}`);
    return data;
  }
  
  // Try case-insensitive match
  ({ data, error } = await globalSupabase
    .from('person_lifespans')  
    .select('birth_date, death_date, name, tmdb_id')
    .ilike('name', personName)
    .single());
    
  if (!error && data) {
    console.log(`✅ Found case-insensitive match for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
    return data;
  }
  
  // Try alias lookup
  const { data: aliasData, error: aliasError } = await globalSupabase
    .from('actor_name_aliases')
    .select('primary_name, tmdb_id')
    .eq('alias_name', personName)
    .single();
    
  if (!aliasError && aliasData && aliasData.tmdb_id) {
    console.log(`🔄 Found alias: "${personName}" -> "${aliasData.primary_name}" (TMDB ID: ${aliasData.tmdb_id})`);
    
    // Get lifespan data using TMDB ID
    ({ data, error } = await globalSupabase
      .from('person_lifespans')  
      .select('birth_date, death_date, name, tmdb_id')
      .eq('tmdb_id', aliasData.tmdb_id)
      .single());
      
    if (!error && data) {
      console.log(`✅ Found lifespan via alias for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
      return data;
    }
    
    // If not found in our database but we have TMDB ID, try to auto-populate
    console.log(`🔍 TMDB ID ${aliasData.tmdb_id} not found in lifespans, fetching from TMDB API...`);
    const tmdbResult = await fetchFromTMDB(aliasData.tmdb_id);
    if (tmdbResult) {
      return tmdbResult;
    }
  }
  
  // Try partial name matching (last resort)
  const nameParts = personName.split(' ');
  if (nameParts.length >= 2) {
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts[0];
    
    ({ data, error } = await globalSupabase
      .from('person_lifespans')  
      .select('birth_date, death_date, name, tmdb_id')
      .ilike('name', `${firstName}%${lastName}%`)
      .single());
      
    if (!error && data) {
      console.log(`✅ Found partial match for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
      return data;
    }
  }
  
  // Final attempt: try to find TMDB ID in our existing movie data for this person
  console.log(`🔍 Searching for ${personName} in existing movie data to get TMDB ID...`);
  
  // Look for movies where this person appears in cast/crew to get their TMDB ID
  const { data: movieData, error: movieError } = await globalSupabase
    .from('movies')
    .select('cast_ids, crew_ids')
    .or(`cast_names.ilike.%${personName}%,crew_names.ilike.%${personName}%`)
    .limit(1)
    .single();
    
  if (!movieError && movieData) {
    // Try to extract TMDB person ID from cast or crew IDs
    // This is a simplified approach - in practice, we'd need more sophisticated matching
    console.log(`💡 Found movie data for ${personName}, but TMDB ID extraction from cast/crew is complex - using fallback`);
  }
  
  console.log(`💭 ${personName} is not in our deceased actors database (assumed living)`);
  return null;
}

// Helper function to fetch person data from TMDB API and cache it
async function fetchFromTMDB(tmdbId: number): Promise<{birth_date: string | null, death_date: string | null} | null> {
  try {
    const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
    if (!tmdbApiKey) {
      console.log('❌ TMDB API key not configured, cannot fetch lifespan data');
      return null;
    }
    
    const tmdbResponse = await fetch(`https://api.themoviedb.org/3/person/${tmdbId}?api_key=${tmdbApiKey}`);
    
    if (!tmdbResponse.ok) {
      console.log(`❌ TMDB API error for person ${tmdbId}: ${tmdbResponse.status}`);
      return null;
    }
    
    const personData = await tmdbResponse.json();
    console.log(`📦 Fetched person data from TMDB: ${personData.name} (${personData.birthday} - ${personData.deathday})`);
    
    // Extract and format dates
    const birthDate = personData.birthday || null;
    const deathDate = personData.deathday || null;
    const personName = personData.name || `Person ${tmdbId}`;
    
    // Cache the lifespan data in our database
    const { data: cachedData, error: cacheError } = await globalSupabase
      .from('person_lifespans')
      .upsert({
        tmdb_id: tmdbId,
        name: personName,
        birth_date: birthDate,
        death_date: deathDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('birth_date, death_date, name')
      .single();
    
    if (cacheError) {
      console.log(`❌ Failed to cache lifespan data for ${personName}: ${cacheError.message}`);
      // Return the data anyway, even if caching failed
      return { birth_date: birthDate, death_date: deathDate };
    }
    
    console.log(`✅ Cached and returning lifespan data for ${personName}: (${birthDate} - ${deathDate})`);
    return cachedData;
    
  } catch (apiError) {
    console.log(`❌ Failed to fetch person data from TMDB API: ${apiError}`);
    return null;
  }
}

interface CategoryAnalysisRequest {
  theme: string;
  option: string;
  categories: string[];
  playerCount: number;
}

interface CategoryAvailabilityResult {
  categoryId: string;
  available: boolean;
  movieCount: number;
  sampleMovies: string[];
  reason?: string;
  status: 'sufficient' | 'limited' | 'insufficient';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { theme, option, categories, playerCount }: CategoryAnalysisRequest = await req.json();

    console.log('Analyzing categories:', { theme, option, categories, playerCount });

    // Enhanced logging for specific debug cases
    if (option === 'Clark Gable' && categories.includes("50's")) {
      console.log('🔍 DEBUG: Analyzing Clark Gable + 50s combination - this will have enhanced logging');
    }

    // Analyze all categories in parallel for better performance
    const categoryPromises = categories.map(async (category) => {
      try {
        return await analyzeCategoryMovies(supabase, category, theme, option, playerCount);
      } catch (error) {
        console.error(`Error analyzing category ${category}:`, error);
        return {
          categoryId: category,
          available: false,
          movieCount: 0,
          sampleMovies: [],
          reason: 'Analysis failed',
          status: 'insufficient'
        } as CategoryAvailabilityResult;
      }
    });

    const results = await Promise.all(categoryPromises);

    return new Response(
      JSON.stringify({
        results,
        analysisTimestamp: Date.now(),
        cacheHit: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in analyze-category-availability:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function analyzeCategoryMovies(
  supabase: any,
  category: string,
  theme: string,
  option: string,
  playerCount: number
): Promise<CategoryAvailabilityResult> {
  
  // Map theme and option to proper fetch-movies parameters
  let fetchParams: any = {
    fetchAll: true,
    limit: 1000
  };

  if (theme === 'people' && option) {
    fetchParams.category = 'person';
    fetchParams.searchQuery = option;
    console.log(`Analyzing for person: ${option}`);
  } else if (theme === 'year' && option) {
    fetchParams.category = 'year';
    fetchParams.searchQuery = option;
    console.log(`Analyzing for year: ${option}`);
  } else {
    // For 'all' theme or when no specific option, get all movies
    fetchParams.category = 'all';
    console.log('Analyzing for all movies');
  }

  console.log('Fetch params:', fetchParams);

  // Call the existing fetch-movies function to get comprehensive movie data
  const { data: movieData, error } = await supabase.functions.invoke('fetch-movies', {
    body: fetchParams
  });

  if (error) {
    console.error('Error fetching movies for analysis:', error);
    throw error;
  }

  const movies = movieData?.results || [];
  console.log(`Fetched ${movies.length} movies for analysis`);

  // Enhanced logging for person-based analysis with lifespan information
  if (theme === 'people' && option) {
    const personLifespan = await getPersonLifespan(option);
    if (personLifespan && personLifespan.death_date) {
      console.log(`📅 LIFESPAN INFO: ${option} died on ${personLifespan.death_date}`);
      const deathYear = new Date(personLifespan.death_date).getFullYear();
      console.log(`🚫 Movies after ${deathYear + 3} should be filtered out (3-year grace period)`);
    } else {
      console.log(`💭 ${option} is not in our deceased actors database (assumed living)`);
    }
  }

  // Log a few sample movies to understand the data structure
  if (movies.length > 0) {
    console.log('Sample movie data structure:', JSON.stringify(movies[0], null, 2));
  }

  // Filter movies that match the category
  const eligibleMovies = movies.filter((movie: any) => 
    isMovieEligibleForCategory(movie, category)
  );

  const movieCount = eligibleMovies.length;
  const requiredCount = calculateRequiredMovies(category, playerCount);
  
  // Get sample movies (up to 5)
  const sampleMovies = eligibleMovies
    .slice(0, 5)
    .map((movie: any) => movie.title);

  const status = getStatusFromCount(movieCount, playerCount);
  const available = movieCount >= requiredCount;

  console.log(`Category ${category}: ${movieCount} movies found, ${requiredCount} required`);
  
  // Enhanced logging for specific actor + decade combinations
  if (theme === 'people' && category.includes("'s")) {
    console.log(`🔍 ACTOR + DECADE: ${option} + ${category} = ${movieCount} movies`);
    if (movieCount > 0) {
      console.log(`Sample movies: ${sampleMovies.join(', ')}`);
      // Log year distribution for decade categories
      const yearCounts = {};
      eligibleMovies.forEach(movie => {
        // Use the same enhanced year extraction logic as in isMovieEligibleForCategory
        let year = 0;
        if (movie.year && movie.year > 1900) {
          year = movie.year;
        } else {
          const dateFields = ['release_date', 'primary_release_date', 'first_air_date'];
          for (const field of dateFields) {
            if (movie[field]) {
              try {
                const date = new Date(movie[field]);
                if (!isNaN(date.getTime())) {
                  const extractedYear = date.getFullYear();
                  if (extractedYear > 1900 && extractedYear <= new Date().getFullYear() + 5) {
                    year = extractedYear;
                    break;
                  }
                }
              } catch (error) {
                const yearMatch = movie[field].toString().match(/(\d{4})/);
                if (yearMatch) {
                  const parsedYear = parseInt(yearMatch[1]);
                  if (parsedYear > 1900 && parsedYear <= new Date().getFullYear() + 5) {
                    year = parsedYear;
                    break;
                  }
                }
              }
            }
          }
        }
        
        if (year > 0) {
          const decade = Math.floor(year / 10) * 10;
          yearCounts[decade] = (yearCounts[decade] || 0) + 1;
        }
      });
      console.log(`Year distribution for ${option} + ${category}:`, yearCounts);
    }
  } else if (movieCount > 0) {
    console.log(`Sample eligible movies: ${sampleMovies.join(', ')}`);
  }

  return {
    categoryId: category,
    available,
    movieCount,
    sampleMovies,
    reason: !available ? `Only ${movieCount} movies available, need ${requiredCount}` : undefined,
    status
  };
}

function isMovieEligibleForCategory(movie: any, category: string): boolean {
  // Enhanced year extraction with comprehensive fallback logic
  let year = 0;
  
  // Try direct year field first (from enhanced fetch-movies)
  if (movie.year && movie.year > 1900) {
    year = movie.year;
  } else {
    // Try multiple date fields with enhanced parsing
    const dateFields = ['release_date', 'primary_release_date', 'first_air_date'];
    
    for (const field of dateFields) {
      if (movie[field]) {
        try {
          // Try full date parsing first
          const date = new Date(movie[field]);
          if (!isNaN(date.getTime())) {
            const extractedYear = date.getFullYear();
            if (extractedYear > 1900 && extractedYear <= new Date().getFullYear() + 5) {
              year = extractedYear;
              break;
            }
          }
        } catch (error) {
          // Fallback to regex extraction
          const yearMatch = movie[field].toString().match(/(\d{4})/);
          if (yearMatch) {
            const parsedYear = parseInt(yearMatch[1]);
            if (parsedYear > 1900 && parsedYear <= new Date().getFullYear() + 5) {
              year = parsedYear;
              break;
            }
          }
        }
      }
    }
  }
  
  // Enhanced logging for decade categories with more detail
  if (category.includes("'s") && Math.random() < 0.1) {
    console.log(`Enhanced year extraction for ${movie.title}: extracted=${year}, sources={year:${movie.year}, release_date:${movie.release_date}, primary_release_date:${movie.primary_release_date}}`);
  }

  // Handle genre data - it could be a string or array
  let genreString = '';
  if (typeof movie.genre === 'string') {
    genreString = movie.genre.toLowerCase();
  } else if (Array.isArray(movie.genres)) {
    // Handle TMDB genre array format
    genreString = movie.genres.map((g: any) => g.name || g).join(' ').toLowerCase();
  } else if (Array.isArray(movie.genre)) {
    genreString = movie.genre.join(' ').toLowerCase();
  }

  // Log movie details for debugging (only first few movies to avoid spam)
  if (Math.random() < 0.05) { // Log ~5% of movies
    console.log(`Movie: ${movie.title}, Year: ${year}, Genre: "${genreString}", HasOscar: ${movie.hasOscar}, Revenue: ${movie.revenue}, Budget: ${movie.budget}`);
  }

  // Enhanced logging for decade categories debugging
  if (category.includes("'s")) {
    const decade = category.replace("'s", "");
    const startYear = parseInt(decade) * 10;
    const endYear = startYear + 9;
    const isMatch = year >= startYear && year <= endYear;
    
    // Log matches and some non-matches for debugging
    if (isMatch || Math.random() < 0.02) {
      console.log(`${category} category check: "${movie.title}" (year: ${year}, from: ${movie.release_date || movie.primary_release_date || 'no date'}) - ${isMatch ? 'MATCH' : 'NO MATCH'}`);
    }
  }

  switch (category) {
    case 'Action/Adventure':
      return genreString.includes('action') || genreString.includes('adventure');
    
    case 'Animated':
      return genreString.includes('animation') || genreString.includes('animated');
    
    case 'Comedy':
      return genreString.includes('comedy');
    
    case 'Drama/Romance':
      return genreString.includes('drama') || genreString.includes('romance');
    
    case 'Sci-Fi/Fantasy':
      return genreString.includes('sci-fi') || genreString.includes('science fiction') || 
             genreString.includes('fantasy') || genreString.includes('science');
    
    case 'Horror/Thriller':
      return genreString.includes('horror') || genreString.includes('thriller');
    
    case "30's":
      return year >= 1930 && year <= 1939;
    
    case "40's":
      return year >= 1940 && year <= 1949;
    
    case "50's":
      return year >= 1950 && year <= 1959;
    
    case "60's":
      return year >= 1960 && year <= 1969;
    
    case "70's":
      return year >= 1970 && year <= 1979;
    
    case "80's":
      return year >= 1980 && year <= 1989;
    
    case "90's":
      return year >= 1990 && year <= 1999;
    
    case "2000's":
      return year >= 2000 && year <= 2009;
    
    case "2010's":
      return year >= 2010 && year <= 2019;
    
    case "2020's":
      return year >= 2020 && year <= 2029;
    
    case 'Academy Award Nominee or Winner':
      return movie.hasOscar === true || movie.oscar_status === 'winner' || movie.oscar_status === 'nominee';
    
    case 'Blockbuster (minimum of $50 Mil)':
      return movie.isBlockbuster === true || (movie.revenue && movie.revenue >= 50000000);
    
    default:
      console.log(`Unknown category: ${category}`);
      return false;
  }
}

function calculateRequiredMovies(category: string, playerCount: number): number {
  // Minimum requirement: 1 movie per player
  return playerCount;
}

function getStatusFromCount(count: number, playerCount: number): 'sufficient' | 'limited' | 'insufficient' {
  if (count >= playerCount * 2) return 'sufficient'; // Green: Plenty of movies
  if (count >= playerCount) return 'limited';        // Yellow: Limited but sufficient  
  return 'insufficient';                             // Red: Insufficient
}