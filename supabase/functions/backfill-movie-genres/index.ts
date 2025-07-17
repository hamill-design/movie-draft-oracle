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
    console.log('=== BACKFILL MOVIE GENRES STARTED ===')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables')
      throw new Error('Missing Supabase configuration')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)
    console.log('Supabase client initialized')

    // Get TMDB API key
    const tmdbApiKey = Deno.env.get('TMDB')
    if (!tmdbApiKey) {
      throw new Error('TMDB API key not configured')
    }

    // Fetch all draft picks with "Unknown" genre
    const { data: picks, error: fetchError } = await supabaseClient
      .from('draft_picks')
      .select('id, movie_id, movie_title, movie_genre')
      .eq('movie_genre', 'Unknown')

    if (fetchError) {
      console.error('Error fetching picks:', fetchError)
      throw fetchError
    }

    if (!picks || picks.length === 0) {
      console.log('No picks with Unknown genre found')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No picks needed updating',
          updated: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log(`Found ${picks.length} picks with Unknown genre`)

    let updated = 0
    let failed = 0

    // Process each pick
    for (const pick of picks) {
      try {
        console.log(`Processing: ${pick.movie_title} (ID: ${pick.movie_id})`)

        // Fetch genre data from TMDB
        const tmdbUrl = `https://api.themoviedb.org/3/movie/${pick.movie_id}?api_key=${tmdbApiKey}`
        const tmdbResponse = await fetch(tmdbUrl)
        
        if (!tmdbResponse.ok) {
          console.log(`TMDB API error for ${pick.movie_title}: ${tmdbResponse.status}`)
          failed++
          continue
        }

        const tmdbData = await tmdbResponse.json()
        
        if (tmdbData.status_code) {
          console.log(`TMDB error for ${pick.movie_title}: ${tmdbData.status_message}`)
          failed++
          continue
        }

        let movieGenre = 'Unknown'

        // Extract genre information
        if (tmdbData.genres && tmdbData.genres.length > 0) {
          movieGenre = tmdbData.genres[0].name
          console.log(`Found genre: ${movieGenre}`)
        } else if (tmdbData.genre_ids && tmdbData.genre_ids.length > 0) {
          movieGenre = getGenreName(tmdbData.genre_ids[0])
          console.log(`Found genre from ID: ${movieGenre}`)
        }

        // Only update if we found a real genre
        if (movieGenre !== 'Unknown') {
          const { error: updateError } = await supabaseClient
            .from('draft_picks')
            .update({ movie_genre: movieGenre })
            .eq('id', pick.id)

          if (updateError) {
            console.error(`Error updating pick ${pick.id}:`, updateError)
            failed++
          } else {
            console.log(`Updated ${pick.movie_title} with genre: ${movieGenre}`)
            updated++
          }
        } else {
          console.log(`No genre found for ${pick.movie_title}`)
          failed++
        }

        // Small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error processing pick ${pick.id}:`, error)
        failed++
      }
    }

    console.log(`Backfill complete. Updated: ${updated}, Failed: ${failed}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill complete`,
        updated,
        failed,
        total: picks.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Function error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

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