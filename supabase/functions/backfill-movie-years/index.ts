import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== BACKFILL MOVIE YEARS STARTED ===')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    console.log('Supabase client initialized')

    // Find movies with missing years
    const { data: picksWithoutYears, error: fetchError } = await supabase
      .from('draft_picks')
      .select('id, movie_id, movie_title, movie_year')
      .is('movie_year', null)
      .limit(50) // Process in batches

    if (fetchError) {
      throw fetchError
    }

    if (!picksWithoutYears || picksWithoutYears.length === 0) {
      console.log('No picks with missing years found')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No picks with missing years found',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${picksWithoutYears.length} picks with missing years`)

    let successCount = 0
    let errorCount = 0

    // Process each movie
    for (const pick of picksWithoutYears) {
      try {
        console.log(`Processing: ${pick.movie_title} (ID: ${pick.movie_id})`)
        
        // Call the enrich-movie-data function
        const { data: enrichResult, error: enrichError } = await supabase.functions.invoke(
          'enrich-movie-data',
          {
            body: {
              movieId: pick.movie_id,
              movieTitle: pick.movie_title,
              movieYear: pick.movie_year
            }
          }
        )

        if (enrichError) {
          console.error(`Failed to enrich ${pick.movie_title}:`, enrichError)
          errorCount++
        } else {
          console.log(`Successfully enriched: ${pick.movie_title}`)
          successCount++
        }

        // Small delay to avoid overwhelming the APIs
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`Error processing ${pick.movie_title}:`, error.message)
        errorCount++
      }
    }

    console.log(`Backfill complete: ${successCount} successful, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: picksWithoutYears.length,
        successful: successCount,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Backfill error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})