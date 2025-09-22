import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  // Log a few sample movies to understand the data structure
  if (movies.length > 0) {
    console.log('Sample movie data structure:', JSON.stringify(movies[0], null, 2));
  }

  // Filter movies that match the category with person context
  const personName = theme === 'people' ? option : undefined;
  const eligibleMovies = movies.filter((movie: any) => 
    isMovieEligibleForCategory(movie, category, personName)
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
        const year = movie.year || movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
        const decade = Math.floor(year / 10) * 10;
        yearCounts[decade] = (yearCounts[decade] || 0) + 1;
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

// Unified category eligibility function with enhanced validation
function isMovieEligibleForCategory(movie: any, category: string, personName?: string): boolean {
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

  // Career timeline filtering for classic actors
  if (personName && year > 0) {
    const classicActors = {
      'bette davis': { startYear: 1929, endYear: 1989 },
      'clark gable': { startYear: 1924, endYear: 1960 },
      'katharine hepburn': { startYear: 1932, endYear: 1994 },
      'cary grant': { startYear: 1932, endYear: 1966 },
      'james stewart': { startYear: 1935, endYear: 1991 },
      'jimmy stewart': { startYear: 1935, endYear: 1991 },
      'humphrey bogart': { startYear: 1930, endYear: 1957 },
      'spencer tracy': { startYear: 1930, endYear: 1967 }
    };
    
    const actorInfo = classicActors[personName.toLowerCase()];
    if (actorInfo) {
      // Filter out movies outside the actor's career timeline
      if (year < actorInfo.startYear || year > actorInfo.endYear) {
        if (Math.random() < 0.02) { // Log some filtered movies for debugging
          console.log(`🚫 Career timeline filter: "${movie.title}" (${year}) outside ${personName} career (${actorInfo.startYear}-${actorInfo.endYear})`);
        }
        return false;
      }
    }
  }
  
  // Enhanced logging for decade categories with more detail
  if (category.includes("'s") && Math.random() < 0.05) {
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

  // Enhanced logging for decade categories debugging
  if (category.includes("'s")) {
    const decade = category.replace("'s", "");
    const startYear = parseInt(decade) * 10;
    const endYear = startYear + 9;
    const isMatch = year >= startYear && year <= endYear;
    
    // Log matches and some non-matches for debugging
    if (isMatch || Math.random() < 0.01) {
      const actorContext = personName ? ` for ${personName}` : '';
      console.log(`${category} category check${actorContext}: "${movie.title}" (year: ${year}, from: ${movie.release_date || movie.primary_release_date || 'no date'}) - ${isMatch ? 'MATCH' : 'NO MATCH'}`);
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
      // Enhanced Oscar status check with multiple field support
      const oscarChecks = [
        movie.hasOscar === true,
        movie.oscar_status === 'winner',
        movie.oscar_status === 'nominee'
      ];
      
      const isOscarMovie = oscarChecks.some(check => check);
      
      // Enhanced logging for Oscar category debugging
      if (Math.random() < 0.02) {
        const actorContext = personName ? ` for ${personName}` : '';
        console.log(`🏆 Oscar check${actorContext}: "${movie.title}" - hasOscar:${movie.hasOscar}, oscar_status:${movie.oscar_status}, result:${isOscarMovie}`);
      }
      
      return isOscarMovie;
    
    case 'Blockbuster (minimum of $50 Mil)':
      const blockbusterChecks = [
        movie.isBlockbuster === true,
        (movie.revenue && movie.revenue >= 50000000),
        (movie.budget && movie.budget >= 50000000)
      ];
      
      return blockbusterChecks.some(check => check);
    
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