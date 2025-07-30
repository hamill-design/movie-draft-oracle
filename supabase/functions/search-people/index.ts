import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { searchQuery } = await req.json()
    
    if (!searchQuery) {
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const tmdbApiKey = Deno.env.get('TMDB')
    if (!tmdbApiKey) {
      console.error('TMDB API key not found')
      return new Response(
        JSON.stringify({ error: 'TMDB API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Input validation and sanitization
    const sanitizedQuery = searchQuery.trim().slice(0, 100); // Limit length
    if (!sanitizedQuery) {
      return new Response(
        JSON.stringify({ error: 'Search query cannot be empty' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Searching for people with query length:', sanitizedQuery.length)

    // Search for people using TMDB API
    const tmdbUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(sanitizedQuery)}`

    const response = await fetch(tmdbUrl)
    
    if (!response.ok) {
      console.error('TMDB API error:', response.status, response.statusText)
      throw new Error(`API request failed`)
    }

    const data = await response.json()
    console.log('TMDB API response - total results:', data.total_results, 'page:', data.page)

    // Transform the data to include relevant information
    const transformedResults = data.results?.map((person: any) => ({
      id: person.id,
      name: person.name,
      known_for_department: person.known_for_department || 'Acting',
      profile_path: person.profile_path,
      popularity: person.popularity,
      known_for: person.known_for?.map((item: any) => ({
        title: item.title || item.name,
        media_type: item.media_type,
        release_date: item.release_date || item.first_air_date
      })) || []
    })) || []

    // Sort by popularity (descending)
    transformedResults.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))

    return new Response(
      JSON.stringify({ 
        results: transformedResults,
        total_results: data.total_results,
        page: data.page 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in search-people function:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: 'Search service temporarily unavailable' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})