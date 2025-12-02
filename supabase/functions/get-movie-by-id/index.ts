import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { movieId } = await req.json()
    
    if (!movieId) {
      return new Response(
        JSON.stringify({ error: 'Movie ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const tmdbApiKey = Deno.env.get('TMDB')
    if (!tmdbApiKey) {
      return new Response(
        JSON.stringify({ error: 'TMDB API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Fetch movie details from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`
    const response = await fetch(tmdbUrl)
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Transform to match our Movie interface
    const movie = {
      id: data.id,
      title: data.title,
      year: data.release_date ? parseInt(data.release_date.substring(0, 4)) : 0,
      posterPath: data.poster_path,
      tmdbId: data.id,
    }

    return new Response(
      JSON.stringify(movie),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching movie:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch movie' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

