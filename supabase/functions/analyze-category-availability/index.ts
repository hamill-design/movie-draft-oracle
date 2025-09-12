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

    const results: CategoryAvailabilityResult[] = [];

    // Analyze each category
    for (const category of categories) {
      try {
        const analysisResult = await analyzeCategoryMovies(supabase, category, theme, option, playerCount);
        results.push(analysisResult);
      } catch (error) {
        console.error(`Error analyzing category ${category}:`, error);
        results.push({
          categoryId: category,
          available: false,
          movieCount: 0,
          sampleMovies: [],
          reason: 'Analysis failed',
          status: 'insufficient'
        });
      }
    }

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

  const movies = movieData?.movies || [];
  console.log(`Fetched ${movies.length} movies for analysis`);

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
  // Extract year from movie data
  let year = 0;
  if (movie.year) {
    year = movie.year;
  } else if (movie.release_date) {
    year = new Date(movie.release_date).getFullYear();
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