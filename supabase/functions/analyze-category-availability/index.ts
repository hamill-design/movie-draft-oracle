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

  const status = getStatusFromCount(movieCount, requiredCount);
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
  const genre = movie.genre?.toLowerCase() || '';
  const year = movie.year || movie.release_date ? new Date(movie.release_date).getFullYear() : 0;

  switch (category) {
    case 'Action/Adventure':
      return genre.includes('action') || genre.includes('adventure');
    
    case 'Animated':
      return genre.includes('animation') || genre.includes('animated');
    
    case 'Comedy':
      return genre.includes('comedy');
    
    case 'Drama/Romance':
      return genre.includes('drama') || genre.includes('romance');
    
    case 'Sci-Fi/Fantasy':
      return genre.includes('sci-fi') || genre.includes('science fiction') || genre.includes('fantasy');
    
    case 'Horror/Thriller':
      return genre.includes('horror') || genre.includes('thriller');
    
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
      return movie.hasOscar || movie.oscar_status === 'winner' || movie.oscar_status === 'nominee';
    
    case 'Blockbuster (minimum of $50 Mil)':
      return movie.isBlockbuster || (movie.revenue && movie.revenue >= 50000000);
    
    default:
      return false;
  }
}

function calculateRequiredMovies(category: string, playerCount: number): number {
  // Buffer calculation: need more movies than players for good choices
  const baseMultiplier = 1.5;
  
  // Category-specific adjustments
  const categoryMultipliers: Record<string, number> = {
    'Action/Adventure': 1.5,
    'Comedy': 1.6,
    'Drama/Romance': 1.7,
    'Sci-Fi/Fantasy': 1.4,
    'Animated': 1.3,
    'Horror/Thriller': 1.3,
    "70's": 1.2,
    "80's": 1.3,
    "90's": 1.4,
    "2000's": 1.5,
    "2010's": 1.6,
    "2020's": 1.2,
    'Academy Award Nominee or Winner': 1.3,
    'Blockbuster (minimum of $50 Mil)': 1.4
  };

  const multiplier = categoryMultipliers[category] || baseMultiplier;
  return Math.max(Math.ceil(playerCount * multiplier), 6);
}

function getStatusFromCount(count: number, required: number): 'sufficient' | 'limited' | 'insufficient' {
  if (count >= required * 1.5) return 'sufficient';
  if (count >= required) return 'limited';
  return 'insufficient';
}