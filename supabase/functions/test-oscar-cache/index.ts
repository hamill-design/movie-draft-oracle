import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Testing Oscar cache improvements...');

    // Test 1: Get cache statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_oscar_cache_stats');

    if (statsError) {
      console.error('Error getting cache stats:', statsError);
      throw statsError;
    }

    console.log('Oscar cache statistics:', stats);

    // Test 2: Check if our manual updates worked for known winners
    const { data: knownWinners, error: winnersError } = await supabase
      .from('oscar_cache')
      .select('movie_title, movie_year, oscar_status, awards_data')
      .in('movie_title', ['The English Patient', 'Titanic', 'Forrest Gump', 'The Silence of the Lambs', 'Goodfellas'])
      .order('movie_year');

    if (winnersError) {
      console.error('Error checking known winners:', winnersError);
      throw winnersError;
    }

    console.log('Known Oscar winners status:', knownWinners);

    // Test 3: Run the questionable entries refresh function
    const { data: refreshResults, error: refreshError } = await supabase
      .rpc('refresh_oscar_cache_for_questionable_entries');

    if (refreshError) {
      console.error('Error refreshing questionable entries:', refreshError);
      throw refreshError;
    }

    console.log('Questionable entries refresh results:', refreshResults);

    // Test 4: Check some high-profile movies that might need Oscar data refresh
    const { data: highProfileMovies, error: highProfileError } = await supabase
      .from('oscar_cache')
      .select('movie_title, movie_year, oscar_status, updated_at')
      .eq('oscar_status', 'none')
      .gte('movie_year', 1990)
      .lte('movie_year', 2020)
      .limit(10);

    if (highProfileError) {
      console.error('Error checking high profile movies:', highProfileError);
    } else {
      console.log('High profile movies with "none" status:', highProfileMovies);
    }

    const results = {
      success: true,
      cacheStats: stats?.[0] || {},
      knownWinnersUpdated: knownWinners || [],
      refreshResults: refreshResults?.[0] || {},
      highProfileMoviesNeedingRefresh: highProfileMovies || [],
      message: 'Oscar cache improvement testing completed successfully'
    };

    return new Response(
      JSON.stringify(results, null, 2),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      },
    )

  } catch (error) {
    console.error('Test failed:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      },
    )
  }
})